import { prisma, type User } from '@shumai/db'
import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { secondToDegree } from '@shumai/core/src/utils/model3d'
import { getProxyType } from '@shumai/core/src/utils/mime'

const readThreadSchema = Type.Object({
  threadId: Type.String({
    description:
      'The root comment ID of a thread (from <thread id="..." /> in the <context> block). Do NOT pass an asset ID or project ID.',
  }),
})

function formatCommentMeta(
  c: {
    id: string
    second?: number | null
    annotation?: unknown
  },
  proxyType?: string,
): string {
  const parts = [`id: ${c.id}`]
  if (c.second !== null && c.second !== undefined) {
    if (proxyType === '3d') {
      parts.push(`degree: ${secondToDegree(c.second)}°`)
    } else {
      parts.push(`time: ${c.second}s`)
    }
  }
  const hasMarkup = Boolean(c.annotation && Array.isArray(c.annotation) && c.annotation.length > 0)
  parts.push(`has_markup: ${hasMarkup}`)
  return `(${parts.join(', ')})`
}

export interface ReadThreadToolContext {
  /** The user the agent acts for. When set, the user must be able to read the thread's asset. */
  userId?: string
  /** The agent's team. System agents without a user may only read threads in this team. */
  teamId: string
}

/**
 * Ensure the caller may read a thread on `assetId` before any thread content is
 * returned: the acting user needs Read on the asset; a system agent (no user)
 * is confined to its own team.
 */
async function assertCanReadThread(assetId: string, ctx: ReadThreadToolContext): Promise<void> {
  if (ctx.userId) {
    await authzService.hasPermission({
      user: { id: ctx.userId } as User,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: assetId,
    })
    return
  }

  const assetCtx = await assetService.getAssetContext(assetId).catch(() => null)
  if (!assetCtx || assetCtx.teamId !== ctx.teamId) {
    throw new Error('Access denied: this comment thread does not belong to your team.')
  }
}

export const createReadThreadTool = (
  ctx: ReadThreadToolContext,
): AgentTool<typeof readThreadSchema, { threadId: string }> => ({
  name: 'read_thread',
  label: 'Read Comment Thread',
  description: 'Reads all comments and replies inside a specific comment thread.',
  parameters: readThreadSchema,
  execute: async (_toolCallId, params) => {
    const rootComment = await prisma.assetComment.findUnique({
      where: { id: params.threadId },
      include: {
        creator: true,
        asset: { select: { media: true, mediaType: true, name: true } },
      },
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

    await assertCanReadThread(rootComment.assetId, ctx)

    const replies = await prisma.assetComment.findMany({
      where: {
        replyToId: rootComment.id,
        message: { not: '__CHAT__' },
      },
      orderBy: { id: 'asc' },
      include: { creator: true },
    })

    const proxyType =
      (rootComment.asset?.media as PrismaJson.MediaInfo | null)?.proxyType ||
      getProxyType(rootComment.asset?.mediaType, rootComment.asset?.name) ||
      undefined

    const isRootAgent = rootComment.creator?.type === 'agent' || rootComment.sessionId !== null
    const rootAuthor = rootComment.creator?.name || (isRootAgent ? 'Ai Agent' : 'User')
    const rootMeta = formatCommentMeta(rootComment, proxyType)
    let output = `Thread Root [${rootAuthor}] ${rootMeta}: ${rootComment.message || ''}\n\nReplies (${replies.length}):`

    if (replies.length === 0) {
      output += '\n(No replies in this thread yet)'
    } else {
      for (const reply of replies) {
        const isAgent = reply.creator?.type === 'agent' || reply.sessionId !== null
        const author = reply.creator?.name || (isAgent ? 'Ai Agent' : 'User')
        const replyMeta = formatCommentMeta(reply, proxyType)
        output += `\n- [${author}] ${replyMeta}: ${reply.message || ''}`
      }
    }

    return {
      content: [{ type: 'text', text: output }],
      details: { threadId: params.threadId },
    }
  },
})
