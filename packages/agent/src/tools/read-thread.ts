import { prisma } from '@shumai/db'
import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'

const readThreadSchema = Type.Object({
  threadId: Type.String({ description: 'The comment ID of the thread root' }),
})

export const createReadThreadTool = (): AgentTool<
  typeof readThreadSchema,
  { threadId: string }
> => ({
  name: 'read_thread',
  label: 'Read Comment Thread',
  description: 'Reads all comments and replies inside a specific comment thread.',
  parameters: readThreadSchema,
  execute: async (_toolCallId, params) => {
    const rootComment = await prisma.assetComment.findUnique({
      where: { id: params.threadId },
      include: { creator: true },
    })

    if (!rootComment) {
      return {
        content: [{ type: 'text', text: `Comment thread with ID "${params.threadId}" not found.` }],
        details: { threadId: params.threadId },
      }
    }

    const replies = await prisma.assetComment.findMany({
      where: {
        replyToId: rootComment.id,
        message: { not: '__CHAT__' },
      },
      orderBy: { id: 'asc' },
      include: { creator: true },
    })

    const rootAuthor = rootComment.creator?.name || 'User'
    let output = `Thread Root [${rootAuthor}] (${rootComment.id}): ${rootComment.message || ''}\n\nReplies (${replies.length}):`

    if (replies.length === 0) {
      output += '\n(No replies in this thread yet)'
    } else {
      for (const reply of replies) {
        const author = reply.creator?.name || 'User'
        output += `\n- [${author}]: ${reply.message || ''}`
      }
    }

    return {
      content: [{ type: 'text', text: output }],
      details: { threadId: params.threadId },
    }
  },
})
