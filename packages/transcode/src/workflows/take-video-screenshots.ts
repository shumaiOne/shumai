import type { WorkflowTask } from '@shumai/db'
import { executeActivity, getActivities } from '@shumai/workflow-core'
import { ApplicationFailure } from '@temporalio/workflow'
import { getWorkerQueueAndStartTask, fetchAssetWithKey, completeTask, failTask } from './common'

export async function takeVideoScreenshotsWorkflow(task: WorkflowTask): Promise<void> {
  let workerQueue = ''
  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const payload = task.payload
    if (!payload?.screenshot) {
      throw ApplicationFailure.create({
        message: 'Invalid payload for screenshot task',
        nonRetryable: true,
      })
    }

    const { asset, key } = await fetchAssetWithKey(workerQueue, task.assetId)
    let targetKey = key
    if (asset?.media) {
      const mediaInfo = asset.media as unknown as PrismaJson.MediaInfo
      if (mediaInfo.videoTranscodes && mediaInfo.videoTranscodes.length > 0) {
        const sorted = [...mediaInfo.videoTranscodes]
          .filter((t) => t.key)
          .sort((a, b) => (b.height || 0) - (a.height || 0))
        if (sorted.length > 0 && sorted[0].key) {
          targetKey = sorted[0].key
        }
      }
    }

    const { takeScreenshotsActivity } = getActivities()

    const screenshots = await executeActivity(workerQueue, takeScreenshotsActivity, {
      assetKey: targetKey,
      assetId: asset.id,
      start: payload.screenshot.start,
      end: payload.screenshot.end,
      count: payload.screenshot.count,
      commentTimestamp: payload.screenshot.commentTimestamp,
      annotations: payload.screenshot.annotations,
    })

    await completeTask(workerQueue, task.id, { screenshots })
  } catch (err) {
    console.error(`takeVideoScreenshotsWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err)
    throw err
  }
}
