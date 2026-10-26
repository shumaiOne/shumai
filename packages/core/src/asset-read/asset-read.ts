import {
  readerOptionSchemas,
  type AssetReadOutput,
  type ReaderConfigKey,
  type ReaderKind,
} from '@shumai/operations'
import { AssetType, prisma, WorkflowTaskStatus, type Prisma, type WorkflowTask } from '@shumai/db'
import { HTTPException } from 'hono/http-exception'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { s3Service } from '@shumai/core/src/s3/s3'
import { resolveAnnotationsById } from './annotations'
import { findReader, getReader, readers } from './registry'
import {
  badRequest,
  storageBucket,
  UnsupportedAssetTypeError,
  type ReadableAsset,
  type ReadResult,
} from './types'

/** Who is reading: a user (Read permission required) or the autofill system agent. */
export type ReadAccess =
  { kind: 'user'; userId: string } | { kind: 'autofill'; teamId?: string; targetAssetId?: string }

export type ReadAssetRequest = {
  assetId: string
  annotationId?: string
  includeContent?: boolean
} & { [K in ReaderConfigKey]?: Record<string, unknown> }

export type ReadOutcome =
  | { status: 'ready'; asset: ReadableAsset; kind: ReaderKind; result: ReadResult }
  | {
      status: 'pending'
      asset: ReadableAsset
      kind: ReaderKind
      taskId: string
      retryAfterSeconds: number
    }

/** Lifetime of image links handed to callers outside the server. */
export const READ_URL_EXPIRES_SECONDS = 3600

const assetWithStorage = { storageKey: true } satisfies Prisma.AssetInclude
type AssetRecord = Prisma.AssetGetPayload<{ include: typeof assetWithStorage }>

function toReadable(asset: AssetRecord): ReadableAsset {
  return {
    id: asset.id,
    name: asset.name,
    projectId: asset.projectId,
    mediaType: asset.mediaType,
    mediaTypeLower: asset.mediaType?.toLowerCase() || '',
    filenameLower: asset.name?.toLowerCase() || '',
    storageKey: asset.storageKey?.key ?? null,
    media: asset.media as PrismaJson.MediaInfo | null,
  }
}

function hasContent(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    Object.values(value).some((v) => v !== null && v !== undefined)
  )
}

function notFoundRender(): HTTPException {
  return new HTTPException(404, { message: 'Render not found' })
}

/**
 * Shared pipeline behind `read_asset` and `get_asset_render`: access checks, version stacks,
 * reader selection, option validation, annotations, render tasks, and waiting. Readers in
 * `./readers` only contain the type-specific logic.
 */
export class AssetReadService {
  async read(
    access: ReadAccess,
    request: ReadAssetRequest,
    opts: { waitBudgetMs: number },
  ): Promise<ReadOutcome> {
    await this.checkAccess(access, request.assetId)
    const asset = await this.loadLatestVersion(request.assetId)

    const reader = findReader(asset)
    if (!reader) {
      throw new UnsupportedAssetTypeError(asset.id, asset.mediaTypeLower)
    }

    // Reject configs meant for another type (empty objects like `imageConfig: {}` are ignored).
    const configKey = readerOptionSchemas[reader.kind].key
    for (const other of readers) {
      const otherKey = readerOptionSchemas[other.kind].key
      if (otherKey !== configKey && hasContent(request[otherKey])) {
        throw badRequest(
          `Asset ${asset.id} is a ${reader.label}. ${reader.configHint}; do not pass ${otherKey}.`,
        )
      }
    }

    const options = request[configKey]
    reader.validate(asset, options as never, { hasAnnotation: Boolean(request.annotationId) })

    const annotation = request.annotationId
      ? {
          annotationId: request.annotationId,
          ...(await resolveAnnotationsById(asset.id, request.annotationId)),
        }
      : null

    const plan = await reader.plan(asset, options as never, {
      annotation,
      includeContent: request.includeContent !== false,
    })
    if (plan.status === 'ready') {
      return { status: 'ready', asset, kind: reader.kind, result: plan.result }
    }

    const projectId = asset.projectId || 'none'
    const task = await prisma.workflowTask.create({
      data: {
        assetId: asset.id,
        projectId,
        type: plan.task.type,
        status: WorkflowTaskStatus.pending,
        payload: {
          projectId,
          ...plan.task.spec,
          assetRead: {
            reader: reader.kind,
            options: options ?? undefined,
            annotationId: request.annotationId,
            context: plan.context,
            requestedBy: access.kind === 'user' ? access.userId : undefined,
          },
        },
      },
    })
    return this.finish(task, asset, opts.waitBudgetMs)
  }

  /** Completes a read that returned `pending`. Only the requesting user can fetch it. */
  async getRender(
    userId: string,
    taskId: string,
    opts: { waitBudgetMs: number },
  ): Promise<ReadOutcome> {
    const task = await prisma.workflowTask.findUnique({ where: { id: taskId } })
    const request = task?.payload?.assetRead
    if (!task || !request || !task.assetId || !userId || request.requestedBy !== userId) {
      throw notFoundRender()
    }
    try {
      await authzService.hasPermission({
        user: { id: userId },
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: task.assetId,
      })
    } catch {
      // Don't reveal that the task exists to someone who can no longer see the asset.
      throw notFoundRender()
    }
    const record = await prisma.asset.findUnique({
      where: { id: task.assetId },
      include: assetWithStorage,
    })
    if (!record) throw notFoundRender()
    return this.finish(task, toReadable(record), opts.waitBudgetMs)
  }

