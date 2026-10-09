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

export async function transcode3dWorkflow(task: WorkflowTask): Promise<void> {
  let tmpDir: string | undefined
  let workerQueue = ''
  let mediaProcessed = false

  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const {
      updateAssetStatusActivity,
      downloadMediaToTmpActivity,
      start3dRenderActivity,
      waitFor3dVideoRenderActivity,
      generate3dSpriteActivity,
      updateAssetMediaActivity,
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
    const currentFilePath = download.filePath
    tmpDir = download.tmpDir

    const lastSlashIndex = key.lastIndexOf('/')
    const assetDir = lastSlashIndex === -1 ? '' : key.substring(0, lastSlashIndex)
    const videoKey = assetDir ? `${assetDir}/turntable.mp4` : 'turntable.mp4'
    const posterKey = assetDir ? `${assetDir}/poster.webp` : 'poster.webp'
    const spriteKey = assetDir ? `${assetDir}/sprite.webp` : 'sprite.webp'

    const renderStart = await executeActivity(workerQueue, start3dRenderActivity, {
      taskId: task.id,
      teamId: task.teamId,
      assetId: asset.id,
      assetKey: key,
      filePath: currentFilePath,
      filename: asset.name || 'model.glb',
      targetPosterKey: posterKey,
    })

    const posterWidth = renderStart.posterWidth || 1080
    const posterHeight = renderStart.posterHeight || 1080

    const mediaInfo: PrismaJson.MediaInfo = {
      duration: 4,
      filesize: 0,
      frames: 24,
      proxyType: '3d',
      imageTranscodes: [],
      videoTranscodes: [],
      poster: {
        key: posterKey,
      },
      finishedAt: new Date().toISOString(),
      metadata: {
        originalHeight: posterHeight,
        originalWidth: posterWidth,
        hasAudio: false,
        duration: 4,
        bitRate: 0,
        frameRate: 6,
        totalFrames: 24,
        startTimecode: '00:00:00:00',
        format: renderStart.modelMetadata ?? {},
      },
      original: {
        key,
        filesizeInBytes: Number(asset.sizeByte || 0),
        codec: '',
      },
    }

    await executeActivity(workerQueue, updateAssetMediaActivity, {
      assetId: asset.id,
      mediaInfo,
    })

    const renderVideo = await executeActivity(workerQueue, waitFor3dVideoRenderActivity, {
      taskId: task.id,
      teamId: task.teamId,
      assetKey: key,
      renderTaskId: renderStart.renderTaskId,
      targetVideoKey: videoKey,
      tmpDir,
    })

    await executeActivity(workerQueue, generate3dSpriteActivity, {
      taskId: task.id,
      assetKey: key,
      videoFilePath: renderVideo.videoFilePath,
      spriteKey,
    })

    mediaInfo.sprite = {
      key: spriteKey,
      frames: 100,
      tileX: 10,
      tileY: 10,
    }

    await executeActivity(workerQueue, updateAssetMediaActivity, {
      assetId: asset.id,
      mediaInfo,
    })

    mediaInfo.videoTranscodes = [
      {
        key: videoKey,
        width: 1080,
        height: 1080,
        resolution: '1080p',
      },
    ]
    mediaInfo.videoPreview = {
      key: videoKey,
      width: 1080,
      height: 1080,
      resolution: '1080p',
    }
    mediaInfo.finishedAt = new Date().toISOString()

    await executeActivity(workerQueue, updateAssetMediaActivity, {
      assetId: asset.id,
      mediaInfo,
    })

    await executeActivity(workerQueue, updateAssetStatusActivity, {
      assetId: asset.id,
      status: 'processed',
    })
    mediaProcessed = true

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
    console.error(`transcode3dWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err, mediaProcessed ? undefined : task.assetId)
    throw err
  } finally {
    await cleanupTmpDir(workerQueue, tmpDir)
  }
}
