import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { executeActivity, getActivities } from '@shumai/workflow-core'
import { ApplicationFailure } from '@temporalio/workflow'
import { getWorkerQueueAndStartTask, completeTask, failTask } from './common'

export async function transcodeWatermarkWorkflow(task: WorkflowTask): Promise<void> {
  let workerQueue = ''
  const watermarkConfigId = task.payload?.watermark?.watermarkConfigId
  const shareLinkId = task.payload?.watermark?.shareLinkId

  if (!watermarkConfigId) {
    throw ApplicationFailure.create({
      message: 'watermarkConfigId is required in task payload',
      nonRetryable: true,
    })
  }

  try {
    workerQueue = await getWorkerQueueAndStartTask(task)

    const {
      initWatermarkFileActivity,
      waitForWatermarkFileActivity,
      transcodeWatermarkMediaActivity,
      completeWatermarkFileActivity,
    } = getActivities()

    const initResult = await executeActivity(workerQueue, initWatermarkFileActivity, {
      assetId: task.assetId,
      watermarkConfigId,
    })

    if (initResult.action === 'completed') {
      if (shareLinkId) {
        await executeActivity(workerQueue, completeWatermarkFileActivity, {
          assetId: task.assetId,
          watermarkConfigId,
          status: 'completed',
          shareLinkId,
        })
      }
      await completeTask(workerQueue, task.id)
      return
    }

    if (initResult.action === 'failed') {
      throw ApplicationFailure.create({
        message: 'Watermark file generation failed in another task',
        nonRetryable: true,
      })
    }

    if (initResult.action === 'processing') {
      const waitResult = await executeActivity(workerQueue, waitForWatermarkFileActivity, {
        assetId: task.assetId,
        watermarkConfigId,
      })

      if (waitResult.status === 'completed') {
        if (shareLinkId) {
          await executeActivity(workerQueue, completeWatermarkFileActivity, {
            assetId: task.assetId,
            watermarkConfigId,
            status: 'completed',
            shareLinkId,
          })
        }
        await completeTask(workerQueue, task.id)
        return
      }

      throw ApplicationFailure.create({
        message: 'Watermark file generation failed in in-flight task',
        nonRetryable: true,
      })
    }

    const mediaInfo = await executeActivity(workerQueue, transcodeWatermarkMediaActivity, {
      assetId: task.assetId,
      watermarkConfigId,
    })

    await executeActivity(workerQueue, completeWatermarkFileActivity, {
      assetId: task.assetId,
      watermarkConfigId,
      mediaInfo,
      status: 'completed',
      shareLinkId,
    })

    await completeTask(workerQueue, task.id)
  } catch (err) {
    if (workerQueue && watermarkConfigId) {
      const { completeWatermarkFileActivity } = getActivities()
      try {
        await executeActivity(workerQueue, completeWatermarkFileActivity, {
          assetId: task.assetId,
          watermarkConfigId,
          status: 'failed',
          shareLinkId,
        })
      } catch (e) {
        console.error('Failed to update watermark file status to failed:', e)
      }
    }
    await failTask(workerQueue, task.id, err)
    throw err
  }
}
