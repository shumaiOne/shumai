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

export async function transcodePdfWorkflow(task: WorkflowTask): Promise<void> {
  let tmpDir: string | undefined
  let workerQueue = ''

  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const {
      updateAssetStatusActivity,
      getMediaInfoActivity,
      generateSpriteActivity,
      updateAssetMediaActivity,
      downloadMediaToTmpActivity,
      generatePdfProxyActivity,
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
    let currentFilePath = download.filePath
    tmpDir = download.tmpDir

    const pdfProxy = await executeActivity(workerQueue, generatePdfProxyActivity, {
      assetId: asset.id,
      assetKey: key,
      filePath: currentFilePath,
      mediaType: asset.mediaType || '',
      filename: asset.name || '',
    })

    currentFilePath = pdfProxy.pdfFilePath

    const spec = task.payload?.transcode || {}
    const mediaInfo = await executeActivity(workerQueue, getMediaInfoActivity, {
      filePath: currentFilePath,
      assetId: asset.id,
      mediaType: asset.mediaType || '',
    })

    mediaInfo.original = {
      key,
      downloadUrl: '',
      filesizeInBytes: 0,
      codec: '',
    }
    mediaInfo.pdfTranscode = {
      key: pdfProxy.pdfProxyKey,
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
        filePath: currentFilePath,
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
    console.error(`transcodePdfWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err)
    throw err
  } finally {
    await cleanupTmpDir(workerQueue, tmpDir)
  }
}
