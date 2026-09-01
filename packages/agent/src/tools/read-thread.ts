import { prisma } from '@shumai/db'
import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'

const readThreadSchema = Type.Object({
  threadId: Type.String({
    description:
      'The root comment ID of a thread (from <thread id="..." /> in the <context> block). Do NOT pass an asset ID or project ID.',
  }),
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
      const isAsset = await prisma.asset.findUnique({
        where: { id: params.threadId },
        select: { id: true },
      })
      const errorText = isAsset
        ? `ID "${params.threadId}" is an Asset ID, not a Comment Thread ID. Do not pass asset IDs to read_thread.`
        : `Comment thread with ID "${params.threadId}" not found.`

      return {
        content: [{ type: 'text', text: errorText }],
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

    const isRootAgent = rootComment.creator?.type === 'agent' || rootComment.sessionId !== null
    const rootAuthor = rootComment.creator?.name || (isRootAgent ? 'Ai Agent' : 'User')
    let output = `Thread Root [${rootAuthor}] (${rootComment.id}): ${rootComment.message || ''}\n\nReplies (${replies.length}):`

    if (replies.length === 0) {
      output += '\n(No replies in this thread yet)'
    } else {
      for (const reply of replies) {
        const isAgent = reply.creator?.type === 'agent' || reply.sessionId !== null
        const author = reply.creator?.name || (isAgent ? 'Ai Agent' : 'User')
        output += `\n- [${author}]: ${reply.message || ''}`
      }
    }

    return {
      content: [{ type: 'text', text: output }],
      details: { threadId: params.threadId },
    }
  },
})
