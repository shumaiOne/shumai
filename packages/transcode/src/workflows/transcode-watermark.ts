import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { ApplicationFailure } from '@shumai/workflow-core'
import {
  initWatermarkFileActivity,
  waitForWatermarkFileActivity,
  transcodeWatermarkMediaActivity,
  completeWatermarkFileActivity,
} from '../activities/watermark'
import { startTask, completeTask, failTask } from './common'

export async function transcodeWatermarkWorkflow(task: WorkflowTask): Promise<void> {
  const watermarkConfigId = task.payload?.watermark?.watermarkConfigId
  const shareLinkId = task.payload?.watermark?.shareLinkId

  if (!watermarkConfigId) {
    throw ApplicationFailure.create({
      message: 'watermarkConfigId is required in task payload',
      nonRetryable: true,
    })
  }

  try {
    await startTask(task)

    const initResult = await initWatermarkFileActivity({
      assetId: task.assetId,
      watermarkConfigId,
    })

    if (initResult.action === 'completed') {
      if (shareLinkId) {
        await completeWatermarkFileActivity({
          assetId: task.assetId,
          watermarkConfigId,
          status: 'completed',
          shareLinkId,
        })
      }
      await completeTask(task.id)
      return
    }

    if (initResult.action === 'failed') {
      throw ApplicationFailure.create({
        message: 'Watermark file generation failed in another task',
        nonRetryable: true,
      })
    }

    if (initResult.action === 'processing') {
      const waitResult = await waitForWatermarkFileActivity({
        assetId: task.assetId,
        watermarkConfigId,
      })

      if (waitResult.status === 'completed') {
        if (shareLinkId) {
          await completeWatermarkFileActivity({
            assetId: task.assetId,
            watermarkConfigId,
            status: 'completed',
            shareLinkId,
          })
        }
        await completeTask(task.id)
        return
      }

      throw ApplicationFailure.create({
        message: 'Watermark file generation failed in in-flight task',
        nonRetryable: true,
      })
    }

    const mediaInfo = await transcodeWatermarkMediaActivity({
      assetId: task.assetId,
      watermarkConfigId,
    })

    await completeWatermarkFileActivity({
      assetId: task.assetId,
      watermarkConfigId,
      mediaInfo,
      status: 'completed',
      shareLinkId,
    })

    await completeTask(task.id)
  } catch (err) {
    if (watermarkConfigId) {
      try {
        await completeWatermarkFileActivity({
          assetId: task.assetId,
          watermarkConfigId,
          status: 'failed',
          shareLinkId,
        })
      } catch (e) {
        console.error('Failed to update watermark file status to failed:', e)
      }
    }
    await failTask(task.id, err)
    throw err
  }
}
