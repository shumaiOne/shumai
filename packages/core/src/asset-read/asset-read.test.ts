import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AssetType,
  prisma,
  WorkflowTaskStatus,
  WorkflowTaskType,
  type Prisma,
  type User,
} from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService } from '@shumai/workflow-core'
import { projectService } from '@shumai/core/src/project/project'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getAssetRenderOp, readAssetOp, runOperation } from '@shumai/core/src/operations'
import type { OperationContext } from '@shumai/core/src/operations'
import { assetReadService, READ_URL_EXPIRES_SECONDS, toAssetReadOutput } from './asset-read'

describe('AssetReadService', () => {
  setupTestDbHooks()

  let owner: User
  let reviewer: User
  let outsider: User
  let teamId: string
  let projectId: string
  let rootFolderId: string

  const user = (u: User) => ({ kind: 'user' as const, userId: u.id })
  const now = { waitBudgetMs: 0 }

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'read-owner@test.com', password: 'pw' },
    })
    reviewer = await prisma.user.create({
      data: { name: 'Reviewer', email: 'read-reviewer@test.com', password: 'pw' },
    })
    outsider = await prisma.user.create({
      data: { name: 'Outsider', email: 'read-outsider@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Read Team' } })
    teamId = team.id
    await prisma.teamMember.create({ data: { teamId, userId: owner.id, role: 'owner' } })
    await prisma.teamMember.create({ data: { teamId, userId: reviewer.id, role: 'reviewer' } })
    const project = await projectService.createProject(owner, { teamId, name: 'Read Project' })
    projectId = project.id
    rootFolderId = project.rootFolder!

    vi.spyOn(s3Service, 'presign').mockImplementation(
      async (_bucket, key) => `https://signed.example/${key}`,
    )
    vi.spyOn(s3Service, 'getObject').mockImplementation(async (_bucket, key) => ({
      buffer: Buffer.from(`content of ${key}`),
      contentType: 'text/plain',
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function createFile(
    name: string,
    data: Partial<Prisma.AssetUncheckedCreateInput> & { key?: string } = {},
  ) {
    const { key, ...rest } = data
    const storageKey = key ? await prisma.storageKey.create({ data: { key } }) : null
    return prisma.asset.create({
      data: {
        name,
        type: AssetType.file,
        status: 'uploaded',
        projectId,
        parentId: rootFolderId,
        storageKeyId: storageKey?.id,
        ...rest,
      },
    })
  }

  const imageMedia = {
    proxyType: 'image',
    imageTranscodes: [{ key: 'proxy/photo.webp' }],
  } as unknown as PrismaJson.MediaInfo

  async function createVideo() {
    return createFile('clip.mp4', {
      mediaType: 'video/mp4',
      media: { proxyType: 'video' } as unknown as PrismaJson.MediaInfo,
      key: 'raw/clip.mp4',
    })
  }

  describe('access', () => {
    it('lets a reviewer read an image without creating a render task', async () => {
      const image = await createFile('photo.png', { mediaType: 'image/png', media: imageMedia })

      const outcome = await assetReadService.read(user(reviewer), { assetId: image.id }, now)

      expect(outcome).toMatchObject({
        status: 'ready',
        kind: 'image',
        asset: { id: image.id, name: 'photo.png' },
        result: {
          summary: `Image asset "photo.png" (ID: ${image.id}):`,
          images: [{ key: 'proxy/photo.webp', label: 'Image', mimeType: 'image/webp' }],
        },
      })
      expect(await prisma.workflowTask.count({ where: { assetId: image.id } })).toBe(0)
    })

    it('rejects users without Read access before creating anything', async () => {
      const video = await createVideo()
      await expect(
        assetReadService.read(
          user(outsider),
          { assetId: video.id, videoConfig: { start: 0, end: 1, count: 1 } },
          now,
        ),
      ).rejects.toMatchObject({ status: 403 })
      expect(await prisma.workflowTask.count({ where: { assetId: video.id } })).toBe(0)
    })

    it('confines the autofill agent to its team and target asset', async () => {
      const image = await createFile('photo.png', { mediaType: 'image/png', media: imageMedia })
      const other = await createFile('other.png', { mediaType: 'image/png', media: imageMedia })

      const ok = await assetReadService.read(
        { kind: 'autofill', teamId, targetAssetId: image.id },
        { assetId: image.id },
        now,
      )
      expect(ok.status).toBe('ready')

      await expect(
        assetReadService.read(
          { kind: 'autofill', teamId, targetAssetId: image.id },
          { assetId: other.id },
          now,
        ),
      ).rejects.toThrow(`autofill agent can only read target asset ${image.id}`)
      await expect(
        assetReadService.read(
          { kind: 'autofill', teamId: 'another-team', targetAssetId: image.id },
          { assetId: image.id },
          now,
        ),
      ).rejects.toThrow(`does not belong to team another-team`)
    })
  })

  it('reads the latest version of a version stack', async () => {
    const stack = await prisma.asset.create({
      data: {
        name: 'diagram',
        type: AssetType.version_stack,
        status: 'uploaded',
        projectId,
        parentId: rootFolderId,
      },
    })
    await createFile('diagram_v1.png', {
      parentId: stack.id,
      sortIndex: 'b',
      mediaType: 'image/png',
      key: 'raw/v1.png',
    })
    const v2 = await createFile('diagram_v2.png', {
      parentId: stack.id,
      sortIndex: 'a',
      mediaType: 'image/png',
      key: 'raw/v2.png',
    })

    const outcome = await assetReadService.read(user(owner), { assetId: stack.id }, now)
    expect(outcome.asset.id).toBe(v2.id)
    expect(outcome.status === 'ready' && outcome.result.images[0].key).toBe('raw/v2.png')
  })

  describe('reader selection and options', () => {
    it.each([
      ['model.glb', 'model/gltf-binary', 'model3d'],
      ['photo.psd', 'image/vnd.adobe.photoshop', 'image'],
      ['clip.mov', 'video/quicktime', 'video'],
      ['doc.pdf', 'application/pdf', 'document'],
      ['notes.md', 'text/markdown', 'document'],
      ['script.ts', null, 'document'],
    ])('reads %s with the %s reader', async (name, mediaType, kind) => {
      const asset = await createFile(name, { mediaType, key: `raw/${name}` })
      // An empty-object config of the wrong type is ignored; the error names the right reader.
      const error = await assetReadService
        .read(user(owner), { assetId: asset.id, imageConfig: {}, config3d: { degree: 7 } }, now)
        .catch((err: unknown) => err)
      if (kind === 'model3d') {
        expect(error).toMatchObject({
          message: expect.stringContaining('Invalid turntable degree'),
        })
      } else {
        expect(error).toMatchObject({
          status: 400,
          message: expect.stringContaining(`Asset ${asset.id} is a`),
        })
        expect((error as Error).message).toContain('do not pass config3d')
      }
    })

    it('rejects unsupported files', async () => {
      const zip = await createFile('bundle.zip', { mediaType: 'application/zip' })
      await expect(assetReadService.read(user(owner), { assetId: zip.id }, now)).rejects.toThrow(
        'Unsupported asset type for read_asset',
      )
    })

    it('reads text content and reports truncation', async () => {
      const doc = await createFile('notes.md', { mediaType: 'text/markdown', key: 'raw/notes.md' })
      const outcome = await assetReadService.read(
        user(owner),
        { assetId: doc.id, docConfig: { mode: 'text' } },
        now,
      )
      expect(outcome).toMatchObject({
        status: 'ready',
        kind: 'document',
        result: {
          images: [],
          text: {
            content: 'content of raw/notes.md',
            truncated: false,
            size: 'content of raw/notes.md'.length,
            key: 'raw/notes.md',
            mimeType: 'text/markdown',
          },
        },
      })
    })

    it('skips reading text when includeContent is false', async () => {
      const doc = await createFile('notes.md', { mediaType: 'text/markdown', key: 'raw/notes.md' })
      const outcome = await assetReadService.read(
        user(owner),
        { assetId: doc.id, docConfig: { mode: 'text' }, includeContent: false },
        now,
      )
      expect(s3Service.getObject).not.toHaveBeenCalled()
      expect(outcome.status === 'ready' && outcome.result.text?.content).toBe('')
    })
  })

  describe('render tasks', () => {
    it('stores the read request on the task and returns pending when the budget runs out', async () => {
      const video = await createVideo()
      const outcome = await assetReadService.read(
        user(reviewer),
        { assetId: video.id, videoConfig: { start: 0, end: 4, count: 2 } },
        now,
      )

      expect(outcome).toMatchObject({ status: 'pending', kind: 'video', retryAfterSeconds: 5 })
      const taskId = outcome.status === 'pending' ? outcome.taskId : ''
      const task = await prisma.workflowTask.findUniqueOrThrow({ where: { id: taskId } })
      expect(task).toMatchObject({
        assetId: video.id,
        projectId,
        type: WorkflowTaskType.transcode_screenshot,
        status: WorkflowTaskStatus.pending,
      })
      expect(task.payload).toEqual({
        projectId,
        screenshot: { start: 0, end: 4, count: 2, commentTimestamp: null, annotations: null },
        assetRead: {
          reader: 'video',
          options: { start: 0, end: 4, count: 2 },
          requestedBy: reviewer.id,
        },
      })
    })

    it('overlays annotations from a comment on the image', async () => {
      const image = await createFile('photo.png', { mediaType: 'image/png', media: imageMedia })
      const annotation = [
        {
          type: 'box',
          color: '#ff0000',
          points: [
            [0, 0],
            [10, 10],
          ],
        },
      ] as unknown as PrismaJson.AnnotationList
      const comment = await prisma.assetComment.create({
        data: { assetId: image.id, creatorId: owner.id, message: 'here', annotation },
      })

      const outcome = await assetReadService.read(
        user(owner),
        { assetId: image.id, annotationId: comment.id },
        now,
      )

      expect(outcome).toMatchObject({ status: 'pending', kind: 'image', retryAfterSeconds: 3 })
      const task = await prisma.workflowTask.findFirstOrThrow({ where: { assetId: image.id } })
      expect(task.type).toBe(WorkflowTaskType.transcode_image_annotation)
      expect(task.payload?.imageAnnotation).toEqual({ annotations: annotation })
      expect(task.payload?.assetRead).toMatchObject({ reader: 'image', annotationId: comment.id })
    })

    it('rejects annotations from another asset', async () => {
      const image = await createFile('photo.png', { mediaType: 'image/png', media: imageMedia })
      const other = await createFile('other.png', { mediaType: 'image/png', media: imageMedia })
      const comment = await prisma.assetComment.create({
        data: { assetId: other.id, creatorId: owner.id, message: 'elsewhere' },
      })
      await expect(
        assetReadService.read(user(owner), { assetId: image.id, annotationId: comment.id }, now),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('stores reader context for 3D angles and collects it later', async () => {
      const model = await createFile('robot.glb', {
        mediaType: 'model/gltf-binary',
        media: {
          proxyType: '3d',
          videoTranscodes: [{ key: 'proxy/turntable.mp4' }],
        } as unknown as PrismaJson.MediaInfo,
      })
      const pending = await assetReadService.read(
        user(owner),
        { assetId: model.id, config3d: { degree: 90 } },
        now,
      )
      const taskId = pending.status === 'pending' ? pending.taskId : ''
      const task = await prisma.workflowTask.findUniqueOrThrow({ where: { id: taskId } })
      expect(task.payload?.assetRead?.context).toEqual({ degree: 90, hasMarkup: false })

      await prisma.workflowTask.update({
        where: { id: taskId },
        data: {
          status: WorkflowTaskStatus.completed,
          output: { screenshots: [{ key: 'shots/90.webp', timestamp: 1 }] },
        },
      })
      const ready = await assetReadService.getRender(owner.id, taskId, now)
      expect(ready).toMatchObject({
        status: 'ready',
        kind: 'model3d',
        result: {
          summary: `3D asset "robot.glb" (ID: ${model.id}) view at 90°:`,
          images: [{ key: 'shots/90.webp', label: 'View at 90°' }],
        },
      })
    })
  })

  describe('getRender', () => {
    async function pendingVideoRead(by: User) {
      const video = await createVideo()
      const outcome = await assetReadService.read(
        user(by),
        { assetId: video.id, videoConfig: { start: 0, end: 4, count: 2 } },
        now,
      )
      if (outcome.status !== 'pending') throw new Error('expected pending')
      return { video, taskId: outcome.taskId }
    }

    it('stays pending until the task completes, then returns the frames', async () => {
      const { taskId } = await pendingVideoRead(reviewer)

      expect(await assetReadService.getRender(reviewer.id, taskId, now)).toMatchObject({
        status: 'pending',
        taskId,
      })

      await prisma.workflowTask.update({
        where: { id: taskId },
        data: {
          status: WorkflowTaskStatus.completed,
          output: {
            screenshots: [
              { key: 'shots/0.webp', timestamp: 0 },
              { key: 'shots/4.webp', timestamp: 4 },
            ],
          },
        },
      })

      const ready = await assetReadService.getRender(reviewer.id, taskId, now)
      expect(ready).toMatchObject({
        status: 'ready',
        result: {
          summary: 'Extracted 2 frame(s) from "clip.mp4" (0s - 4s):',
          images: [
            { key: 'shots/0.webp', label: 'Frame at 0s', mimeType: 'image/webp' },
            { key: 'shots/4.webp', label: 'Frame at 4s', mimeType: 'image/webp' },
          ],
        },
      })
    })

    it('surfaces a failed render', async () => {
      const { taskId } = await pendingVideoRead(owner)
      await prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: WorkflowTaskStatus.failed, output: { error: 'ffmpeg exploded' } },
      })
      await expect(assetReadService.getRender(owner.id, taskId, now)).rejects.toThrow(
        'ffmpeg exploded',
      )
    })

    it('returns 404 to anyone but the requester', async () => {
      const { taskId } = await pendingVideoRead(reviewer)
      await expect(assetReadService.getRender(owner.id, taskId, now)).rejects.toMatchObject({
        status: 404,
        message: 'Render not found',
      })
    })

    it('returns 404 once the requester loses access', async () => {
      const { taskId } = await pendingVideoRead(reviewer)
      await prisma.teamMember.deleteMany({ where: { userId: reviewer.id } })
      await expect(assetReadService.getRender(reviewer.id, taskId, now)).rejects.toMatchObject({
        status: 404,
      })
    })

    it('returns 404 for unknown tasks and tasks that are not asset reads', async () => {
      const video = await createVideo()
      const other = await prisma.workflowTask.create({
        data: {
          assetId: video.id,
          projectId,
          type: WorkflowTaskType.transcode_video,
          status: WorkflowTaskStatus.completed,
          payload: { projectId },
        },
      })
      await expect(assetReadService.getRender(owner.id, other.id, now)).rejects.toMatchObject({
        status: 404,
      })
      await expect(assetReadService.getRender(owner.id, 'nope', now)).rejects.toMatchObject({
        status: 404,
      })
    })
  })

  describe('toAssetReadOutput', () => {
    it('returns short-lived links and only includes storage keys when asked', async () => {
      const image = await createFile('photo.png', { mediaType: 'image/png', media: imageMedia })
      const outcome = await assetReadService.read(user(owner), { assetId: image.id }, now)

      const external = await toAssetReadOutput(outcome, { includeKeys: false })
      expect(external.images).toEqual([
        { label: 'Image', mimeType: 'image/webp', url: 'https://signed.example/proxy/photo.webp' },
      ])
      expect(s3Service.presign).toHaveBeenCalledWith(
        expect.any(String),
        'proxy/photo.webp',
        'GET',
        false,
        undefined,
        false,
        READ_URL_EXPIRES_SECONDS,
      )

      const internal = await toAssetReadOutput(outcome, { includeKeys: true })
      expect(internal.images[0].key).toBe('proxy/photo.webp')
    })

    it('hides the text storage key and link from external callers', async () => {
      const doc = await createFile('notes.md', { mediaType: 'text/markdown', key: 'raw/notes.md' })
      const outcome = await assetReadService.read(
        user(owner),
        { assetId: doc.id, docConfig: { mode: 'text' } },
        now,
      )
      const external = await toAssetReadOutput(outcome, { includeKeys: false })
      expect(external.text).toEqual({
        content: 'content of raw/notes.md',
        truncated: false,
        size: 23,
        mimeType: 'text/markdown',
      })
      const internal = await toAssetReadOutput(outcome, { includeKeys: true })
      expect(internal.text).toMatchObject({
        key: 'raw/notes.md',
        url: 'https://signed.example/raw/notes.md',
      })
    })
  })
})

describe('read_asset and get_asset_render Operations', () => {
  setupTestDbHooks()

  let owner: User
  let videoId: string
  let imageId: string

  const as = (via: OperationContext['via']): OperationContext => ({ userId: owner.id, via })

  beforeEach(async () => {
    owner = await prisma.user.create({
      data: { name: 'Owner', email: 'read-op-owner@test.com', password: 'pw' },
    })
    const team = await prisma.team.create({ data: { name: 'Read Op Team' } })
    await prisma.teamMember.create({ data: { teamId: team.id, userId: owner.id, role: 'owner' } })
    const project = await projectService.createProject(owner, {
      teamId: team.id,
      name: 'Read Op Project',
    })
    const base = {
      type: AssetType.file,
      status: 'uploaded' as const,
      projectId: project.id,
      parentId: project.rootFolder!,
    }
    videoId = (
      await prisma.asset.create({
        data: {
          ...base,
          name: 'clip.mp4',
          mediaType: 'video/mp4',
          media: { proxyType: 'video' } as unknown as PrismaJson.MediaInfo,
        },
      })
    ).id
    imageId = (
      await prisma.asset.create({
        data: {
          ...base,
          name: 'photo.png',
          mediaType: 'image/png',
          media: {
            proxyType: 'image',
            imageTranscodes: [{ key: 'proxy/photo.webp' }],
          } as unknown as PrismaJson.MediaInfo,
        },
      })
    ).id
    vi.spyOn(s3Service, 'presign').mockResolvedValue('https://signed.example/x')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['agent', true],
    ['mcp', false],
    ['cli', false],
    ['api', false],
  ] as const)('via %s includes storage keys: %s', async (via, includesKey) => {
    const output = await runOperation(readAssetOp, as(via), { assetId: imageId })
    expect(output.status).toBe('ready')
    expect(output.images[0].url).toBe('https://signed.example/x')
    expect('key' in output.images[0]).toBe(includesKey)
  })

  it.each([
    ['agent', undefined, 60_000],
    ['mcp', undefined, 20_000],
    ['cli', undefined, 120_000],
    ['api', undefined, 20_000],
    ['cli', 5, 5_000],
    ['mcp', 600, 20_000],
    ['agent', 0, 0],
  ] as const)('via %s with maxWaitSeconds %s waits %sms', async (via, maxWaitSeconds, budget) => {
    const waitFor = vi
      .spyOn(workflowService, 'waitFor')
      .mockImplementation(async (task) => ({ task, done: false }))

    const output = await runOperation(readAssetOp, as(via), {
      assetId: videoId,
      videoConfig: { start: 0, end: 1, count: 1 },
      maxWaitSeconds,
    })
    expect(waitFor).toHaveBeenCalledWith(expect.anything(), budget)
    expect(output).toMatchObject({
      status: 'pending',
      summary: 'Rendering is still in progress for "clip.mp4".',
      asset: { id: videoId, kind: 'video' },
      images: [],
      taskId: expect.any(String),
      retryAfterSeconds: 5,
    })

    await runOperation(getAssetRenderOp, as(via), { taskId: output.taskId!, maxWaitSeconds })
    expect(waitFor).toHaveBeenLastCalledWith(expect.anything(), budget)
  })

  it('rejects invalid input before touching the asset', async () => {
    await expect(
      runOperation(readAssetOp, as('mcp'), {
        assetId: videoId,
        videoConfig: { start: 0, end: 1 },
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(await prisma.workflowTask.count({ where: { assetId: videoId } })).toBe(0)
  })
})
