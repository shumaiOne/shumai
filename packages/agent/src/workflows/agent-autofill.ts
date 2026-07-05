import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import {
  getActivities,
  executeActivity,
  TaskQueueAgent,
  TaskQueueTranscode,
} from '@shumai/workflow-core'

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
  let transcodeWorkerQueue = ''
  let agentWorkerQueue = ''

  try {
    // 0. Discover queues
    agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)
    transcodeWorkerQueue = await executeActivity(
      TaskQueueTranscode,
      getTranscodeWorkerQueueActivity,
    )

    // Update status to processing
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    // 0. Create Placeholder Comment
    const payload = task.payload
    const placeholder = await executeActivity(agentWorkerQueue, createCommentActivity, {
      assetId: task.assetId,
      message: '__AUTOFILL__',
      sessionId: payload?.agent?.sessionId || task.id,
      agentId: payload?.agent?.agentId || 'default',
    })
    placeholderCommentId = placeholder.id

    // 1. Get Asset
    const asset = await executeActivity(agentWorkerQueue, getAssetActivity, task.assetId)
    const key = asset?.storageKey?.key
    if (!asset || !asset.project || !key) {
      throw ApplicationFailure.create({ message: 'Asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId
    const projectId = asset.project.id

    // 2. Prepare Data (Images)
    const isImage = asset.mediaType?.startsWith('image/') || false
    const isVideo = asset.mediaType?.startsWith('video/') || false

    if (!isImage && !isVideo) {
      throw ApplicationFailure.create({
        message: `unsupported media type for autofill: ${asset.mediaType}`,
        nonRetryable: true,
      })
    }

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
        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: 'Autofill completed: No images could be extracted for analysis.',
        })
      }
      await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'completed',
      })
      return
    }

    // 3. Get Project Autofill Fields
    const fields = await executeActivity(
      agentWorkerQueue,
      getProjectAutofillFieldsActivity,
      projectId,
    )
    if (fields.length === 0) {
      if (placeholderCommentId) {
        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: 'Autofill completed: No autofill fields defined in project.',
        })
      }
      await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'completed',
      })
      return
    }

    // 3b. Fetch Agent Context
    const context = await executeActivity(agentWorkerQueue, getAgentAutofillContextActivity, {
      teamId,
    })

    // 4. Call AI Service
    const aiResult = await executeActivity(agentWorkerQueue, autofillAiActivity, {
      teamId,
      images: generatedFiles,
      fields: fields.map(
        (f: { key: string; config: Record<string, unknown>; description?: string | null }) => ({
          id: f.key,
          config: f.config as unknown as PrismaJson.FieldConfig,
          description: f.description,
        }),
      ),
      context,
    })

    if (aiResult.usage) {
      // Update Usage
      await executeActivity(agentWorkerQueue, updateTaskUsageActivity, {
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
      await executeActivity(agentWorkerQueue, updateAssetMetadataActivity, {
        assetId: asset.id,
        metadata: metadataUpdates,
      })
    }

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(agentWorkerQueue, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: 'Autofill completed successfully.',
        sessionId: aiResult.sessionId,
      })
    }

    // Update status to completed
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AgentAutofillMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId && agentWorkerQueue) {
      try {
        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: `Autofill failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      } catch (commentErr) {
        console.error('Failed to update error comment:', commentErr)
      }
    }

    // Update status to failed
    if (agentWorkerQueue) {
      await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'failed',
        output: { error: err instanceof Error ? err.message : String(err) },
      })
    }
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
