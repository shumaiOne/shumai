import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { executeActivity, getActivities, TaskQueueAgent } from '@shumai/workflow-core'
import { AgentChatPromptBuilder } from './agent-chat-prompt-builder'

export async function agentChat(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    getAssetActivity,
    getCommentActivity,
    getAgentChatContextActivity,
    agentChatActivity,
    createCommentActivity,
    updateCommentActivity,
    updateTaskUsageActivity,
    getAgentWorkerQueueActivity,
    deleteCommentActivity,
    initializeAgentSessionActivity,
    getAssetPathContextActivity,
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

    const payload = task.payload
    if (!payload) {
      throw ApplicationFailure.create({ message: 'Task payload is missing', nonRetryable: true })
    }

    const agentId = payload.agent?.agentId
    if (!agentId) {
      throw ApplicationFailure.create({ message: 'agentId missing in payload', nonRetryable: true })
    }

    let sessionId = payload.agent?.sessionId

    // 1. Get User Comment
    const userCommentId = payload.agent?.userCommentId
    if (!userCommentId) {
      throw ApplicationFailure.create({
        message: 'userCommentId missing in payload',
        nonRetryable: true,
      })
    }
    const userComment = await executeActivity(agentWorkerQueue, getCommentActivity, userCommentId)
    if (!userComment) {
      throw ApplicationFailure.create({ message: 'User comment not found', nonRetryable: true })
    }

    // 2. Create Placeholder Comment
    const placeholder = await executeActivity(agentWorkerQueue, createCommentActivity, {
      assetId: task.assetId,
      message: '__CHAT__',
      sessionId: sessionId || 'pending',
      agentId: agentId,
      replyToId: userComment.replyToId ?? userComment.id,
    })
    placeholderCommentId = placeholder.id

    // 3. Get Asset
    const asset = await executeActivity(agentWorkerQueue, getAssetActivity, task.assetId)
    if (!asset || !asset.project) {
      throw ApplicationFailure.create({ message: 'Asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId

    // 4. Initialize Session if missing
    if (!sessionId) {
      sessionId = await executeActivity(agentWorkerQueue, initializeAgentSessionActivity, {
        teamId,
        agentId: agentId,
        userCommentId,
        userId: payload.agent?.userId,
      })
    }

    // 4b. Fetch Agent Context
    const context = await executeActivity(agentWorkerQueue, getAgentChatContextActivity, {
      teamId,
      agentId: agentId,
    })

    // 5. Prepare Images (Attachments only)
    const attachmentImageUrls: string[] = []
    if (userComment?.attachments) {
      for (const att of userComment.attachments) {
        if (att.asset?.mediaType?.startsWith('image/') && att.asset?.storageKey?.key) {
          attachmentImageUrls.push(att.asset.storageKey.key)
        }
      }
    }

    const pathContext = await executeActivity(
      agentWorkerQueue,
      getAssetPathContextActivity,
      task.assetId,
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaInfo = asset.media as any
    const duration = mediaInfo?.duration

    const instruction = new AgentChatPromptBuilder(asset.id)
      .withPathContext(pathContext)
      .withAssetDetails(asset.name, asset.mediaType, duration)
      .withCommentTimestamp(userComment.second)
      .withExplicitMention(payload.agent?.explicitMention)
      .build()

    // 6. Call AI Chat
    let folderId = ''
    if (asset.type === 'folder') {
      folderId = asset.id
    } else if (asset.parentId) {
      folderId = asset.parentId
    }

    const aiResult = await executeActivity(agentWorkerQueue, agentChatActivity, {
      teamId,
      agentId: agentId,
      message: userComment.message || '',
      imageUrls: attachmentImageUrls,
      projectId: payload.projectId,
      folderId,
      agentsInstruction: instruction,
      sessionId,
      userId: payload.agent?.userId,
      userCommentId,
      explicitMention: payload.agent?.explicitMention,
      context,
    })

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      if (aiResult.text.trim() === '__NO_REPLY__') {
        await executeActivity(agentWorkerQueue, deleteCommentActivity, placeholderCommentId)
      } else {
        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: aiResult.text,
          sessionId: aiResult.sessionId,
        })
      }
    }

    // 8. Update Usage
    if (aiResult.usage) {
      await executeActivity(agentWorkerQueue, updateTaskUsageActivity, {
        taskId: task.id,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        model: aiResult.usage.model,
      })
    }

    // Update status to completed
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
      output: { sessionId: aiResult.sessionId },
    })
  } catch (err) {
    console.error(`AgentChat failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId && agentWorkerQueue) {
      try {
        const errorMessage =
          err instanceof Error && err.message.startsWith('AI error:')
            ? `AI error: ${err.message.substring(9)}`
            : 'Sorry, I encountered an error while processing your request.'

        await executeActivity(agentWorkerQueue, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: errorMessage,
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

export const agentChatWorkflow = agentChat
