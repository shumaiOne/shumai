import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { executeActivity, getActivities, TaskQueueAgent } from '@shumai/workflow-core'
import type {
  ShumaiMessageContext,
  ShumaiAssetContext,
  ShumaiAttachedFileContext,
  ShumaiMediaPosition,
} from '@shumai/dtos'

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
    initializeAgentSessionActivity,
    getAssetPathHierarchyActivity,
    getAssetPathContextActivity,
    generateSessionNameActivity,
    getUserTeamInfoActivity,
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
    let prompt = ''
    let attachmentImageUrls: string[] = []
    let commentTimestamp: number | undefined
    let commentAnnotation = false
    let commentCreatorId: string | undefined

    if (userCommentId) {
      const userComment = await executeActivity(agentWorkerQueue, getCommentActivity, userCommentId)
      if (!userComment) {
        throw ApplicationFailure.create({ message: 'User comment not found', nonRetryable: true })
      }
      prompt = userComment.message || ''
      commentCreatorId = userComment.creatorId || undefined
      if (userComment.second !== null && userComment.second !== undefined) {
        commentTimestamp = userComment.second
      }
      if (
        userComment.annotation &&
        Array.isArray(userComment.annotation) &&
        userComment.annotation.length > 0
      ) {
        commentAnnotation = true
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

      // Prepare Images (Attachments only)
      if (userComment.attachments) {
        for (const att of userComment.attachments) {
          const attProxyType = (att.asset?.media as PrismaJson.MediaInfo | null)?.proxyType
          if (attProxyType === 'image' && att.asset?.storageKey?.key) {
            attachmentImageUrls.push(att.asset.storageKey.key)
          }
        }
      }
    } else {
      prompt = payload.agent?.prompt || ''
      attachmentImageUrls = payload.agent?.imageUrls || []
    }

    // 3. Get Asset
    const asset = await executeActivity(agentWorkerQueue, getAssetActivity, task.assetId)
    if (!asset || !asset.project) {
      throw ApplicationFailure.create({ message: 'Asset or project not found', nonRetryable: true })
    }
    const teamId = asset.project.teamId

    // 4. Initialize Session if missing
    let isNewChat = !payload.agent?.sessionId || payload.agent?.isNewChat === true
    if (!sessionId) {
      if (!userCommentId) {
        throw ApplicationFailure.create({
          message: 'sessionId is required when userCommentId is missing',
          nonRetryable: true,
        })
      }
      sessionId = await executeActivity(agentWorkerQueue, initializeAgentSessionActivity, {
        teamId,
        agentId: agentId,
        userCommentId,
        userId: payload.agent?.userId,
      })
      isNewChat = true
    }

    // 4b. Fetch Agent Context
    const context = await executeActivity(agentWorkerQueue, getAgentChatContextActivity, {
      teamId,
      agentId: agentId,
      userId: payload.agent?.userId,
      projectId: payload.projectId,
    })

    const pathHierarchy = await executeActivity(
      agentWorkerQueue,
      getAssetPathHierarchyActivity,
      task.assetId,
    )
    const assetPath = pathHierarchy?.path || ''
    const ancestors = pathHierarchy?.ancestors || []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaInfo = asset.media as any
    const duration = mediaInfo?.duration
    const totalPages = mediaInfo?.frames || mediaInfo?.metadata?.totalFrames
    const proxyType = (asset.media as PrismaJson.MediaInfo | null)?.proxyType

    // Resolve Attached Files Details
    const attachedFiles: ShumaiAttachedFileContext[] = []
    const attachedAssets: Array<{ id: string; name: string; type: string }> = []
    if (payload.agent?.attachedFiles) {
      for (const fileId of payload.agent.attachedFiles) {
        const file = await executeActivity(agentWorkerQueue, getAssetActivity, fileId)
        if (file) {
          const filePath = await executeActivity(
            agentWorkerQueue,
            getAssetPathContextActivity,
            fileId,
          )
          attachedFiles.push({
            id: file.id,
            name: file.name,
            type: file.type,
            mediaType: file.mediaType || undefined,
            path: filePath || undefined,
          })
          attachedAssets.push({ id: file.id, name: file.name, type: file.type })
        }
      }
    }

    // Resolve Referenced Workspace Assets Details
    const referencedAssets: ShumaiAttachedFileContext[] = []
    if (payload.agent?.assetIds) {
      for (const assetId of payload.agent.assetIds) {
        const referencedAsset = await executeActivity(agentWorkerQueue, getAssetActivity, assetId)
        if (referencedAsset) {
          const filePath = await executeActivity(
            agentWorkerQueue,
            getAssetPathContextActivity,
            assetId,
          )
          referencedAssets.push({
            id: referencedAsset.id,
            name: referencedAsset.name,
            type: referencedAsset.type,
            mediaType: referencedAsset.mediaType || undefined,
            path: filePath || undefined,
          })
          attachedAssets.push({
            id: referencedAsset.id,
            name: referencedAsset.name,
            type: referencedAsset.type,
          })
        }
      }
    }

    // Resolve User Info
    const targetUserId = userCommentId ? commentCreatorId : payload.agent?.userId
    let userInfo: { name: string; role: string } | null = null
    if (targetUserId) {
      userInfo = await executeActivity(agentWorkerQueue, getUserTeamInfoActivity, {
        userId: targetUserId,
        teamId,
      })
    }

    // Build position
    let mediaPosition: ShumaiMediaPosition | undefined
    if (commentTimestamp !== undefined && commentTimestamp !== null) {
      if (proxyType === 'pdf') {
        mediaPosition = { type: 'page', page: Math.round(commentTimestamp) }
      } else {
        mediaPosition = { type: 'time', seconds: commentTimestamp }
      }
    }

    // Build Current Asset Context
    const currentAssetContext: ShumaiAssetContext = {
      id: asset.id,
      name: asset.name,
      type: asset.type as 'file' | 'folder' | 'version_stack',
      mediaType: asset.mediaType as 'image' | 'video' | 'pdf' | 'audio' | 'other' | undefined,
      parentId: asset.parentId || undefined,
      path: assetPath || undefined,
      durationSeconds: duration !== undefined ? duration : undefined,
      totalPages: totalPages !== undefined ? totalPages : undefined,
      navigated: payload.agent?.hasAssetChanged === true ? true : undefined,
      ancestors: ancestors.length > 0 ? ancestors : undefined,
    }

    // Build structured ShumaiMessageContext
    const messageContext: ShumaiMessageContext = {
      ...(userInfo
        ? { user: { id: targetUserId!, name: userInfo.name, role: userInfo.role } }
        : {}),
      currentAsset: currentAssetContext,
      ...(mediaPosition ? { position: mediaPosition } : {}),
      ...(commentAnnotation ? { annotation: true } : {}),
      ...(attachedFiles.length > 0 ? { attachedFiles } : {}),
      ...(referencedAssets.length > 0 ? { referencedAssets } : {}),
    }

    // 6. Call AI Chat
    let folderId = ''
    if (asset.type === 'folder') {
      folderId = asset.id
    } else if (asset.parentId) {
      folderId = asset.parentId
    }

    const aiResult = await executeActivity(agentWorkerQueue, agentChatActivity, {
      taskId: task.id,
      teamId,
      agentId: agentId,
      message: prompt,
      imageUrls: attachmentImageUrls,
      projectId: payload.projectId,
      folderId,
      assetId: asset.id,
      sessionId,
      userId: payload.agent?.userId,
      userCommentId: userCommentId || undefined,
      context,
      messageContext,
      attachedAssets,
    })

    // 7. Update Placeholder Comment
    if (placeholderCommentId) {
      await executeActivity(agentWorkerQueue, updateCommentActivity, {
        commentId: placeholderCommentId,
        message: aiResult.text,
        sessionId: aiResult.sessionId,
      })
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

    // 9. Generate Session Name for new chats
    if (isNewChat) {
      await executeActivity(agentWorkerQueue, generateSessionNameActivity, {
        teamId,
        agentId,
        prompt,
        sessionId,
        context,
      }).catch((err) => {
        console.error('Failed to run generateSessionNameActivity:', err)
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
        let errorMessage = 'Sorry, I encountered an error while processing your request.'
        if (err instanceof Error) {
          if (err.message.startsWith('AI error:')) {
            errorMessage = `AI error: ${err.message.substring(9)}`
          } else if (
            err.message.includes('aborted') ||
            err.message.includes('abort') ||
            err.name === 'AbortError' ||
            err.message.includes('cancel')
          ) {
            errorMessage = 'Agent execution stopped.'
          }
        } else if (
          String(err).includes('aborted') ||
          String(err).includes('abort') ||
          String(err).includes('cancel')
        ) {
          errorMessage = 'Agent execution stopped.'
        }

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