  private async finish(
    task: WorkflowTask,
    asset: ReadableAsset,
    waitBudgetMs: number,
  ): Promise<ReadOutcome> {
    const request = task.payload!.assetRead!
    const reader = getReader(request.reader)
    const { task: latest, done } = await workflowService.waitFor(task, waitBudgetMs)
    if (!done) {
      return {
        status: 'pending',
        asset,
        kind: reader.kind,
        taskId: task.id,
        retryAfterSeconds: reader.kind === 'video' || reader.kind === 'document' ? 5 : 3,
      }
    }
    if (!reader.collect) {
      throw new Error(`Reader "${reader.kind}" cannot collect render results`)
    }
    const result = reader.collect(
      asset,
      request.options as never,
      latest.output ?? {},
      request.context ?? {},
    )
    return { status: 'ready', asset, kind: reader.kind, result }
  }

  private async checkAccess(access: ReadAccess, assetId: string): Promise<void> {
    if (access.kind === 'user') {
      if (!access.userId) {
        throw new HTTPException(401, { message: 'User ID is required for authorization.' })
      }
      await authzService.hasPermission({
        user: { id: access.userId },
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })
      return
    }

    // Autofill system agent: no user; confined to its team and target asset.
    if (!access.targetAssetId) {
      throw new HTTPException(403, {
        message: 'Target asset ID is required for autofill agent authorization.',
      })
    }
    if (!access.teamId) {
      throw new HTTPException(403, {
        message: 'Team ID is required for autofill agent authorization.',
      })
    }
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { project: true, teamRootFolder: true },
    })
    if (!asset) {
      throw new HTTPException(404, { message: `Asset with ID ${assetId} not found.` })
    }
    const assetTeamId = asset.project?.teamId || asset.teamRootFolder?.id
    if (!assetTeamId || assetTeamId !== access.teamId) {
      throw new HTTPException(403, {
        message: `Access denied: asset ${assetId} does not belong to team ${access.teamId}.`,
      })
    }
    if (asset.id !== access.targetAssetId && asset.parentId !== access.targetAssetId) {
      throw new HTTPException(403, {
        message: `Access denied: autofill agent can only read target asset ${access.targetAssetId}.`,
      })
    }
  }

  private async loadLatestVersion(assetId: string): Promise<ReadableAsset> {
    let asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: assetWithStorage,
    })
    if (!asset) {
      throw new HTTPException(404, { message: `Asset with ID ${assetId} not found.` })
    }
    if (asset.type === AssetType.version_stack) {
      const latest = await prisma.asset.findFirst({
        where: { parentId: asset.id, isDeleted: false },
        orderBy: { sortIndex: 'asc' },
        include: assetWithStorage,
      })
      if (latest) asset = latest
    }
    return toReadable(asset)
  }
}

export const assetReadService = new AssetReadService()

/**
 * Converts a read outcome into the Operation output. Every image gets a short-lived link;
 * storage keys (and the source file link) only when the result is presented server-side.
 */
export async function toAssetReadOutput(
  outcome: ReadOutcome,
  opts: { includeKeys: boolean },
): Promise<AssetReadOutput> {
  const asset = {
    id: outcome.asset.id,
    name: outcome.asset.name,
    kind: outcome.kind,
    mediaType: outcome.asset.mediaType,
  }
  if (outcome.status === 'pending') {
    return {
      status: 'pending',
      summary: `Rendering is still in progress for "${outcome.asset.name}".`,
      asset,
      details: [],
      images: [],
      taskId: outcome.taskId,
      retryAfterSeconds: outcome.retryAfterSeconds,
    }
  }

  const bucket = storageBucket()
  const { result } = outcome
  const images = await Promise.all(
    result.images.map(async (image) => ({
      label: image.label,
      mimeType: image.mimeType,
      url: await s3Service.presign(
        bucket,
        image.key,
        'GET',
        false,
        undefined,
        false,
        READ_URL_EXPIRES_SECONDS,
      ),
      ...(opts.includeKeys ? { key: image.key } : {}),
    })),
  )
  const text = result.text
    ? {
        content: result.text.content,
        truncated: result.text.truncated,
        size: result.text.size,
        mimeType: result.text.mimeType,
        ...(opts.includeKeys
          ? {
              key: result.text.key,
              url: await s3Service.presign(
                bucket,
                result.text.key,
                'GET',
                true,
                outcome.asset.name || undefined,
                false,
                READ_URL_EXPIRES_SECONDS,
              ),
            }
          : {}),
      }
    : undefined

  return {
    status: 'ready',
    summary: result.summary,
    asset,
    details: result.details,
    images,
    ...(text ? { text } : {}),
  }
}
