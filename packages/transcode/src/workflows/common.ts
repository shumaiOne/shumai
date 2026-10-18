import type { WorkflowTask } from '@shumai/db'
import {
  ApplicationFailure,
  getAssetActivity,
  updateAssetStatusActivity,
  updateTaskStatusActivity,
} from '@shumai/workflow-core'
import { cleanupTmpDirActivity } from '../activities/transcode'

export async function startTask(task: WorkflowTask): Promise<void> {
  await updateTaskStatusActivity({
    taskId: task.id,
    status: 'processing',
  })
}

/**
 * @deprecated Use `startTask(task)` instead.
 */
export async function getWorkerQueueAndStartTask(task: WorkflowTask): Promise<string> {
  await startTask(task)
  return ''
}

export async function fetchAssetWithKey(
  assetId: string,
): Promise<{ asset: NonNullable<Awaited<ReturnType<typeof getAssetActivity>>>; key: string }> {
  const asset = await getAssetActivity(assetId)
  const key = asset?.storageKey?.key
  if (!asset || !key || asset.status === 'pending_purge') {
    throw ApplicationFailure.create({
      message: 'Asset not found, has no key, or is being purged',
      nonRetryable: true,
    })
  }
  return { asset, key }
}

export async function completeTask(taskId: string, output?: Record<string, unknown>) {
  await updateTaskStatusActivity({
    taskId,
    status: 'completed',
    ...(output ? { output } : {}),
  })
}

export async function failTask(taskId: string, err: unknown, assetId?: string) {
  const errorMsg = err instanceof Error ? err.message : String(err)
  await updateTaskStatusActivity({
    taskId,
    status: 'failed',
    output: { error: errorMsg },
  })
  if (assetId) {
    try {
      await updateAssetStatusActivity({
        assetId,
        status: 'failed',
        error: errorMsg,
      })
    } catch (assetErr) {
      console.error('Failed to update asset status to failed:', assetErr)
    }
  }
}

export async function cleanupTmpDir(tmpDir: string | undefined) {
  if (tmpDir) {
    try {
      await cleanupTmpDirActivity({ tmpDir })
    } catch (cleanupErr) {
      console.error('Failed to cleanup tmp dir:', cleanupErr)
    }
  }
}
