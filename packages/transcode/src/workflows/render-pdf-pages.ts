import type { WorkflowTask } from '@shumai/db'
import { executeActivity, getActivities } from '@shumai/workflow-core'
import { ApplicationFailure } from '@temporalio/workflow'
import { getWorkerQueueAndStartTask, fetchAssetWithKey, completeTask, failTask } from './common'

export async function renderPdfPagesWorkflow(task: WorkflowTask): Promise<void> {
  let workerQueue = ''
  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const payload = task.payload
    if (!payload?.pdfPages) {
      throw ApplicationFailure.create({
        message: 'Invalid payload for pdfPages task',
        nonRetryable: true,
      })
    }

    const { asset, key } = await fetchAssetWithKey(workerQueue, task.assetId)
    const { renderPdfPagesActivity } = getActivities()
    const pdfKey = (asset.media as PrismaJson.MediaInfo | null)?.pdfTranscode?.key || key

    const pages = await executeActivity(workerQueue, renderPdfPagesActivity, {
      assetKey: pdfKey,
      assetId: asset.id,
      start: payload.pdfPages.start,
      end: payload.pdfPages.end,
      commentTimestamp: payload.pdfPages.commentTimestamp,
      annotations: payload.pdfPages.annotations,
    })

    await completeTask(workerQueue, task.id, { pages })
  } catch (err) {
    console.error(`renderPdfPagesWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err)
    throw err
  }
}
