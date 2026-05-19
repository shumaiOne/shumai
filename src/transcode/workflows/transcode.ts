import type { WorkflowTask } from '@/generated/prisma/client'
import {
  getActivities,
  executeActivity,
  TaskQueueDb,
  TaskQueueTranscode,
} from '@/workflow/workflow-utils'

export async function transcodeMedia(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    updateAssetStatusActivity,
    getAssetActivity,
    getMediaInfoActivity,
    transcodeVideoActivity,
    transcodeImageActivity,
    generateSpriteActivity,
    updateAssetMediaActivity,
    getTranscodeWorkerQueueActivity,
    downloadMediaToTmpActivity,
    cleanupTmpDirActivity,
  } = getActivities()

  let tmpDir: string | undefined
  let workerQueue: string | undefined

  try {
    // 1. Update status to processing
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    await executeActivity(TaskQueueDb, updateAssetStatusActivity, {
      assetId: task.assetId,
      status: 'processing',
    })

    // 2. Get Asset
    const asset = await executeActivity(TaskQueueDb, getAssetActivity, task.assetId)
    if (!asset || !asset.key) throw new Error('Asset not found')

    // 3. Get Worker-Specific Queue for Transcode
    workerQueue = await executeActivity(TaskQueueTranscode, getTranscodeWorkerQueueActivity)

    // 4. Download Media to Tmp
    const download = await executeActivity(workerQueue, downloadMediaToTmpActivity, {
      assetKey: asset.key,
    })
    const { filePath } = download
    tmpDir = download.tmpDir

    // 5. Get Media Info
    const spec = task.payload as PrismaJson.TaskSpec
    const mediaInfo = await executeActivity(workerQueue, getMediaInfoActivity, {
      filePath,
      assetId: asset.id,
      mediaType: asset.mediaType || '',
    })

    mediaInfo.original = {
      key: asset.key,
      downloadUrl: '',
      filesizeInBytes: 0,
      codec: '',
    }

    const mimeType = mediaInfo.mimeType
    const metadata = mediaInfo.metadata

    // 6. Video Transcoding
    if (mimeType.startsWith('video/') && metadata) {
      const videoResolutions = getTargetVideoResolutions(
        spec.videoStrategy || 'disable',
        metadata.originalHeight,
      )
      for (const res of videoResolutions) {
        const [width, height] = resolutionToDimensions(
          res,
          metadata.originalWidth,
          metadata.originalHeight,
        )
        if (width > metadata.originalWidth) continue

        const videoSpec: PrismaJson.VideoTranscode = {
          resolution: res,
          width,
          height,
        }

        const videoTranscode = await executeActivity(workerQueue, transcodeVideoActivity, {
          assetKey: asset.key,
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

      // Always keep raw
      mediaInfo.videoTranscodes.push({
        key: mediaInfo.original?.key,
        width: metadata.originalWidth,
        height: metadata.originalHeight,
        isRaw: true,
      })
    }

    // 7. Image Transcoding
    const isImage = mimeType.startsWith('image/')
    const isPsd = isMimePsd(mimeType)
    if (isImage || isPsd) {
      if (metadata) {
        const imageSpecs = getTargetImageResolutions(
          spec.imageStrategy || 'disable',
          metadata.originalWidth,
        )
        for (const imageSpec of imageSpecs) {
          if (imageSpec.width > metadata.originalWidth) continue

          const imageTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
            assetKey: asset.key,
            filePath,
            imageSpec,
          })
          mediaInfo.imageTranscodes.push(imageTranscode)
        }
      }
    }

    // 8. PSD / Raw fallback
    if (mediaInfo.imageTranscodes.length === 0 && isPsd && metadata) {
      const imageSpec: PrismaJson.ImageTranscode = {
        width: metadata.originalWidth,
        height: metadata.originalHeight,
        quality: 90,
        format: 'webp',
      }
      const imageTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
        assetKey: asset.key,
        filePath,
        imageSpec,
      })
      imageTranscode.isRaw = true
      mediaInfo.imageTranscodes.push(imageTranscode)
    } else if (isImage && metadata) {
      // Always keep raw for image
      mediaInfo.imageTranscodes.push({
        key: mediaInfo.original?.key,
        width: metadata.originalWidth,
        height: metadata.originalHeight,
        format: mimeType,
        isRaw: true,
        quality: 100,
      })
    }

    // 9. System: Thumbnail
    if (spec.thumbnail) {
      const thumbTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
        assetKey: asset.key,
        filePath,
        imageSpec: { width: 480, height: 0, quality: 80, format: 'webp' },
      })
      mediaInfo.thumbnail = thumbTranscode
    }

    // 10. System: Sprite/Poster (Video only usually)
    if (spec.sprite || spec.poster) {
      const lastSlashIndex = asset.key.lastIndexOf('/')
      const assetDir = lastSlashIndex === -1 ? '' : asset.key.substring(0, lastSlashIndex)

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
        assetKey: asset.key,
        filePath,
        spriteSpec,
        posterSpec,
        mediaInfo,
      })
      mediaInfo.sprite = spriteResult.sprite
      mediaInfo.poster = spriteResult.poster
    }

    // 11. Update Asset Media and Status
    await executeActivity(TaskQueueDb, updateAssetMediaActivity, {
      assetId: asset.id,
      mediaInfo,
    })

    await executeActivity(TaskQueueDb, updateAssetStatusActivity, {
      assetId: asset.id,
      status: 'processed',
    })

    // 12. Update Task Status
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`TranscodeMedia failed for task ${task.id}:`, err)
    // Update status to failed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'failed',
      output: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  } finally {
    if (tmpDir && workerQueue) {
      try {
        await executeActivity(workerQueue, cleanupTmpDirActivity, { tmpDir })
      } catch (cleanupErr) {
        console.error('Failed to cleanup tmp dir:', cleanupErr)
      }
    }
  }
}

