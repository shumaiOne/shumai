import type { WorkflowTask } from '@shumai/db'
import { ApplicationFailure } from '@shumai/workflow-core'
import { takeScreenshotsActivity } from '../activities/transcode'
import { startTask, fetchAssetWithKey, completeTask, failTask } from './common'

export async function takeVideoScreenshotsWorkflow(task: WorkflowTask): Promise<void> {
  try {
    await startTask(task)

    const payload = task.payload
    if (!payload?.screenshot) {
      throw ApplicationFailure.create({
        message: 'Invalid payload for screenshot task',
        nonRetryable: true,
      })
    }

    const { asset, key } = await fetchAssetWithKey(task.assetId)
    let targetKey = key
    if (asset?.media) {
      const mediaInfo = asset.media as unknown as PrismaJson.MediaInfo
      if (mediaInfo.videoTranscodes && mediaInfo.videoTranscodes.length > 0) {
        const sorted = [...mediaInfo.videoTranscodes]
          .filter((t) => t.key)
          .sort((a, b) => {
            // Prioritize SDR over HDR to avoid washed out screenshots
            if (!a.hdr && b.hdr) return -1
            if (a.hdr && !b.hdr) return 1
            return (b.height || 0) - (a.height || 0)
          })
        if (sorted.length > 0 && sorted[0].key) {
          targetKey = sorted[0].key
        }
      }
    }

    const screenshots = await takeScreenshotsActivity({
      taskId: task.id,
      assetKey: targetKey,
      assetId: asset.id,
      start: payload.screenshot.start,
      end: payload.screenshot.end,
      count: payload.screenshot.count,
      commentTimestamp: payload.screenshot.commentTimestamp,
      annotations: payload.screenshot.annotations,
    })

    await completeTask(task.id, { screenshots })
  } catch (err) {
    console.error(`takeVideoScreenshotsWorkflow failed for task ${task.id}:`, err)
    await failTask(task.id, err)
    throw err
  }
}
