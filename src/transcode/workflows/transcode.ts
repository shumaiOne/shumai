import type { WorkflowTask } from '@shumai/db'
import { ApplicationFailure } from '@temporalio/workflow'
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
    const key = asset?.storageKey?.key
    if (!asset || !key) {
      throw ApplicationFailure.create({
        message: 'Asset not found or has no key',
        nonRetryable: true,
      })
    }

    // 3. Get Worker-Specific Queue for Transcode
    workerQueue = await executeActivity(TaskQueueTranscode, getTranscodeWorkerQueueActivity)

    // 4. Download Media to Tmp
    const download = await executeActivity(workerQueue, downloadMediaToTmpActivity, {
      assetKey: key,
    })
    const { filePath } = download
    tmpDir = download.tmpDir

    // 5. Get Media Info
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

    // 6. Video Transcoding
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
    if ((isImage || isPsd) && metadata) {
      const imageSpec: PrismaJson.ImageTranscode = {
        width: metadata.originalWidth,
        height: metadata.originalHeight,
        quality: 90,
        format: 'webp',
      }
      const imageTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
        assetKey: key,
        filePath,
        imageSpec,
      })
      mediaInfo.imageTranscodes.push(imageTranscode)
    }

    // 9. System: Thumbnail
    if (spec.thumbnail) {
      const thumbTranscode = await executeActivity(workerQueue, transcodeImageActivity, {
        assetKey: key,
        filePath,
        imageSpec: { width: 480, height: 0, quality: 80, format: 'webp' },
      })
      mediaInfo.thumbnail = thumbTranscode
    }

    // 10. System: Sprite/Poster (Video only usually)
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

const RESOLUTION_LONG_SIDES: Record<string, number> = {
  '2160p': 3840,
  '1080p': 1920,
  '720p': 1280,
  '540p': 960,
  '360p': 640,
  '180p': 320,
}

function resolutionToDimensions(
  resolution: string,
  originalWidth: number,
  originalHeight: number,
): [number, number] {
  const targetLongSide = RESOLUTION_LONG_SIDES[resolution]
  if (!targetLongSide) return [0, 0]

  let width = 0
  let height = 0

  if (originalWidth >= originalHeight) {
    // Landscape or square: width is the long side
    width = targetLongSide
    height = Math.round(width * (originalHeight / originalWidth))
  } else {
    // Portrait: height is the long side
    height = targetLongSide
    width = Math.round(height * (originalWidth / originalHeight))
  }

  // Ensure even dimensions for H.264
  if (width % 2 !== 0) width++
  if (height % 2 !== 0) height++

  return [width, height]
}

const TARGET_RESOLUTIONS = [
  { name: '2160p', longSide: 3840 },
  { name: '1080p', longSide: 1920 },
  { name: '720p', longSide: 1280 },
  { name: '540p', longSide: 960 },
  { name: '360p', longSide: 640 },
]

function getBestMatchResolution(
  originalWidth: number,
  originalHeight: number,
): { name: string; longSide: number } {
  const rawLongSide = Math.max(originalWidth, originalHeight)
  const lower = TARGET_RESOLUTIONS.filter((r) => r.longSide <= rawLongSide)
  if (lower.length > 0) {
    lower.sort((a, b) => b.longSide - a.longSide)
    return lower[0]
  }
  return TARGET_RESOLUTIONS[TARGET_RESOLUTIONS.length - 1] // 360p (longSide 640)
}

function getTargetVideoResolutions(
  strategy: PrismaJson.VideoTranscodeStrategy,
  originalWidth: number,
  originalHeight: number,
): string[] {
  const resolutions = ['180p']

  // Normalize legacy strategies for backward compatibility
  let normalizedStrategy: string = strategy
  const stratStr = strategy as string
  if (stratStr === 'single' || stratStr === 'disable') {
    normalizedStrategy = 'best_match'
  } else if (stratStr === 'full') {
    normalizedStrategy = 'all'
  }

  const bestMatch = getBestMatchResolution(originalWidth, originalHeight)

  if (normalizedStrategy === 'best_match') {
    resolutions.push(bestMatch.name)
  } else if (normalizedStrategy === 'all') {
    const bestMatchIndex = TARGET_RESOLUTIONS.findIndex((r) => r.name === bestMatch.name)
    if (bestMatchIndex !== -1) {
      for (let i = bestMatchIndex; i < TARGET_RESOLUTIONS.length; i++) {
        resolutions.push(TARGET_RESOLUTIONS[i].name)
      }
    }
  }

  return resolutions
}

export const transcodeWorkflow = transcodeMedia
