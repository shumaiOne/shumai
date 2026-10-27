import { DEFAULT_PAGE_SIZE, listComments, type CommentThread } from '@shumai/operations'
import type { CommentInfo } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

/** Placeholder reply that anchors an agent chat session to a thread; not a real comment. */
const CHAT_PLACEHOLDER = '__CHAT__'

function toCommentFields(comment: CommentInfo) {
  return {
    id: comment.id,
    message: comment.message ?? '',
    author: { id: comment.creator.id, name: comment.creator.name },
    second: comment.second,
    hasMarkup: Array.isArray(comment.annotations) && comment.annotations.length > 0,
    attachmentCount: comment.attachments.length,
    createdAt: comment.createdAt,
  }
}

export function toCommentThread(comment: CommentInfo): CommentThread {
  return {
    ...toCommentFields(comment),
    resolved: comment.isCompleted,
    replies: comment.replies.filter((r) => r.message !== CHAT_PLACEHOLDER).map(toCommentFields),
  }
}

export const listCommentsOp = implementOperation(listComments, {
  authz: (input) => [{ permission: Permission.Read, type: ResourceType.Asset, id: input.assetId }],
  execute: async (input, ctx) => {
    const result = await assetService.listComments(
      input.assetId,
      { first: input.first ?? DEFAULT_PAGE_SIZE, after: input.after },
      ctx.userId,
    )
    return {
      data: result.data.map(toCommentThread),
      pageInfo: {
        hasNextPage: Boolean(result.pageInfo.cursor),
        endCursor: result.pageInfo.cursor ?? null,
      },
      total: result.pageInfo.total ?? result.data.length,
    }
  },
})
