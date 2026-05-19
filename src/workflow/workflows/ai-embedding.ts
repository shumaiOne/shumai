import type { WorkflowTask } from '@/generated/prisma/client'
import { getActivities, executeActivity, TaskQueueDb, TaskQueueAgent } from '../workflow-utils'

export async function aiEmbeddingMedia(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    generateEmbeddingActivity,
    updateTaskUsageActivity,
    createCommentActivity,
    updateCommentActivity,
    getAgentWorkerQueueActivity,
  } = getActivities()

  let placeholderCommentId: string | undefined

  try {
    // Update status to processing
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    // 0. Create Placeholder Comment
    const payload = task.payload as Record<string, unknown>
    const placeholder = await executeActivity(TaskQueueDb, createCommentActivity, {
      assetId: task.assetId,
      message: '__EMBEDDING__',
      isAi: true,
      agentId: (payload?.agentId as string) || 'default',
    })
    placeholderCommentId = placeholder.id

    if (!task.teamId) throw new Error('Task has no teamId')

    const agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    // Call the activity to generate embeddings
    const result = await executeActivity(agentWorkerQueue, generateEmbeddingActivity, {
      teamId: task.teamId,
      assetId: task.assetId,
    })

    // Update Usage
    if (result) {
      await executeActivity(TaskQueueDb, updateTaskUsageActivity, {
        taskId: task.id,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
      })
    }

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(TaskQueueDb, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: 'Embedding completed successfully.',
      })
    }

    // Update status to completed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AiEmbeddingMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId) {
      try {
        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
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
  }
}

export const aiEmbeddingWorkflow = aiEmbeddingMedia
