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

  async function createMatches() {
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
    const match = await prisma.assetEmbedding.create({
      data: { assetId: asset.id, startTime: 10, endTime: 20 },
    })
    const full = await prisma.assetEmbedding.create({
      data: { assetId: asset.id, startTime: 0, endTime: 1200 },
    })
    return { asset, match, full }
  }

  it('only enqueues a job for a partial match belonging to the requested video', async () => {
    const { asset, match, full } = await createMatches()
    await expect(
      videoChunkPreviewService.getForMatch('other-asset', match.id, true),
    ).rejects.toMatchObject({ status: 404 })
    await expect(videoChunkPreviewService.getForMatch(asset.id, full.id, true)).resolves.toEqual({
      status: 'unavailable',
    })
    await expect(videoChunkPreviewService.getForMatch(asset.id, match.id, false)).resolves.toEqual({
      status: 'unavailable',
    })
    expect(await prisma.workflowTask.count({ where: { assetId: asset.id } })).toBe(0)

    for (const request of [true, true, false]) {
      expect(await videoChunkPreviewService.getForMatch(asset.id, match.id, request)).toEqual({
        status: 'pending',
      })
    }
    expect(
      await prisma.workflowTask.count({
        where: { assetId: asset.id, type: 'transcode_video_chunk_preview' },
      }),
    ).toBe(1)
  })

  it('publishes only complete preview uploads and reuses the stored preview after a retry', async () => {
    const { asset } = await createMatches()
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
    await expect(videoChunkPreviewService.store(range, sourceKey, render)).rejects.toThrow(
      'Upload failed',
    )
    expect(await videoChunkPreviewService.listReady([range])).toHaveProperty('size', 0)
    expect(remove).toHaveBeenCalledTimes(2)

    await videoChunkPreviewService.store(range, sourceKey, render)
    await videoChunkPreviewService.store(range, sourceKey, render)
    expect(render).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(4)
    const ready = await videoChunkPreviewService.listReady([range])
    expect(ready.get(chunkKey(range))).toMatchObject({ timestamps: [10, 15] })
  })
})
