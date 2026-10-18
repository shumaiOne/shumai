import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { updateAssetStatusActivity } from '@shumai/workflow-core'
import {
  downloadMediaToTmpActivity,
  generatePdfProxyActivity,
  getMediaInfoActivity,
  generateSpriteActivity,
  updateAssetMediaActivity,
  createEmbeddingTaskIfEnabledActivity,
  createAutofillTaskIfEnabledActivity,
} from '../activities/transcode'
import { startTask, fetchAssetWithKey, completeTask, failTask, cleanupTmpDir } from './common'

export async function transcodePdfWorkflow(task: WorkflowTask): Promise<void> {
  let tmpDir: string | undefined
  let mediaProcessed = false

  try {
    await startTask(task)

    await updateAssetStatusActivity({
      assetId: task.assetId,
      status: 'processing',
    })

    const { asset, key } = await fetchAssetWithKey(task.assetId)

    const download = await downloadMediaToTmpActivity({
      assetKey: key,
    })
    let currentFilePath = download.filePath
    tmpDir = download.tmpDir

    const pdfProxy = await generatePdfProxyActivity({
      teamId: task.teamId,
      assetId: asset.id,
      assetKey: key,
      filePath: currentFilePath,
      mediaType: asset.mediaType || '',
      filename: asset.name || '',
    })

    currentFilePath = pdfProxy.pdfFilePath

    const spec = task.payload?.transcode || {}
    const mediaInfo = await getMediaInfoActivity({
      filePath: currentFilePath,
      assetId: asset.id,
      proxyType: 'pdf',
      mediaType: asset.mediaType || '',
    })

    mediaInfo.original = {
      key,
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

      const spriteResult = await generateSpriteActivity({
        assetKey: key,
        filePath: currentFilePath,
        spriteSpec,
        posterSpec,
        mediaInfo,
      })
      mediaInfo.sprite = spriteResult.sprite
      mediaInfo.poster = spriteResult.poster
    }

    await updateAssetMediaActivity({
      assetId: asset.id,
      mediaInfo,
    })

    await updateAssetStatusActivity({
      assetId: asset.id,
      status: 'processed',
    })
    mediaProcessed = true

    await createEmbeddingTaskIfEnabledActivity({
      assetId: asset.id,
      teamId: task.teamId,
      projectId: task.projectId,
    })

    await createAutofillTaskIfEnabledActivity({
      assetId: asset.id,
      teamId: task.teamId,
      projectId: task.projectId,
    })

    await completeTask(task.id)
  } catch (err) {
    console.error(`transcodePdfWorkflow failed for task ${task.id}:`, err)
    await failTask(task.id, err, mediaProcessed ? undefined : task.assetId)
    throw err
  } finally {
    await cleanupTmpDir(tmpDir)
  }
}
