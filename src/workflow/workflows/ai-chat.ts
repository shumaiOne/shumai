import type { WorkflowTask } from '@/generated/prisma/client'
import {
  getActivities,
  executeActivity,
  TaskQueueDb,
  TaskQueueAgent,
} from '@/workflow/workflow-utils'

export async function aiChat(task: WorkflowTask): Promise<void> {
  const {
    updateTaskStatusActivity,
    getAssetActivity,
    getCommentActivity,
    aiChatActivity,
    createCommentActivity,
    updateCommentActivity,
    updateTaskUsageActivity,
    getAgentWorkerQueueActivity,
    deleteCommentActivity,
  } = getActivities()

  let placeholderCommentId: string | undefined

  try {
    // Update status to processing
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = task.payload as any

    const sessionId = payload?.sessionId || payload?.session_id

    // 1. Get User Comment
    const userCommentId = payload?.userCommentId
    if (!userCommentId) throw new Error('userCommentId missing in payload')
    const userComment = await executeActivity(TaskQueueDb, getCommentActivity, userCommentId)
    if (!userComment) throw new Error('User comment not found')

    // 2. Create Placeholder Comment
    const placeholder = await executeActivity(TaskQueueDb, createCommentActivity, {
      assetId: task.assetId,
      message: '__CHAT__',
      sessionId: sessionId || 'pending',
      agentId: payload?.agentId,
      replyToId: userComment.replyToId ?? userComment.id,
    })
    placeholderCommentId = placeholder.id

    // 3. Get Asset
    const asset = await executeActivity(TaskQueueDb, getAssetActivity, task.assetId)
    if (!asset || !asset.project) {
      throw new Error('Asset or project not found')
    }
    const teamId = asset.project.teamId

    // 4. Prepare Images (Attachments only)
    const attachmentImageUrls: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCommentWithAttachments = userComment as any
    if (userCommentWithAttachments?.attachments) {
      for (const att of userCommentWithAttachments.attachments) {
        if (att.asset?.mediaType?.startsWith('image/') && att.asset?.key) {
          attachmentImageUrls.push(att.asset.key)
        }
      }
    }

    let instruction = `The user is discussing an asset with ID: ${asset.id}.`

    if (asset.media) {
      instruction += `\n\nAsset Media Info:\n${JSON.stringify(asset.media, null, 2)}`
    }

    instruction += `\n\nIf you need to view the asset's media content (frames/images/video), call the 'analyze_asset_media' tool by passing the appropriate 'key' from the Asset Media Info above. Choose the most suitable format based on your capabilities and the user's request (e.g., use a poster or sprite for quick visual checks, or a transcode/raw file for detailed analysis).`

    if (payload?.explicitMention) {
      instruction += `\n\nThe user explicitly mentioned you in their message. You MUST reply to this message.`
    } else {
      instruction += `\n\nThe user did not explicitly mention you, but is replying in a thread where you are the participant. Let's decide if you should reply or not. If the user is not directly addressing you or doesn't need a response from you, you may choose to not reply. To choose not to reply, respond with exactly and only the text: __NO_REPLY__.`
    }

    // 5. Call AI Chat
    let folderId = ''
    if (asset.type === 'folder') {
      folderId = asset.id
    } else if (asset.parentId) {
      folderId = asset.parentId
    }

    const agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    const aiResult = await executeActivity(agentWorkerQueue, aiChatActivity, {
      teamId,
      agentId: payload.agentId,
      message: userComment.message || '',
      imageUrls: attachmentImageUrls,
      projectId: payload.projectId,
      folderId,
      agentsInstruction: instruction,
      sessionId,
      userId: payload.userId,
      userCommentId,
      explicitMention: payload?.explicitMention,
    })

    // 6. Update Placeholder Comment
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

    // 7. Update Usage
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
    console.error(`AiChat failed for task ${task.id}:`, err)

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

export const aiChatWorkflow = aiChat
