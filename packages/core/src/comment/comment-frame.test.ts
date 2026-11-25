import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma, AssetType, AssetStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { s3Service } from '@shumai/core/src/s3/s3'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { assetService } from '@shumai/core/src/asset/asset'
import {
  CommentFrameService,
  FrameExtractionQueue,
  selectBestVideoProxyKey,
  type ExecFileFn,
} from './comment-frame'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'

async function createSamplePngBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 32,
      height: 18,
      channels: 3,
      background: { r: 20, g: 120, b: 220 },
    },
  })
    .png()
    .toBuffer()
}

async function createSampleWebpBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 32,
      height: 18,
      channels: 3,
      background: { r: 220, g: 80, b: 40 },
    },
  })
    .webp()
    .toBuffer()
}

describe('FrameExtractionQueue', () => {
  it('enforces maxConcurrency and processes queued tasks in FIFO order', async () => {
    const queue = new FrameExtractionQueue(2)
    let active = 0
    let maxObserved = 0
    const order: number[] = []
    const resolvers: Array<() => void> = []

    const makeTask = (id: number) =>
      queue.enqueue(async () => {
        active++
        maxObserved = Math.max(maxObserved, active)
        order.push(id)
        await new Promise<void>((resolve) => resolvers.push(resolve))
        active--
        return id
      })

    const p1 = makeTask(1)
    const p2 = makeTask(2)
    const p3 = makeTask(3)
    const p4 = makeTask(4)

    expect(queue.activeCount).toBe(2)
    expect(queue.queuedCount).toBe(2)
    expect(maxObserved).toBe(2)

    resolvers.shift()?.()
    await p1
    expect(queue.activeCount).toBe(2)
    expect(queue.queuedCount).toBe(1)

    resolvers.shift()?.()
    await p2
    expect(queue.activeCount).toBe(2)
    expect(queue.queuedCount).toBe(0)

    resolvers.shift()?.()
    await p3
    resolvers.shift()?.()
    await p4

    expect(order).toEqual([1, 2, 3, 4])
    expect(maxObserved).toBe(2)
    expect(queue.activeCount).toBe(0)
    expect(queue.queuedCount).toBe(0)
  })

  it('cancels queued tasks when their AbortSignal fires before execution', async () => {
    const queue = new FrameExtractionQueue(1)
    let releaseFirst!: () => void
    const first = queue.enqueue(
      () =>
        new Promise<string>((resolve) => {
          releaseFirst = () => resolve('first')
        }),
    )

    const controller = new AbortController()
    const runSecond = vi.fn().mockResolvedValue('second')
    const second = queue.enqueue(runSecond, controller.signal)

    expect(queue.queuedCount).toBe(1)
    controller.abort()

    await expect(second).rejects.toThrow('Frame extraction aborted')
    expect(queue.queuedCount).toBe(0)
    expect(runSecond).not.toHaveBeenCalled()

    releaseFirst()
    await expect(first).resolves.toBe('first')
  })
})

describe('selectBestVideoProxyKey', () => {
  it('prefers SDR proxies over HDR and chooses lowest adequate resolution >= 360p', () => {
    const key = selectBestVideoProxyKey([
      { key: 'hdr-720.mp4', width: 1280, height: 720, hdr: true, resolution: '720p' },
      { key: 'sdr-1080.mp4', width: 1920, height: 1080, hdr: false, resolution: '1080p' },
      { key: 'sdr-540.mp4', width: 960, height: 540, hdr: false, resolution: '540p' },
      { key: 'sdr-240.mp4', width: 426, height: 240, hdr: false, resolution: '240p' },
    ])
    expect(key).toBe('sdr-540.mp4')
  })

  it('falls back to highest available SDR proxy if all are below 360p', () => {
    const key = selectBestVideoProxyKey([
      { key: 'sdr-180.mp4', width: 320, height: 180, hdr: false, resolution: '180p' },
      { key: 'sdr-240.mp4', width: 426, height: 240, hdr: false, resolution: '240p' },
    ])
    expect(key).toBe('sdr-240.mp4')
  })

  it('falls back to HDR proxy if no SDR proxy exists', () => {
    const key = selectBestVideoProxyKey([
      { key: 'hdr-1080.mp4', width: 1920, height: 1080, hdr: true, resolution: '1080p' },
      { key: 'hdr-720.mp4', width: 1280, height: 720, hdr: true, resolution: '720p' },
    ])
    expect(key).toBe('hdr-720.mp4')
  })

  it('returns null when no valid keys exist', () => {
    expect(selectBestVideoProxyKey([])).toBeNull()
    expect(selectBestVideoProxyKey(null)).toBeNull()
  })
})

