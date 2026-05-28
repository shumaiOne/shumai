import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@/generated/prisma/client'
import {
  getActivities,
  executeActivity,
  TaskQueueDb,
  TaskQueueAgent,
  TaskQueueTranscode,
} from '@/workflow/workflow-utils'

export async function agentAutofillMedia(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    getAssetActivity,
    extractAiMetadataActivity,
    getProjectAutofillFieldsActivity,
    getAgentAutofillContextActivity,
    autofillAiActivity,
    updateTaskUsageActivity,
    updateAssetMetadataActivity,
    createCommentActivity,
    updateCommentActivity,
    getTranscodeWorkerQueueActivity,
    getAgentWorkerQueueActivity,
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
      message: '__AUTOFILL__',
      sessionId: payload?.agent?.sessionId || task.id,
      agentId: payload?.agent?.agentId || 'default',
    })
    placeholderCommentId = placeholder.id

    // 1. Get Asset
    const asset = await executeActivity(TaskQueueDb, getAssetActivity, task.assetId)
    const key = asset?.storageKey?.key
    if (!asset || !asset.project || !key) {
      throw ApplicationFailure.create({ message: 'Asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId
    const projectId = asset.project.id

    // 2. Prepare Data (Images)
    const isImage = asset.mediaType?.startsWith('image/') || false

    // Extraction requires FFmpeg, run on Transcode worker
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
      type: 'autofill',
      isImage,
    })

    if (generatedFiles.length === 0) {
      // If no images could be extracted, we can't do much
      if (placeholderCommentId) {
        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: 'Autofill completed: No images could be extracted for analysis.',
        })
      }
      await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'completed',
      })
      return
    }

    // 3. Get Project Autofill Fields
    const fields = await executeActivity(TaskQueueDb, getProjectAutofillFieldsActivity, projectId)
    if (fields.length === 0) {
      if (placeholderCommentId) {
        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: 'Autofill completed: No autofill fields defined in project.',
        })
      }
      await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'completed',
      })
      return
    }

    // 3b. Fetch Agent Context (Database Activity on db_queue)
    const context = await executeActivity(TaskQueueDb, getAgentAutofillContextActivity, {
      teamId,
    })

    // 4. Call AI Service
    const agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    const aiResult = await executeActivity(agentWorkerQueue, autofillAiActivity, {
      teamId,
      images: generatedFiles,
      fields: fields.map((f) => ({
        id: f.key,
        config: f.config as unknown as PrismaJson.FieldConfig,
        description: f.description,
      })),
      context,
    })

    if (aiResult.usage) {
      // Update Usage
      await executeActivity(TaskQueueDb, updateTaskUsageActivity, {
        taskId: task.id,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        model: aiResult.usage.model,
      })
    }

    // 6. Update Asset Metadata
    const result = JSON.parse(aiResult.text)
    const metadataUpdates = Object.entries(result).map(([key, value]) => ({
      key,
      value,
    }))

    if (metadataUpdates.length > 0) {
      await executeActivity(TaskQueueDb, updateAssetMetadataActivity, {
        assetId: asset.id,
        metadata: metadataUpdates,
      })
    }

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(TaskQueueDb, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: 'Autofill completed successfully.',
        sessionId: aiResult.sessionId,
      })
    }

    // Update status to completed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AgentAutofillMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId) {
      try {
        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: `Autofill failed: ${err instanceof Error ? err.message : String(err)}`,
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

export const agentAutofillWorkflow = agentAutofillMedia
