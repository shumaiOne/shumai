import {
  videoChunkPreviewService,
  getPreviewInput,
} from '@shumai/core/src/search/video-chunk-preview'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  renderVideoChunkPreview,
  samplePreviewFrames,
  type VideoRange,
} from '@shumai/core/src/transcode/video-chunk-preview'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import { prisma, type WorkflowTask } from '@shumai/db'
import { ApplicationFailure, defineStep } from '@shumai/workflow-core'
import { completeTask } from './common'

const generateVideoChunkPreview = defineStep(async function generateVideoChunkPreview(
  assetId: string,
  ranges: VideoRange[],
) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, isDeleted: false, status: { not: 'pending_purge' } },
    include: { storageKey: true },
  })
  const source = asset?.storageKey
  const inputKey = asset && source && getPreviewInput(asset.media, source)
  if (!source || !inputKey) {
    throw ApplicationFailure.create({
      message: 'Source video for the chunk preview is unavailable',
      nonRetryable: true,
    })
  }

  const input = await s3Service.resolveInput(process.env.S3_BUCKET || 'shumai', inputKey)
  await videoChunkPreviewService.store(assetId, source.key, ranges, async (range) => {
    const dir = transcodeService.createTempDir('chunk-preview-')
    try {
      const frames = await samplePreviewFrames(input, dir, range)
      return await renderVideoChunkPreview(frames, range)
    } finally {
      transcodeService.removeDir(dir)
    }
  })
})

export async function transcodeVideoChunkPreviewWorkflow(task: WorkflowTask): Promise<void> {
  const ranges = task.payload?.videoChunkPreviewRanges
  if (!ranges?.length) {
    throw ApplicationFailure.create({
      message: 'Missing video chunk preview ranges',
      nonRetryable: true,
    })
  }
  await generateVideoChunkPreview(task.assetId, ranges)
  await completeTask(task.id)
}
