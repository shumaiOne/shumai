import type { CommentInfo } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { notificationService } from '@shumai/core/src/notification/notification'

export interface PostCommentParams {
  assetId: string
  userId: string
  message: string
  replyToId?: string
  /** Markup drawn on the frame or page (web app only). */
  annotations?: unknown
  /** Timecode in seconds (or the encoded viewing angle for 3D models). */
  second?: number
  attachmentIds?: string[]
  /** Whether mentions of agents start a chat with them (default true). */
  triggerAgents?: boolean
}

export class CommentService {
  /**
   * Posts a comment or reply and notifies the people involved: team members for a new
   * comment, the thread's author for a reply, and anyone mentioned.
   */
  async postComment(params: PostCommentParams): Promise<CommentInfo> {
    const comment = await assetService.createComment(
      {
        assetId: params.assetId,
        userId: params.userId,
        replyToId: params.replyToId,
        message: params.message,
        annotations: params.annotations,
        second: params.second,
        attachmentIds: params.attachmentIds ?? [],
      },
      { triggerAgents: params.triggerAgents },
    )

    const context = await assetService.getAssetContext(params.assetId)

    let targetUserId: string | undefined
    if (params.replyToId) {
      const parentComment = await assetService.getComment(params.replyToId).catch(() => null)
      if (parentComment?.creator?.id) {
        targetUserId = parentComment.creator.id
      }
    }

    // Delivery happens in the background; this only schedules it.
    await notificationService.create({
      type: params.replyToId ? 'reply_created' : 'comment_created',
      teamId: context.teamId,
      creatorId: params.userId,
      assetId: params.assetId,
      userId: targetUserId,
      commentMessage: params.message,
    })

    return comment
  }
}

export const commentService = new CommentService()
