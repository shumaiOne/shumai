import { HTTPException } from 'hono/http-exception'
import { resolveComment } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const resolveCommentOp = implementOperation(resolveComment, {
  authz: (input) => [
    { permission: Permission.Read, type: ResourceType.Comment, id: input.commentId },
  ],
  // The comment's file, for the audit entry.
  prepare: async (input) => {
    const comment = await assetService.getComment(input.commentId).catch(() => null)
    if (!comment) throw new HTTPException(404, { message: 'Comment not found' })
    return { assetId: comment.assetId }
  },
  execute: async (input, ctx) => {
    const updated = await assetService.completeComment(input.commentId, !input.reopen, ctx.userId)
    return { commentId: updated.id, resolved: updated.isCompleted }
  },
  audit: (input, _output, _ctx, comment) => [
    {
      action: AuditAction.comment_complete,
      itemId: input.commentId,
      contextAssetId: comment.assetId,
    },
  ],
})
