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
      extractPosterActivity,
      generateSpriteActivity,
      updateAssetMediaActivity,
      downloadMediaToTmpActivity,
      createEmbeddingTaskIfEnabledActivity,
      createAutofillTaskIfEnabledActivity,
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
    const proxyType = asset.mediaType?.startsWith('audio/') ? 'audio' : 'video'
    const mediaInfo = await executeActivity(workerQueue, getMediaInfoActivity, {
      filePath,
      assetId: asset.id,
      proxyType,
      mediaType: asset.mediaType || '',
    })

    mediaInfo.original = {
      key,
      filesizeInBytes: 0,
      codec: '',
    }

    if (spec.poster) {
      const lastSlashIndex = key.lastIndexOf('/')
      const assetDir = lastSlashIndex === -1 ? '' : key.substring(0, lastSlashIndex)
      const posterSpec: PrismaJson.PosterInfo = {
        key: assetDir ? `${assetDir}/poster.webp` : 'poster.webp',
      }
      const posterResult = await executeActivity(workerQueue, extractPosterActivity, {
        assetKey: key,
        posterSpec,
        taskId: task.id,
        isHdr: mediaInfo.metadata?.isHdr,
        hdrType: mediaInfo.metadata?.hdrType,
        colorTransfer: mediaInfo.metadata?.colorTransfer,
      })
      mediaInfo.poster = posterResult.poster
      await executeActivity(workerQueue, updateAssetMediaActivity, {
        assetId: asset.id,
        mediaInfo,
      })
    }

    // Generate the sprite (and its poster fallback) before the expensive proxy transcodes so the
    // file list can show a poster/sprite preview while the asset is still processing.
    if (spec.sprite || (spec.poster && !mediaInfo.poster)) {
      const lastSlashIndex = key.lastIndexOf('/')
      const assetDir = lastSlashIndex === -1 ? '' : key.substring(0, lastSlashIndex)

      const spriteSpec: PrismaJson.SpriteInfo = {
        key: assetDir ? `${assetDir}/sprite.webp` : 'sprite.webp',
        frames: 100,
        tileX: 10,
        tileY: 10,
      }
      const posterSpec: PrismaJson.PosterInfo = mediaInfo.poster || {
        key: assetDir ? `${assetDir}/poster.webp` : 'poster.webp',
      }

      const spriteResult = await executeActivity(workerQueue, generateSpriteActivity, {
        taskId: task.id,
        assetKey: key,
        filePath,
        spriteSpec,
        posterSpec,
        mediaInfo,
      })
      if (spec.sprite) {
        mediaInfo.sprite = spriteResult.sprite
      }
      if (!mediaInfo.poster) {
        mediaInfo.poster = spriteResult.poster
      }

      await executeActivity(workerQueue, updateAssetMediaActivity, {
        assetId: asset.id,
        mediaInfo,
      })
    }

    const metadata = mediaInfo.metadata

    if (mediaInfo.proxyType === 'video' && metadata) {
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

        const isHdr = Boolean(metadata.isHdr)

        if (res === '180p') {
          const videoSpec: PrismaJson.VideoTranscode = {
            resolution: res,
            width,
            height,
            hdr: isHdr,
          }

          const videoTranscode = await executeActivity(workerQueue, transcodeVideoActivity, {
            taskId: task.id,
            assetKey: key,
            filePath,
            videoSpec,
            duration: metadata.duration,
            originalFps: metadata.frameRate,
            hardwareAcceleration: spec.hardwareAcceleration,
            sourceVideoBitrate: metadata.videoBitRate || metadata.bitRate,
            threads: spec.threads,
            sourceIsHdr: metadata.isHdr,
            sourceHdrType: metadata.hdrType,
            sourceColorTransfer: metadata.colorTransfer,
            sourceColorPrimaries: metadata.colorPrimaries,
            sourceColorSpace: metadata.colorSpace,
          })

          mediaInfo.videoPreview = videoTranscode
          continue
        }

        const videoSpec: PrismaJson.VideoTranscode = {
          resolution: res,
          width,
          height,
          hdr: isHdr,
        }

        const videoTranscode = await executeActivity(workerQueue, transcodeVideoActivity, {
          taskId: task.id,
          assetKey: key,
          filePath,
          videoSpec,
          duration: metadata.duration,
          originalFps: metadata.frameRate,
          hardwareAcceleration: spec.hardwareAcceleration,
          sourceVideoBitrate: metadata.videoBitRate || metadata.bitRate,
          threads: spec.threads,
          sourceIsHdr: metadata.isHdr,
          sourceHdrType: metadata.hdrType,
          sourceColorTransfer: metadata.colorTransfer,
          sourceColorPrimaries: metadata.colorPrimaries,
          sourceColorSpace: metadata.colorSpace,
        })

        mediaInfo.videoTranscodes.push(videoTranscode)
      }
    }

    const isAudio = mediaInfo.proxyType === 'audio'
    if (isAudio && metadata) {
      const audioTranscode = await executeActivity(workerQueue, transcodeAudioActivity, {
        taskId: task.id,
        assetKey: key,
        filePath,
        threads: spec.threads,
      })
      mediaInfo.videoTranscodes.push(audioTranscode)
    }

    if (spec.thumbnail) {
      const thumbTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
        assetKey: key,
        filePath,
        imageSpec: { width: 300, height: 300, quality: 80, format: 'webp', isPreview: true },
      })
      mediaInfo.thumbnail = thumbTranscode
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

    await executeActivity(workerQueue, createAutofillTaskIfEnabledActivity, {
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
