import {
  videoChunkPreviewService,
  getPreviewInput,
} from '@shumai/core/src/search/video-chunk-preview'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  renderVideoChunkPreview,
  samplePreviewFrames,
} from '@shumai/core/src/transcode/video-chunk-preview'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import { prisma, type WorkflowTask } from '@shumai/db'
import { ApplicationFailure, defineStep } from '@shumai/workflow-core'
import { completeTask } from './common'

const generateVideoChunkPreview = defineStep(async function generateVideoChunkPreview(
  assetId: string,
  previewId: string,
) {
  const preview = await prisma.videoChunkPreview.findFirst({
    where: { id: previewId, assetId, asset: { isDeleted: false } },
    include: { asset: { include: { storageKey: true } } },
  })
  const source = preview?.asset.storageKey
  const inputKey = source && getPreviewInput(preview.asset.media, source)
  if (!preview || !source || !inputKey) {
    throw ApplicationFailure.create({
      message: 'Source video for the chunk preview is unavailable',
      nonRetryable: true,
    })
  }

  const range = { assetId, startTime: preview.startTime, endTime: preview.endTime }
  await videoChunkPreviewService.store(range, source.key, async () => {
    const dir = transcodeService.createTempDir('chunk-preview-')
    try {
      const input = await s3Service.resolveInput(process.env.S3_BUCKET || 'shumai', inputKey)
      const frames = await samplePreviewFrames(input, dir, range, range.startTime)
      return await renderVideoChunkPreview(frames, range)
    } finally {
      transcodeService.removeDir(dir)
    }
  })
})

export async function transcodeVideoChunkPreviewWorkflow(task: WorkflowTask): Promise<void> {
  const previewId = task.payload?.videoChunkPreviewId
  if (!previewId) {
    throw ApplicationFailure.create({
      message: 'Missing video chunk preview ID',
      nonRetryable: true,
    })
  }
  await generateVideoChunkPreview(task.assetId, previewId)
  await completeTask(task.id)
}
