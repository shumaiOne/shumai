import { createComment } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { commentService } from '@shumai/core/src/comment/comment'
import { implementOperation } from '../implement'

export const createCommentOp = implementOperation(createComment, {
  // Commenting needs Read on the file, as in the web app; a reply also needs access to the
  // thread it replies to.
  authz: (input) => [
    { permission: Permission.Read, type: ResourceType.Asset, id: input.assetId },
    ...(input.replyToId
      ? [{ permission: Permission.Read, type: ResourceType.Comment, id: input.replyToId }]
      : []),
  ],
  execute: async (input, ctx) => {
    const comment = await commentService.postComment({
      assetId: input.assetId,
      userId: ctx.userId,
      message: input.message,
      replyToId: input.replyToId,
      second: input.second,
      // Mentions in comments written by Shumai's own agent must not start more agent runs.
      triggerAgents: ctx.via !== 'agent',
    })
    return { id: comment.id, assetId: comment.assetId, replyToId: input.replyToId ?? null }
  },
  audit: (input, output) => [
    { action: AuditAction.comment_create, itemId: output.id, contextAssetId: input.assetId },
  ],
})
