import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { prisma, type User } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

const readThreadSchema = Type.Object({
  threadId: Type.String({
    description:
      'The top-level comment ID or comment ID to read full conversation thread history for. Must be a comment ID (do NOT pass asset IDs).',
  }),
})

export function createReadThreadTool(userId?: string | null): AgentTool<typeof readThreadSchema> {
  return {
    name: 'read_thread',
    label: 'Read Comment Thread',
    description:
      'Retrieves the full conversation history of a specific comment thread by its comment ID. Do NOT pass asset IDs to this tool.',
    parameters: readThreadSchema,
    execute: async (_toolCallId, params) => {
      const targetCommentId = params.threadId

      // Find the comment to determine thread root
      const comment = await prisma.assetComment.findUnique({
        where: { id: targetCommentId },
        include: { creator: true, asset: { include: { project: true } } },
      })

      if (!comment) {
        throw new Error(`Comment thread with ID "${targetCommentId}" not found.`)
      }

      if (userId) {
        await authzService.hasPermission({
          user: { id: userId } as User,
          permission: Permission.Read,
          type: ResourceType.Asset,
          id: comment.assetId,
        })
      }

      const rootId = comment.replyToId ? comment.replyToId : comment.id

      // Fetch root comment + all replies
      const rootComment = await prisma.assetComment.findUnique({
        where: { id: rootId },
        include: { creator: true },
      })

      const replies = await prisma.assetComment.findMany({
        where: { replyToId: rootId },
        orderBy: { id: 'asc' },
        include: { creator: true },
      })

      const allComments = rootComment ? [rootComment, ...replies] : replies

      if (allComments.length === 0) {
        const emptyMsg = `No comments found for thread ID "${targetCommentId}".`
        return {
          content: [{ type: 'text', text: emptyMsg }],
          details: {},
        }
      }

      const formatted = allComments
        .map((c) => {
          const author = c.creator?.name || (c.creator?.type === 'agent' ? 'Ai Agent' : 'User')
          const time = c.createdAt.toISOString()
          return `[${author}] (${time}): ${c.message || '(no text)'}`
        })
        .join('\n')

      const text = `Comment Thread (Root ID: ${rootId}):\n${formatted}`
      return {
        content: [{ type: 'text', text }],
        details: {},
      }
    },
  }
}
