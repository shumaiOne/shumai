import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import {
  commitArchiveDbStateActivity,
  copyOriginalToArchiveStorageActivity,
  deleteMainOriginalAfterArchiveActivity,
  prepareArchiveOrRestoreActivity,
  revertArchiveOrRestoreStatusOnFailureActivity,
} from '../activities/archive'
import { completeTask, startTask } from './common'

export async function archiveAssetWorkflow(task: WorkflowTask): Promise<void> {
  const storageKeyId = task.payload?.archive?.storageKeyId

  try {
    await startTask(task)

    const prep = await prepareArchiveOrRestoreActivity({
      taskId: task.id,
      assetId: task.assetId,
      storageKeyId,
      mode: 'archive',
    })

    if (prep.noop) {
      await completeTask(task.id)
      return
    }

    await copyOriginalToArchiveStorageActivity({
      storageKeyId: prep.storageKeyId,
      key: prep.key,
      expectedSize: prep.expectedSize,
      contentType: prep.contentType,
    })

    await commitArchiveDbStateActivity({
      storageKeyId: prep.storageKeyId,
    })

    await deleteMainOriginalAfterArchiveActivity({
      key: prep.key,
    })

    await completeTask(task.id)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await revertArchiveOrRestoreStatusOnFailureActivity({
      taskId: task.id,
      storageKeyId,
      assetId: task.assetId,
      errorMessage,
    }).catch((revertErr) => {
      console.error('Failed to revert archive status on failure:', revertErr)
    })
    throw err
  }
}
