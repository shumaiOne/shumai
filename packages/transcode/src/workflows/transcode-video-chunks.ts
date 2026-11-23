import { logger } from '@shumai/core/src/logger'
import { isFullVideoRange } from '@shumai/core/src/transcode/video-sprite'
import type { WorkflowTask } from '@shumai/db'
import { ApplicationFailure } from '@shumai/workflow-core'
import { deleteS3ObjectActivity, transcodeVideoChunkActivity } from '../activities/transcode'
import { completeTask, failTask, fetchAssetWithKey, startTask } from './common'

export interface TranscodedVideoChunkItem {
  startTime: number
  endTime: number
  chunkKey: string
  sprite?: PrismaJson.VideoChunkSprite
}

export async function transcodeVideoChunksWorkflow(task: WorkflowTask): Promise<void> {
  const uploadedChunkKeys: string[] = []

  try {
    await startTask(task)

    const payload = task.payload
    if (!payload?.videoChunks || !Array.isArray(payload.videoChunks.chunks)) {
      throw ApplicationFailure.create({
        message: 'Invalid payload for videoChunks task',
        nonRetryable: true,
      })
    }

    const { asset, key } = await fetchAssetWithKey(task.assetId)
    let targetKey = payload.videoChunks.assetKey || key

    if (!payload.videoChunks.assetKey && asset?.media) {
      const mediaInfo = asset.media as unknown as PrismaJson.MediaInfo
      if (mediaInfo.videoTranscodes && mediaInfo.videoTranscodes.length > 0) {
        const transcode = mediaInfo.videoTranscodes[0]
        if (transcode?.key) {
          targetKey = transcode.key
        }
      }
    }

    if (targetKey === key && (asset.storageKey?.isArchived || asset.status === 'archived')) {
      throw ApplicationFailure.create({
        message:
          'Original video file is archived and no proxy is available. Restore the asset to generate embeddings.',
        nonRetryable: true,
      })
    }

    const chunks: TranscodedVideoChunkItem[] = []
    for (const range of payload.videoChunks.chunks) {
      const fullSpriteKey = isFullVideoRange(range.startTime, range.endTime, asset.media?.duration)
        ? asset.media?.sprite?.key
        : undefined
      const chunk = await transcodeVideoChunkActivity({
        taskId: task.id,
        assetId: asset.id,
        assetKey: targetKey,
        originalKey: key,
        startTime: range.startTime,
        endTime: range.endTime,
        format: payload.videoChunks.format,
        ...(fullSpriteKey && { fullSpriteKey }),
      })
      uploadedChunkKeys.push(chunk.chunkKey)
      chunks.push({ ...range, ...chunk })
    }

    await completeTask(task.id, { chunks })
  } catch (err) {
    logger.error({ taskId: task.id, err }, 'transcodeVideoChunksWorkflow failed')
    for (const chunkKey of uploadedChunkKeys) {
      try {
        await deleteS3ObjectActivity({ key: chunkKey })
      } catch (cleanupErr) {
        logger.error(
          { taskId: task.id, chunkKey, err: cleanupErr },
          'Failed to clean up partial chunk',
        )
      }
    }
    await failTask(task.id, err)
    throw err
  }
}
