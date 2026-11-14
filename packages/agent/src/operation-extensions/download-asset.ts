import type { ToolExecutionResult as AgentToolResult } from '@earendil-works/pi-durable'
import { storageBucket } from '@shumai/core/src/asset-read'
import { assertStorageKeyNotArchived } from '@shumai/core/src/asset/asset-archive'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { runnerService } from '@shumai/core/src/runner'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import type { User } from '@shumai/db'
import { downloadAsset, MAX_DOWNLOAD_ASSETS, type DownloadAssetOutput } from '@shumai/operations'
import * as path from 'path'
import { z } from 'zod'
import {
  registerAgentToolExtension,
  type AgentOperationContext,
  type AgentToolExtension,
} from '../operation-tools'
import { resolveAssetIdFromKey } from '../tools/download-asset'

const CLEANUP_REMINDER = 'Remember to delete these temporary files when finished.'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function resolveTargetRunnerId(ctx: AgentOperationContext): Promise<string> {
  if (ctx.runnerId && !ctx.teamId) {
    if (!runnerService.isRunnerConnected(ctx.runnerId)) {
      throw new Error(
        'Runner is currently offline. Please start your runner with "shumai runner start" and try again.',
      )
    }
    return ctx.runnerId
  }
  const runner = await runnerService.requireOnlineRunner(ctx.teamId || '', ctx.runnerId)
  return runner.id
}

/** Saves a storage object into the runner's .pi directory; returns the path, size, and content type. */
async function saveToRunner(key: string, filename: string, ctx: AgentOperationContext) {
  const runnerId = await resolveTargetRunnerId(ctx)
  const bucket = storageBucket()
  const info = await s3Service.headObject(bucket, key).catch(() => null)
  const url = await s3Service.presign(bucket, key, 'GET', false, undefined, false, 600)
  const filePath = path.posix.join('.pi', filename)
  const res = await runnerService.downloadToRunner(runnerId, { url, destPath: filePath })
  if (!res.ok) {
    throw new Error(res.error || `Failed to download "${filename}" to runner`)
  }
  const size = res.size ?? info?.size ?? 0
  const contentType =
    res.mimeType && res.mimeType !== 'application/octet-stream'
      ? res.mimeType
      : info?.contentType && info.contentType !== 'application/octet-stream'
        ? info.contentType
        : getFileMimeType(null, filename)
  return { filePath, size, contentType }
}

/** Downloads one storage key (e.g. a frame from read_asset) after checking Read on its asset. */
async function downloadKey(key: string, ctx: AgentOperationContext): Promise<AgentToolResult> {
  const userId = ctx.userId || ''
  const owningAssetId = await resolveAssetIdFromKey(key)
  await authzService.hasPermission({
    user: { id: userId } as User,
    permission: Permission.Read,
    type: ResourceType.Asset,
    id: owningAssetId,
  })
  await assertStorageKeyNotArchived(key)
  const filename = sanitizeFilename(path.basename(key)) || 'downloaded_file'
  const saved = await saveToRunner(key, filename, ctx)
  return {
    output: [
      {
        type: 'text',
        text: `Downloaded storage key "${key}" to "${saved.filePath}". Remember to delete this temporary file when finished.`,
      },
    ],
    details: { key, assetId: owningAssetId, ...saved },
  }
}

/** Saves each file of a download_asset result into the runner's .pi directory. */
export async function presentDownloadOutput(
  output: DownloadAssetOutput,
  ctx: AgentOperationContext,
): Promise<AgentToolResult> {
  const lines: string[] = []
  const files = []
  for (const file of output.files) {
    if (!file.key) throw new Error(`download_asset returned no storage key for ${file.assetId}`)
    const saved = await saveToRunner(
      file.key,
      `${file.assetId}_${sanitizeFilename(file.name) || 'file'}`,
      ctx,
    )
    lines.push(
      `Downloaded "${file.name}" (ID: ${file.assetId}, ${file.kind}, ${saved.contentType}, ${formatSize(saved.size)}) to "${saved.filePath}".`,
    )
    files.push({ assetId: file.assetId, name: file.name, kind: file.kind, ...saved })
  }
  lines.push(CLEANUP_REMINDER)
  return { output: [{ type: 'text', text: lines.join('\n') }], details: { files } }
}

const downloadAssetExtension: AgentToolExtension = {
  description:
    `Downloads up to ${MAX_DOWNLOAD_ASSETS} workspace files into the runner's .pi directory, for processing with local scripts or bash commands. ` +
    'By default it saves the web preview version (proxy) when there is one, e.g. the transcoded video or the web image; set proxy to false for the original uploaded file. ' +
    'A version stack downloads its latest version; folders are not supported. ' +
    'To download a specific artifact from read_asset (e.g. a frame or page), pass its storage key as "key" instead of assetIds. ' +
    'Remember to delete the downloaded files when finished.',
  parameterOverrides: z.object({
    assetIds: downloadAsset.input.shape.assetIds
      .optional()
      .describe(
        `IDs of the files or version stacks to download (1 to ${MAX_DOWNLOAD_ASSETS}). Omit when passing "key".`,
      ),
  }),
  extraParameters: z.object({
    key: z
      .string()
      .optional()
      .describe(
        'Storage S3 key of a specific media artifact to download instead of assetIds, e.g. a screenshot or page key from read_asset.',
      ),
  }),
  async intercept(input, extra, ctx) {
    if (typeof extra.key !== 'string') return undefined
    if (Array.isArray(input.assetIds) && input.assetIds.length > 0) {
      throw new Error('Provide either "assetIds" or "key", not both.')
    }
    if (!ctx.userId) throw new Error('User ID is required for authorization.')
    return downloadKey(extra.key, ctx)
  },
  present: (output, _extra, ctx) => presentDownloadOutput(output as DownloadAssetOutput, ctx),
}

registerAgentToolExtension('download_asset', downloadAssetExtension)
