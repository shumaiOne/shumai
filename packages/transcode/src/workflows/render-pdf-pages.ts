import type { WorkflowTask } from '@shumai/db'
import { ApplicationFailure } from '@shumai/workflow-core'
import { renderPdfPagesActivity } from '../activities/transcode'
import { startTask, fetchAssetWithKey, completeTask, failTask } from './common'

export async function renderPdfPagesWorkflow(task: WorkflowTask): Promise<void> {
  try {
    await startTask(task)

    const payload = task.payload
    if (!payload?.pdfPages) {
      throw ApplicationFailure.create({
        message: 'Invalid payload for pdfPages task',
        nonRetryable: true,
      })
    }

    const { asset, key } = await fetchAssetWithKey(task.assetId)
    const pdfKey = (asset.media as PrismaJson.MediaInfo | null)?.pdfTranscode?.key || key

    const pages = await renderPdfPagesActivity({
      taskId: task.id,
      assetKey: pdfKey,
      assetId: asset.id,
      start: payload.pdfPages.start,
      end: payload.pdfPages.end,
      commentTimestamp: payload.pdfPages.commentTimestamp,
      annotations: payload.pdfPages.annotations,
    })

    await completeTask(task.id, { pages })
  } catch (err) {
    console.error(`renderPdfPagesWorkflow failed for task ${task.id}:`, err)
    await failTask(task.id, err)
    throw err
  }
}