function isMimePsd(mimeType: string): boolean {
  switch (mimeType) {
    case 'image/vnd.adobe.photoshop':
    case 'image/x-photoshop':
    case 'application/x-photoshop':
    case 'image/psd':
      return true
  }
  return false
}

function resolutionToDimensions(
  resolution: string,
  originalWidth: number,
  originalHeight: number,
): [number, number] {
  const aspectRatio = originalWidth / originalHeight
  let height = 0
  switch (resolution) {
    case '2160p':
      height = 2160
      break
    case '1440p':
      height = 1440
      break
    case '1080p':
      height = 1080
      break
    case '720p':
      height = 720
      break
    case '480p':
      height = 480
      break
    case '360p':
      height = 360
      break
    case '180p':
      height = 180
      break
    default:
      return [0, 0]
  }
  let width = Math.round(height * aspectRatio)

  // Ensure even dimensions
  if (width % 2 !== 0) width++
  if (height % 2 !== 0) height++

  return [width, height]
}

function getTargetVideoResolutions(
  strategy: PrismaJson.VideoTranscodeStrategy,
  originalHeight: number,
): string[] {
  const resolutions = ['180p']
  if (strategy === 'disable') return resolutions

  const targets = [2160, 1440, 1080, 720, 480]
  const targetMap: Record<number, string> = {
    '2160': '2160p',
    '1440': '1440p',
    '1080': '1080p',
    '720': '720p',
    '480': '480p',
  }

  const validTargets = targets.filter((t) => t <= originalHeight)

  if (strategy === 'single') {
    if (validTargets.length > 0) {
      resolutions.push(targetMap[validTargets[0]])
    }
  } else if (strategy === 'full') {
    for (const t of validTargets) {
      resolutions.push(targetMap[t])
    }
  }

  return resolutions
}

function getTargetImageResolutions(
  strategy: PrismaJson.ImageTranscodeStrategy,
  originalWidth: number,
): PrismaJson.ImageTranscode[] {
  if (strategy === 'disable') return []

  const targets = [
    { width: 1920, quality: 80, format: 'webp' },
    { width: 1280, quality: 80, format: 'webp' },
    { width: 854, quality: 80, format: 'webp' },
  ]

  if (strategy === 'single') {
    const valid = targets.filter((t) => t.width <= originalWidth)
    if (valid.length > 0) {
      return [{ ...valid[0], height: 0 }]
    }
  }

  return []
}

export const transcodeWorkflow = transcodeMedia