describe('CommentFrameService & AssetService print helpers', () => {
  setupTestDbHooks()

  let userId: string
  let teamId: string
  let projectId: string
  let rootFolderId: string
  let subFolderId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Alice',
        email: `alice-${Date.now()}-${Math.random()}@example.com`,
      },
    })
    userId = user.id

    const team = await prisma.team.create({
      data: {
        name: 'Studio Team',
      },
    })
    teamId = team.id

    const rootFolder = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.root,
        status: AssetStatus.processed,
        creatorId: userId,
      },
    })
    rootFolderId = rootFolder.id

    const project = await prisma.project.create({
      data: {
        name: 'Commercial Cut',
        teamId,
        rootFolderId,
      },
    })
    projectId = project.id

    await prisma.asset.update({
      where: { id: rootFolderId },
      data: { projectId },
    })

    const subFolder = await prisma.asset.create({
      data: {
        name: 'Dailies',
        type: AssetType.folder,
        status: AssetStatus.processed,
        projectId,
        parentId: rootFolderId,
        creatorId: userId,
      },
    })
    subFolderId = subFolder.id
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts a video frame using the lowest adequate SDR proxy and deduplicates concurrent requests', async () => {
    const webpBuffer = await createSampleWebpBuffer()
    const storageKey = await prisma.storageKey.create({
      data: { key: 'files/video-original.mp4' },
    })
    const videoAsset = await prisma.asset.create({
      data: {
        name: 'scene1.mp4',
        type: AssetType.file,
        status: AssetStatus.processed,
        mediaType: 'video/mp4',
        projectId,
        parentId: subFolderId,
        creatorId: userId,
        storageKeyId: storageKey.id,
        media: {
          proxyType: 'video',
          duration: 10,
          filesize: 1000,
          frames: 240,
          imageTranscodes: [],
          videoTranscodes: [
            { key: 'files/proxies/1080p.mp4', width: 1920, height: 1080, hdr: false },
            { key: 'files/proxies/540p.mp4', width: 960, height: 540, hdr: false },
            { key: 'files/proxies/720p-hdr.mp4', width: 1280, height: 720, hdr: true },
          ],
          finishedAt: new Date().toISOString(),
          metadata: null,
          original: null,
        },
      },
    })

    const resolveInputSpy = vi
      .spyOn(s3Service, 'resolveInput')
      .mockResolvedValue('/local/files/proxies/540p.mp4')

    let releaseExec!: () => void
    const execFileMock = vi.fn<ExecFileFn>(async (_file, args) => {
      await new Promise<void>((resolve) => {
        releaseExec = resolve
      })
      const outPath = args[args.length - 1]
      fs.writeFileSync(outPath, webpBuffer)
      return { stdout: '', stderr: '' }
    })

    const service = new CommentFrameService({ maxConcurrency: 2, execFileFn: execFileMock })

    const p1 = service.extractFrame({ assetId: videoAsset.id, second: 2.5, width: 400 })
    const p2 = service.extractFrame({ assetId: videoAsset.id, second: 2.5, width: 400 })

    // Let async DB lookup finish before releasing exec
    await vi.waitFor(() => expect(execFileMock).toHaveBeenCalledTimes(1))
    releaseExec()

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.mimeType).toBe('image/webp')
    expect(r1.buffer.equals(webpBuffer)).toBe(true)
    expect(r2.buffer.equals(webpBuffer)).toBe(true)
    expect(execFileMock).toHaveBeenCalledTimes(1)
    expect(resolveInputSpy).toHaveBeenCalledWith(expect.any(String), 'files/proxies/540p.mp4')
  })

  it('extracts a 3D model turntable frame and enforces watermark-only proxies when watermarkConfigId is set', async () => {
    const webpBuffer = await createSampleWebpBuffer()
    const storageKey = await prisma.storageKey.create({
      data: { key: 'files/chair.glb' },
    })
    const modelAsset = await prisma.asset.create({
      data: {
        name: 'chair.glb',
        type: AssetType.file,
        status: AssetStatus.processed,
        mediaType: 'model/gltf-binary',
        projectId,
        parentId: subFolderId,
        creatorId: userId,
        storageKeyId: storageKey.id,
        media: {
          proxyType: '3d',
          duration: 24,
          filesize: 2000,
          frames: 24,
          imageTranscodes: [],
          videoTranscodes: [{ key: 'files/proxies/turntable.mp4', width: 1024, height: 1024 }],
          finishedAt: new Date().toISOString(),
          metadata: null,
          original: null,
        },
      },
    })

    const watermarkSpy = vi
      .spyOn(watermarkService, 'getCompletedWatermarkMediaMap')
      .mockResolvedValueOnce(
        new Map([
          [
            modelAsset.id,
            {
              proxyType: '3d',
              duration: 24,
              filesize: 2000,
              frames: 24,
              imageTranscodes: [],
              videoTranscodes: [{ key: 'files/wm/turntable-wm.mp4', width: 1024, height: 1024 }],
              finishedAt: new Date().toISOString(),
              metadata: null,
              original: null,
            },
          ],
        ]),
      )
      .mockResolvedValueOnce(new Map())

    const resolveInputSpy = vi
      .spyOn(s3Service, 'resolveInput')
      .mockResolvedValue('/local/files/wm/turntable-wm.mp4')

    const execFileMock = vi.fn<ExecFileFn>(async (_file, args) => {
      const outPath = args[args.length - 1]
      fs.writeFileSync(outPath, webpBuffer)
      return { stdout: '', stderr: '' }
    })

    const service = new CommentFrameService({ execFileFn: execFileMock })

    const res = await service.extractFrame({
      assetId: modelAsset.id,
      second: 3,
      width: 400,
      watermarkConfigId: 'wm-cfg-1',
    })
    expect(res.mimeType).toBe('image/webp')
    expect(watermarkSpy).toHaveBeenCalledWith([modelAsset.id], 'wm-cfg-1')
    expect(resolveInputSpy).toHaveBeenCalledWith(expect.any(String), 'files/wm/turntable-wm.mp4')

    // Missing watermark proxy must reject with 422 rather than leaking unwatermarked media
    await expect(
      service.extractFrame({
        assetId: modelAsset.id,
        second: 3,
        width: 400,
        watermarkConfigId: 'wm-cfg-2',
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('renders a PDF page frame via pdftoppm and sharp', async () => {
    const samplePng = await createSamplePngBuffer()
    const storageKey = await prisma.storageKey.create({
      data: { key: 'files/deck.pdf' },
    })
    const pdfAsset = await prisma.asset.create({
      data: {
        name: 'deck.pdf',
        type: AssetType.file,
        status: AssetStatus.processed,
        mediaType: 'application/pdf',
        projectId,
        parentId: subFolderId,
        creatorId: userId,
        storageKeyId: storageKey.id,
        media: {
          proxyType: 'pdf',
          duration: 0,
          filesize: 5000,
          frames: 5,
          imageTranscodes: [],
          videoTranscodes: [],
          pdfTranscode: { key: 'files/proxies/deck.pdf' },
          finishedAt: new Date().toISOString(),
          metadata: null,
          original: null,
        },
      },
    })

    const downloadSpy = vi
      .spyOn(s3Service, 'downloadToFile')
      .mockImplementation(async (_bucket, _key, dest) => {
        fs.writeFileSync(dest, '%PDF-1.4 mock')
      })

    const execFileMock = vi.fn<ExecFileFn>(async (file, args) => {
      expect(file).toBe('pdftoppm')
      expect(args).toContain('-f')
      expect(args).toContain('3')
      const prefix = args[args.length - 1]
      fs.writeFileSync(`${prefix}-3.png`, samplePng)
      return { stdout: '', stderr: '' }
    })

    const service = new CommentFrameService({ execFileFn: execFileMock })
    const res = await service.extractFrame({ assetId: pdfAsset.id, second: 3, width: 400 })
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.any(String),
      'files/proxies/deck.pdf',
      expect.stringContaining(path.sep),
    )
    expect(res.mimeType).toBe('image/webp')
    expect(res.buffer.length).toBeGreaterThan(0)
  })

  it('rejects unsupported asset types with 400 and archived assets without proxy with 422', async () => {
    const imgKey = await prisma.storageKey.create({
      data: { key: 'files/photo.png' },
    })
    const imageAsset = await prisma.asset.create({
      data: {
        name: 'photo.png',
        type: AssetType.file,
        status: AssetStatus.processed,
        mediaType: 'image/png',
        projectId,
        parentId: subFolderId,
        creatorId: userId,
        storageKeyId: imgKey.id,
        media: {
          proxyType: 'image',
          duration: 0,
          filesize: 100,
          frames: 1,
          imageTranscodes: [],
          videoTranscodes: [],
          finishedAt: new Date().toISOString(),
          metadata: null,
          original: null,
        },
      },
    })

    const archivedKey = await prisma.storageKey.create({
      data: { key: 'files/archived.mp4', isArchived: true },
    })
    const archivedVideo = await prisma.asset.create({
      data: {
        name: 'archived.mp4',
        type: AssetType.file,
        status: AssetStatus.archived,
        mediaType: 'video/mp4',
        projectId,
        parentId: subFolderId,
        creatorId: userId,
        storageKeyId: archivedKey.id,
      },
    })

    const service = new CommentFrameService()
    await expect(service.extractFrame({ assetId: imageAsset.id, second: 0 })).rejects.toMatchObject(
      { status: 400 },
    )
    await expect(
      service.extractFrame({ assetId: archivedVideo.id, second: 1 }),
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      service.extractFrame({ assetId: 'non-existent-id', second: 0 }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lists all comments with replies, reactions, completion status, and fetches project name', async () => {
    vi.spyOn(s3Service, 'presign').mockResolvedValue('http://mock-s3/file')

    const storageKey = await prisma.storageKey.create({
      data: { key: 'files/cut.mp4' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'cut.mp4',
        type: AssetType.file,
        status: AssetStatus.processed,
        mediaType: 'video/mp4',
        projectId,
        parentId: subFolderId,
        creatorId: userId,
        storageKeyId: storageKey.id,
      },
    })

    const parent = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        creatorId: userId,
        message: 'Check lighting',
        second: 1.5,
        isCompleted: true,
        completionLastChangedById: userId,
      },
    })
    await prisma.assetCommentReaction.create({
      data: { commentId: parent.id, userId, code: '👍' },
    })
    await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        creatorId: userId,
        replyToId: parent.id,
        message: 'Fixed in v2',
      },
    })

    const allComments = await assetService.listAllComments(asset.id, userId)
    expect(allComments).toHaveLength(1)
    expect(allComments[0].message).toBe('Check lighting')
    expect(allComments[0].isCompleted).toBe(true)
    expect(allComments[0].reactionCounts).toEqual([
      expect.objectContaining({ code: '👍', count: 1, requestingUserReacted: true }),
    ])
    expect(allComments[0].replies).toHaveLength(1)
    expect(allComments[0].replies[0].message).toBe('Fixed in v2')

    const projectName = await assetService.getProjectNameForAsset(asset.id)
    expect(projectName).toBe('Commercial Cut')
  })
})
