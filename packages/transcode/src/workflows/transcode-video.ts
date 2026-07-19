import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { executeActivity, getActivities } from '@shumai/workflow-core'
import {
  getWorkerQueueAndStartTask,
  fetchAssetWithKey,
  completeTask,
  failTask,
  cleanupTmpDir,
} from './common'
import { getTargetVideoResolutions, resolutionToDimensions } from './transcode-utils'

export async function transcodeVideoWorkflow(task: WorkflowTask): Promise<void> {
  let tmpDir: string | undefined
  let workerQueue = ''

  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const {
      updateAssetStatusActivity,
      getMediaInfoActivity,
      transcodeVideoActivity,
      transcodeAudioActivity,
      transcodeImageActivity,
      generateSpriteActivity,
      updateAssetMediaActivity,
      downloadMediaToTmpActivity,
      createEmbeddingTaskIfEnabledActivity,
    } = getActivities()

    await executeActivity(workerQueue, updateAssetStatusActivity, {
      assetId: task.assetId,
      status: 'processing',
    })

    const { asset, key } = await fetchAssetWithKey(workerQueue, task.assetId)

    const download = await executeActivity(workerQueue, downloadMediaToTmpActivity, {
      assetKey: key,
    })
    const { filePath } = download
    tmpDir = download.tmpDir

    const spec = task.payload?.transcode || {}
    const mediaInfo = await executeActivity(workerQueue, getMediaInfoActivity, {
      filePath,
      assetId: asset.id,
      mediaType: asset.mediaType || '',
    })

    mediaInfo.original = {
      key,
      downloadUrl: '',
      filesizeInBytes: 0,
      codec: '',
    }

    const mimeType = mediaInfo.mimeType
    const metadata = mediaInfo.metadata

    if (mimeType.startsWith('video/') && metadata) {
      const videoResolutions = getTargetVideoResolutions(
        spec.videoStrategy || 'best_match',
        metadata.originalWidth,
        metadata.originalHeight,
      )
      for (const res of videoResolutions) {
        const [width, height] = resolutionToDimensions(
          res,
          metadata.originalWidth,
          metadata.originalHeight,
        )

        const videoSpec: PrismaJson.VideoTranscode = {
          resolution: res,
          width,
          height,
        }

        const videoTranscode = await executeActivity(workerQueue, transcodeVideoActivity, {
          assetKey: key,
          filePath,
          videoSpec,
          duration: metadata.duration,
          originalFps: metadata.frameRate,
        })

        if (res === '180p') {
          mediaInfo.videoPreview = videoTranscode
        } else {
          mediaInfo.videoTranscodes.push(videoTranscode)
        }
      }

      mediaInfo.videoTranscodes.push({
        key: mediaInfo.original?.key,
        width: metadata.originalWidth,
        height: metadata.originalHeight,
        isRaw: true,
      })
    }

    const isAudio = mimeType.startsWith('audio/')
    if (isAudio && metadata) {
      const audioTranscode = await executeActivity(workerQueue, transcodeAudioActivity, {
        assetKey: key,
        filePath,
      })
      mediaInfo.videoTranscodes.push(audioTranscode)
    }

    if (spec.thumbnail) {
      const thumbTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
        assetKey: key,
        filePath,
        imageSpec: { width: 480, height: 0, quality: 80, format: 'webp' },
      })
      mediaInfo.thumbnail = thumbTranscode
    }

    if (spec.sprite || spec.poster) {
      const lastSlashIndex = key.lastIndexOf('/')
      const assetDir = lastSlashIndex === -1 ? '' : key.substring(0, lastSlashIndex)

      const spriteSpec: PrismaJson.SpriteInfo = {
        key: assetDir ? `${assetDir}/sprite.webp` : 'sprite.webp',
        frames: 100,
        tileX: 10,
        tileY: 10,
      }
      const posterSpec: PrismaJson.PosterInfo = {
        key: assetDir ? `${assetDir}/poster.webp` : 'poster.webp',
      }

      const spriteResult = await executeActivity(workerQueue, generateSpriteActivity, {
        assetKey: key,
        filePath,
        spriteSpec,
        posterSpec,
        mediaInfo,
      })
      mediaInfo.sprite = spriteResult.sprite
      mediaInfo.poster = spriteResult.poster
    }

    await executeActivity(workerQueue, updateAssetMediaActivity, {
      assetId: asset.id,
      mediaInfo,
    })

    await executeActivity(workerQueue, updateAssetStatusActivity, {
      assetId: asset.id,
      status: 'processed',
    })

    await executeActivity(workerQueue, createEmbeddingTaskIfEnabledActivity, {
      assetId: asset.id,
      teamId: task.teamId,
      projectId: task.projectId,
    })

    await completeTask(workerQueue, task.id)
  } catch (err) {
    console.error(`transcodeVideoWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err)
    throw err
  } finally {
    await cleanupTmpDir(workerQueue, tmpDir)
  }
}
