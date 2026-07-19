import type { WorkflowTask } from '@shumai/db'
import { executeActivity, getActivities, TaskQueueTranscode } from '@shumai/workflow-core'
import { ApplicationFailure } from '@temporalio/workflow'

export async function getWorkerQueueAndStartTask(task: WorkflowTask): Promise<string> {
  const { getTranscodeWorkerQueueActivity, updateTaskStatusActivity } = getActivities()
  const workerQueue = await executeActivity(TaskQueueTranscode, getTranscodeWorkerQueueActivity)
  await executeActivity(workerQueue, updateTaskStatusActivity, {
    taskId: task.id,
    status: 'processing',
  })
  return workerQueue
}

export async function fetchAssetWithKey(workerQueue: string, assetId: string) {
  const { getAssetActivity } = getActivities()
  const asset = await executeActivity(workerQueue, getAssetActivity, assetId)
  const key = asset?.storageKey?.key
  if (!asset || !key) {
    throw ApplicationFailure.create({
      message: 'Asset not found or has no key',
      nonRetryable: true,
    })
  }
  return { asset, key }
}

export async function completeTask(
  workerQueue: string,
  taskId: string,
  output?: Record<string, unknown>,
) {
  const { updateTaskStatusActivity } = getActivities()
  await executeActivity(workerQueue, updateTaskStatusActivity, {
    taskId,
    status: 'completed',
    ...(output ? { output } : {}),
  })
}

export async function failTask(workerQueue: string, taskId: string, err: unknown) {
  const { updateTaskStatusActivity } = getActivities()
  if (workerQueue) {
    await executeActivity(workerQueue, updateTaskStatusActivity, {
      taskId,
      status: 'failed',
      output: { error: err instanceof Error ? err.message : String(err) },
    })
  }
}

export async function cleanupTmpDir(workerQueue: string, tmpDir: string | undefined) {
  if (tmpDir && workerQueue) {
    const { cleanupTmpDirActivity } = getActivities()
    try {
      await executeActivity(workerQueue, cleanupTmpDirActivity, { tmpDir })
    } catch (cleanupErr) {
      console.error('Failed to cleanup tmp dir:', cleanupErr)
    }
  }
}
