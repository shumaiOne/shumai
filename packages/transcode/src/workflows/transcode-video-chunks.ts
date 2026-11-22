import type { WorkflowTask } from '@shumai/db'
import { ApplicationFailure } from '@shumai/workflow-core'
import { deleteS3ObjectActivity, transcodeVideoChunkActivity } from '../activities/transcode'
import { completeTask, failTask, fetchAssetWithKey, startTask } from './common'

export interface TranscodedVideoChunkItem {
  startTime: number
  endTime: number
  chunkKey: string
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
      const { chunkKey } = await transcodeVideoChunkActivity({
        assetId: asset.id,
        assetKey: targetKey,
        startTime: range.startTime,
        endTime: range.endTime,
        format: payload.videoChunks.format,
      })
      uploadedChunkKeys.push(chunkKey)
      chunks.push({
        startTime: range.startTime,
        endTime: range.endTime,
        chunkKey,
      })
    }

    await completeTask(task.id, { chunks })
  } catch (err) {
    console.error(`transcodeVideoChunksWorkflow failed for task ${task.id}:`, err)
    for (const chunkKey of uploadedChunkKeys) {
      try {
        await deleteS3ObjectActivity({ key: chunkKey })
      } catch (cleanupErr) {
        console.error(`Failed to clean up partial chunk ${chunkKey}:`, cleanupErr)
      }
    }
    await failTask(task.id, err)
    throw err
  }
}
