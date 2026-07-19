import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { executeActivity, getActivities } from '@shumai/workflow-core'
import { ApplicationFailure } from '@temporalio/workflow'
import { getWorkerQueueAndStartTask, completeTask, failTask } from './common'

export async function overlayImageAnnotationWorkflow(task: WorkflowTask): Promise<void> {
  let workerQueue = ''
  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const payload = task.payload
    if (!payload?.imageAnnotation) {
      throw ApplicationFailure.create({
        message: 'Invalid payload for imageAnnotation task',
        nonRetryable: true,
      })
    }

    const { getAssetActivity, overlayAnnotationsActivity } = getActivities()
    const asset = await executeActivity(workerQueue, getAssetActivity, task.assetId)
    let key = asset?.storageKey?.key
    if (asset?.media) {
      const mediaInfo = asset.media as unknown as PrismaJson.MediaInfo
      if (mediaInfo.imageTranscodes && mediaInfo.imageTranscodes.length > 0) {
        key = mediaInfo.imageTranscodes[0].key || key
      }
    }

    if (!asset || !key) {
      throw ApplicationFailure.create({
        message: 'Asset not found or has no key',
        nonRetryable: true,
      })
    }

    const keyWithOverlay = await executeActivity(workerQueue, overlayAnnotationsActivity, {
      assetKey: key,
      assetId: asset.id,
      annotations: payload.imageAnnotation.annotations,
    })

    await completeTask(workerQueue, task.id, { key: keyWithOverlay })
  } catch (err) {
    console.error(`overlayImageAnnotationWorkflow failed for task ${task.id}:`, err)
    await failTask(workerQueue, task.id, err)
    throw err
  }
}
