import type { WorkflowTask } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'
import { ApplicationFailure, sleep } from '@shumai/workflow-core'
import {
  checkOrInitiateColdRestoreActivity,
  commitRestoreDbStateActivity,
  copyOriginalFromArchiveToMainActivity,
  deleteArchiveOriginalAfterRestoreActivity,
  prepareArchiveOrRestoreActivity,
  revertArchiveOrRestoreStatusOnFailureActivity,
} from '../activities/archive'
import { completeTask, startTask } from './common'

const DEFAULT_INITIAL_RESTORE_POLL_MS = 60_000
const DEFAULT_STEADY_RESTORE_POLL_MS = 300_000
const MAX_RESTORE_WAIT_MS = 48 * 60 * 60 * 1000

export async function restoreAssetWorkflow(task: WorkflowTask): Promise<void> {
  const storageKeyId = task.payload?.archive?.storageKeyId

  try {
    await startTask(task)

    const prep = await prepareArchiveOrRestoreActivity({
      taskId: task.id,
      assetId: task.assetId,
      storageKeyId,
      mode: 'restore',
    })

    if (prep.noop) {
      await completeTask(task.id)
      return
    }

    const customPollMs = process.env.ARCHIVE_RESTORE_POLL_INTERVAL_MS
      ? parseInt(process.env.ARCHIVE_RESTORE_POLL_INTERVAL_MS, 10)
      : undefined
    const initialPollMs =
      customPollMs && Number.isFinite(customPollMs) && customPollMs > 0
        ? customPollMs
        : DEFAULT_INITIAL_RESTORE_POLL_MS
    const steadyPollMs =
      customPollMs && Number.isFinite(customPollMs) && customPollMs > 0
        ? customPollMs
        : DEFAULT_STEADY_RESTORE_POLL_MS

    let elapsedWaitMs = 0
    let pollAttempt = 0

    while (elapsedWaitMs < MAX_RESTORE_WAIT_MS) {
      const restoreCheck = await checkOrInitiateColdRestoreActivity({ key: prep.key })

      if (restoreCheck.status === 'ready') {
        const copyResult = await copyOriginalFromArchiveToMainActivity({
          storageKeyId: prep.storageKeyId,
          key: prep.key,
          expectedSize: prep.expectedSize,
          contentType: prep.contentType,
        })

        if (copyResult.status === 'copied') {
          break
        }
      }

      const waitMs = pollAttempt < 10 ? initialPollMs : steadyPollMs
      await sleep(waitMs)
      elapsedWaitMs += waitMs
      pollAttempt++
    }

    if (elapsedWaitMs >= MAX_RESTORE_WAIT_MS) {
      throw ApplicationFailure.create({
        message: `Cold storage restore timed out after 48 hours for key: ${prep.key}`,
        nonRetryable: true,
      })
    }

    await commitRestoreDbStateActivity({
      storageKeyId: prep.storageKeyId,
    })

    await deleteArchiveOriginalAfterRestoreActivity({
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
      console.error('Failed to revert restore status on failure:', revertErr)
    })
    throw err
  }
}
