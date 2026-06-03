import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { getActivities, executeActivity, TaskQueueAgent } from '@shumai/workflow-core'

export async function agentEmbeddingMedia(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    getEmbeddingContextActivity,
    generateEmbeddingActivity,
    saveAssetEmbeddingsActivity,
    updateTaskUsageActivity,
    createCommentActivity,
    updateCommentActivity,
    getAgentWorkerQueueActivity,
  } = getActivities()

  let placeholderCommentId: string | undefined
  let agentWorkerQueue = ''

  try {
    // 0. Discover queue
    agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    // Update status to processing
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    // 0. Create Placeholder Comment
    const payload = task.payload
    const placeholder = await executeActivity(agentWorkerQueue, createCommentActivity, {
      assetId: task.assetId,
      message: '__EMBEDDING__',
      sessionId: payload?.agent?.sessionId || task.id,
      agentId: payload?.agent?.agentId || 'default',
    })
    placeholderCommentId = placeholder.id

    if (!task.teamId) {
      throw ApplicationFailure.create({ message: 'Task has no teamId', nonRetryable: true })
    }

    // 1. Fetch Agent Context
    const context = await executeActivity(agentWorkerQueue, getEmbeddingContextActivity, {
      teamId: task.teamId,
      assetId: task.assetId,
    })

    // Call the activity to generate embeddings
    const result = await executeActivity(agentWorkerQueue, generateEmbeddingActivity, {
      teamId: task.teamId,
      assetId: task.assetId,
      context,
    })

    // Save computed embeddings
    if (result.embeddings.length > 0) {
      await executeActivity(agentWorkerQueue, saveAssetEmbeddingsActivity, {
        assetId: task.assetId,
        embeddings: result.embeddings,
      })
    }

    // Update Usage
    if (result.usage) {
      await executeActivity(agentWorkerQueue, updateTaskUsageActivity, {
        taskId: task.id,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        model: result.usage.model,
      })
    }

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(agentWorkerQueue, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: 'Embedding completed successfully.',
      })
    }

    // Update status to completed
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
    })
  } catch (err) {
    console.error(`AgentEmbeddingMedia failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId && agentWorkerQueue) {
      try {
        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
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
  }
}

export const agentEmbeddingWorkflow = agentEmbeddingMedia
