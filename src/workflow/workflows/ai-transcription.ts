import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@/generated/prisma/client'
import {
  getActivities,
  executeActivity,
  TaskQueueDb,
  TaskQueueTranscode,
  sleep,
} from '../workflow-utils'

export async function aiTranscriptionMedia(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    getAssetActivity,
    extractAiMetadataActivity,
    createCommentActivity,
    updateCommentActivity,
    getTranscodeWorkerQueueActivity,
    downloadMediaToTmpActivity,
    cleanupTmpDirActivity,
  } = getActivities()

  let placeholderCommentId: string | undefined
  let tmpDir: string | undefined
  let transcodeWorkerQueue: string | undefined

  try {
    // Update status to processing
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    // 0. Create Placeholder Comment
    const payload = task.payload
    const placeholder = await executeActivity(TaskQueueDb, createCommentActivity, {
      assetId: task.assetId,
      message: '__TRANSCRIPTION__',
      sessionId: payload?.agent?.sessionId || task.id,
      agentId: payload?.agent?.agentId || 'default',
    })
    placeholderCommentId = placeholder.id

    // 1. Get Asset
    const asset = await executeActivity(TaskQueueDb, getAssetActivity, task.assetId)
    const key = asset?.storageKey?.key
    if (!asset || !key) {
      throw ApplicationFailure.create({ message: 'Asset not found', nonRetryable: true })
    }

    // 2. Extract Audio (Requires FFmpeg)
    transcodeWorkerQueue = await executeActivity(
      TaskQueueTranscode,
      getTranscodeWorkerQueueActivity,
    )

    const download = await executeActivity(transcodeWorkerQueue, downloadMediaToTmpActivity, {
      assetKey: key,
    })
    const { filePath } = download
    tmpDir = download.tmpDir

    const generatedFiles = await executeActivity(transcodeWorkerQueue, extractAiMetadataActivity, {
      assetKey: key,
      filePath,
      type: 'transcription',
      isImage: false,
    })

    if (generatedFiles.length === 0) {
      throw ApplicationFailure.create({
        message: 'Failed to extract audio for transcription',
        nonRetryable: true,
      })
    }

    // Simulate work
    await sleep(2000)

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(TaskQueueDb, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: 'Transcription completed successfully.',
      })
    }

    // Update status to completed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AiTranscriptionMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId) {
      try {
        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      } catch (commentErr) {
        console.error('Failed to update error comment:', commentErr)
      }
    }

    // Update status to failed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'failed',
      output: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  } finally {
    if (tmpDir && transcodeWorkerQueue) {
      try {
        await executeActivity(transcodeWorkerQueue, cleanupTmpDirActivity, { tmpDir })
      } catch (cleanupErr) {
        console.error('Failed to cleanup tmp dir:', cleanupErr)
      }
    }
  }
}

// For Temporal, we often export as a named workflow
export const aiTranscriptionWorkflow = aiTranscriptionMedia
