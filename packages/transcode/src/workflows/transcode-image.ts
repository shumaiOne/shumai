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

export async function transcodeImageWorkflow(task: WorkflowTask): Promise<void> {
  let tmpDir: string | undefined
  let workerQueue = ''
  let mediaProcessed = false

  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const {
      updateAssetStatusActivity,
      getMediaInfoActivity,
      transcodeImageActivity,
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
      assetId: asset.id,
    })
    const { filePath } = download
    tmpDir = download.tmpDir

    const spec = task.payload?.transcode || {}
    const mediaInfo = await executeActivity(workerQueue, getMediaInfoActivity, {
      filePath,
      assetId: asset.id,
      proxyType: 'image',
      mediaType: asset.mediaType || '',
    })

    mediaInfo.original = {
      key,
      filesizeInBytes: 0,
      codec: '',
    }

    const metadata = mediaInfo.metadata
    const hasUsablePreview = metadata && metadata.originalWidth > 0 && metadata.originalHeight > 0

    const isImage = mediaInfo.proxyType === 'image'
    if (isImage && hasUsablePreview && metadata) {
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

    if (spec.thumbnail && hasUsablePreview) {
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
    console.error(`transcodeImageWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err, mediaProcessed ? undefined : task.assetId)
    throw err
  } finally {
    await cleanupTmpDir(workerQueue, tmpDir)
  }
}
