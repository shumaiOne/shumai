import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { s3Service } from '../s3/s3'
import { isPartialVideoRange } from '../transcode/video-chunk-preview'
import { chunkKey, videoChunkPreviewService } from './video-chunk-preview'

describe('video chunk previews', () => {
  setupTestDbHooks()
  afterEach(() => vi.restoreAllMocks())

  it.each([
    [0, 45, 45, false],
    [0, 60, 60, false],
    [0, 60, 61, true],
    [55, 61, 61, true],
    [10, 20, 1200, true],
    [1, 1, 10, false],
  ])('classifies %d–%d seconds of a %d second asset', (startTime, endTime, duration, partial) => {
    expect(isPartialVideoRange({ startTime, endTime }, duration)).toBe(partial)
  })

  async function createVideo() {
    const team = await prisma.team.create({ data: { name: 'Preview team' } })
    const project = await prisma.project.create({ data: { name: 'Previews', teamId: team.id } })
    const asset = await prisma.asset.create({
      data: {
        name: 'montage.mp4',
        type: 'file',
        status: 'processed',
        mediaType: 'video/mp4',
        project: { connect: { id: project.id } },
        storageKey: { create: { key: 'files/montage/source.mp4' } },
        media: { duration: 1200 } as PrismaJson.MediaInfo,
      },
    })
    return asset
  }

  it('schedules one preview batch for the missing partial ranges and reuses pending work', async () => {
    const asset = await createVideo()
    const full = { startTime: 0, endTime: 1200 }
    const first = { startTime: 10, endTime: 20 }
    const second = { startTime: 15, endTime: 25 }
    expect(await videoChunkPreviewService.requestPreviews('missing', [first])).toEqual([])
    expect(await videoChunkPreviewService.requestPreviews(asset.id, [full])).toEqual([])

    const [one, two] = await Promise.all([
      videoChunkPreviewService.requestPreviews(asset.id, [first, second, full, first]),
      videoChunkPreviewService.requestPreviews(asset.id, [first, second]),
    ])
    expect(one).toHaveLength(1)
    expect(two).toEqual(one)
    const jobs = await prisma.workflowTask.findMany({
      where: { assetId: asset.id, type: 'transcode_video_chunk_preview' },
    })
    expect(jobs.map((job) => job.id)).toEqual(one)
    expect(jobs[0].payload?.videoChunkPreviewRanges).toEqual([first, second])
  })

  it('publishes only complete preview uploads and reuses the stored preview after a retry', async () => {
    const asset = await createVideo()
    const sourceKey = 'files/montage/source.mp4'
    const range = { assetId: asset.id, startTime: 10, endTime: 20 }
    const render = vi.fn().mockResolvedValue({
      sprite: Buffer.from('sprite'),
      poster: Buffer.from('poster'),
      timestamps: [10, 15],
      columns: 2,
      rows: 1,
      frameWidth: 320,
      frameHeight: 180,
    })
    const put = vi
      .spyOn(s3Service, 'putObject')
      .mockResolvedValue(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Upload failed'))
    const remove = vi.spyOn(s3Service, 'deleteObject').mockResolvedValue(1)
    await expect(
      videoChunkPreviewService.store(asset.id, sourceKey, [range], render),
    ).rejects.toThrow('Upload failed')
    expect(await videoChunkPreviewService.listReady([range])).toHaveProperty('size', 0)
    expect(remove).toHaveBeenCalledTimes(2)

    await videoChunkPreviewService.store(asset.id, sourceKey, [range], render)
    await videoChunkPreviewService.store(asset.id, sourceKey, [range], render)
    expect(render).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(4)
    const ready = await videoChunkPreviewService.listReady([range])
    expect(ready.get(chunkKey(range))).toMatchObject({ timestamps: [10, 15] })
    expect(await prisma.asset.findUnique({ where: { id: asset.id } })).toMatchObject({
      media: { duration: 1200, chunkPreviews: { '[10,20]': { timestamps: [10, 15] } } },
    })
    expect(await videoChunkPreviewService.requestPreviews(asset.id, [range])).toEqual([])
  })

  it('keeps the first published preview and cleans up overlapping uploads', async () => {
    const asset = await createVideo()
    const sourceKey = 'files/montage/source.mp4'
    const range = { startTime: 10, endTime: 20 }
    const rendered = {
      sprite: Buffer.from('sprite'),
      poster: Buffer.from('poster'),
      timestamps: [10, 15],
      columns: 2,
      rows: 1,
      frameWidth: 320,
      frameHeight: 180,
    }
    const put = vi.spyOn(s3Service, 'putObject').mockResolvedValue(undefined)
    const remove = vi.spyOn(s3Service, 'deleteObject').mockResolvedValue(1)
    let finishRender!: () => void
    const lateRender = vi.fn(
      () =>
        new Promise<typeof rendered>((resolve) => {
          finishRender = () => resolve(rendered)
        }),
    )

    const late = videoChunkPreviewService.store(asset.id, sourceKey, [range], lateRender)
    await vi.waitFor(() => expect(lateRender).toHaveBeenCalledTimes(1))
    await videoChunkPreviewService.store(asset.id, sourceKey, [range], async () => rendered)
    finishRender()
    await late

    const updated = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(updated.media?.chunkPreviews?.['[10,20]']).toMatchObject({
      posterKey: put.mock.calls[0][1],
      spriteKey: put.mock.calls[1][1],
    })
    expect(remove.mock.calls.map(([, key]) => key)).toEqual([
      put.mock.calls[2][1],
      put.mock.calls[3][1],
    ])
  })
})
