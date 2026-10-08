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
      render3dModelActivity,
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

    const renderResult = await executeActivity(workerQueue, render3dModelActivity, {
      taskId: task.id,
      teamId: task.teamId,
      assetId: asset.id,
      assetKey: key,
      filePath: currentFilePath,
      filename: asset.name || 'model.glb',
      targetVideoKey: videoKey,
      targetPosterKey: posterKey,
    })

    await executeActivity(workerQueue, generate3dSpriteActivity, {
      taskId: task.id,
      assetKey: key,
      videoFilePath: renderResult.videoFilePath,
      spriteKey,
    })

    const mediaInfo: PrismaJson.MediaInfo = {
      duration: 4,
      filesize: 0,
      frames: 24,
      proxyType: '3d',
      imageTranscodes: [],
      videoTranscodes: [
        {
          key: videoKey,
          width: 1080,
          height: 1080,
          resolution: '1080p',
        },
      ],
      videoPreview: {
        key: videoKey,
        width: 1080,
        height: 1080,
        resolution: '1080p',
      },
      poster: {
        key: posterKey,
      },
      sprite: {
        key: spriteKey,
        frames: 100,
        tileX: 10,
        tileY: 10,
      },
      finishedAt: new Date().toISOString(),
      metadata: {
        originalHeight: 1080,
        originalWidth: 1080,
        hasAudio: false,
        duration: 4,
        bitRate: 0,
        frameRate: 6,
        totalFrames: 24,
        startTimecode: '00:00:00:00',
        format: renderResult.modelMetadata ?? {},
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
