import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import {
  executeActivity,
  getActivities,
  TaskQueueAgent,
  TaskQueueDb,
} from '@/workflow/workflow-utils'

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

  try {
    // Update status to processing
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
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
    const userComment = await executeActivity(TaskQueueDb, getCommentActivity, userCommentId)
    if (!userComment) {
      throw ApplicationFailure.create({ message: 'User comment not found', nonRetryable: true })
    }

    // 2. Create Placeholder Comment
    const placeholder = await executeActivity(TaskQueueDb, createCommentActivity, {
      assetId: task.assetId,
      message: '__CHAT__',
      sessionId: sessionId || 'pending',
      agentId: agentId,
      replyToId: userComment.replyToId ?? userComment.id,
    })
    placeholderCommentId = placeholder.id

    // 3. Get Asset
    const asset = await executeActivity(TaskQueueDb, getAssetActivity, task.assetId)
    if (!asset || !asset.project) {
      throw ApplicationFailure.create({ message: 'Asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId

    // 4. Initialize Session if missing (Database Activity on db_queue)
    if (!sessionId) {
      sessionId = await executeActivity(TaskQueueDb, initializeAgentSessionActivity, {
        teamId,
        agentId: agentId,
        userCommentId,
        userId: payload.agent?.userId,
      })
    }

    // 4b. Fetch Agent Context (Database Activity on db_queue)
    const context = await executeActivity(TaskQueueDb, getAgentChatContextActivity, {
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
      TaskQueueDb,
      getAssetPathContextActivity,
      task.assetId,
    )

    let instruction = `The user is discussing an asset with ID: ${asset.id}.`
    if (pathContext) {
      instruction += `\n\nAsset Path Context:\n${pathContext}`
    }

    if (asset.media) {
      instruction += `\n\nAsset Media Info:\n${JSON.stringify(asset.media, null, 2)}`
    }

    instruction += `\n\nIf you need to view the asset's media content (frames/images/video), call the 'analyze_asset_media' tool by passing the appropriate 'key' from the Asset Media Info above. Choose the most suitable format based on your capabilities and the user's request (e.g., use a poster or sprite for quick visual checks, or a transcode/raw file for detailed analysis).`

    if (payload.agent?.explicitMention) {
      instruction += `\n\nThe user explicitly mentioned you in their message. You MUST reply to this message.`
    } else {
      instruction += `\n\nThe user did not explicitly mention you, but is replying in a thread where you are the participant. Let's decide if you should reply or not. If the user is not directly addressing you or doesn't need a response from you, you may choose to not reply. To choose not to reply, respond with exactly and only the text: __NO_REPLY__.`
    }

    // 6. Call AI Chat
    let folderId = ''
    if (asset.type === 'folder') {
      folderId = asset.id
    } else if (asset.parentId) {
      folderId = asset.parentId
    }

    const agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

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
      explicitMention: payload.agent?.explicitMention,
      context,
    })

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      if (aiResult.text.trim() === '__NO_REPLY__') {
        await executeActivity(TaskQueueDb, deleteCommentActivity, placeholderCommentId)
      } else {
        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: aiResult.text,
          sessionId: aiResult.sessionId,
        })
      }
    }

    // 8. Update Usage
    if (aiResult.usage) {
      await executeActivity(TaskQueueDb, updateTaskUsageActivity, {
        taskId: task.id,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        model: aiResult.usage.model,
      })
    }

    // Update status to completed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
      output: { sessionId: aiResult.sessionId },
    })
  } catch (err) {
    console.error(`AgentChat failed for task ${task.id}:`, err)

    // Update placeholder comment with error message
    if (placeholderCommentId) {
      try {
        const errorMessage =
          err instanceof Error && err.message.startsWith('AI error:')
            ? `AI error: ${err.message.substring(9)}`
            : 'Sorry, I encountered an error while processing your request.'

        await executeActivity(TaskQueueDb, updateCommentActivity, {
          commentId: placeholderCommentId,
          message: errorMessage,
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

export const agentChatWorkflow = agentChat
