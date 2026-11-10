import { BACKGROUND_CONTEXT as piContext } from '@earendil-works/chord/context'
import { createModels, type Message as AgentMessage } from '@earendil-works/pi-ai'
import {
  Harness,
  createRegistry,
  defineDoc,
  type Cursor,
  type EntryDraft,
  type JsonObject,
} from '@earendil-works/pi-durable'
import { agentSessionService } from '@shumai/core/src/agent/session-service'
import { secondToDegree } from '@shumai/core/src/utils/model3d'
import { prisma } from '@shumai/db'
import {
  ShumaiMessageEntry,
  type ShumaiMediaPosition,
  type ShumaiMessageContext,
} from '@shumai/dtos'
import { ApplicationFailure } from '@shumai/workflow-core'

const ThreadContextDoc = defineDoc<{ commentIds: string[] }>({
  kind: 'shumai.thread',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'initial',
  initial: () => ({ commentIds: [] }),
  checkpointWhen: () => true,
})

export async function initializeCommentSession(params: {
  teamId: string
  agentId: string
  userCommentId: string
  userId?: string
}): Promise<string> {
  const agentId = params.agentId === 'default' ? 'default' : params.agentId

  // Ensure user exists for agent
  const userExists = await prisma.user.findUnique({ where: { id: agentId } })
  if (!userExists) {
    await prisma.user.create({
      data: {
        id: agentId,
        name: 'Ai Agent',
        email: `${agentId}@shumai.ai`,
        type: 'agent',
      },
    })
  }

  // Ensure agent exists
  const agentExists = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agentExists) {
    await prisma.agent.create({
      data: {
        id: agentId,
        teamId: params.teamId,
        type: 'chat',
        config: {
          provider: 'openai',
          model: 'gpt-4',
        },
      },
    })
  }

  const userComment = await prisma.assetComment.findUnique({
    where: { id: params.userCommentId },
    include: { creator: true },
  })

  if (!userComment) {
    throw ApplicationFailure.create({
      message: `User comment ${params.userCommentId} not found`,
      nonRetryable: true,
    })
  }

  const rootCommentId = userComment.replyToId || userComment.id
  const targetUserCommentId = rootCommentId

  let session = await prisma.agentSession.findFirst({
    where: {
      assetId: userComment.assetId,
      type: 'comment',
      userCommentId: targetUserCommentId,
    },
  })

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        agentId,
        userId: params.userId || null,
        cwd: process.cwd(),
        assetId: userComment.assetId,
        userCommentId: targetUserCommentId,
        type: 'comment',
      },
    })
  }

  const rootComment = await prisma.assetComment.findUnique({
    where: { id: rootCommentId },
    include: { creator: true },
  })
  if (!rootComment) {
    throw ApplicationFailure.create({
      message: `Root comment ${rootCommentId} not found`,
      nonRetryable: true,
    })
  }

  // 1. Fetch top-level comments up to rootComment.createdAt sorted by id
  const topLevelComments = await prisma.assetComment.findMany({
    where: {
      assetId: userComment.assetId,
      replyToId: null,
      createdAt: { lte: rootComment.createdAt },
    },
    orderBy: { id: 'asc' },
    include: {
      creator: true,
      attachments: { include: { asset: true } },
    },
  })

  // 2. Fetch thread replies up to userComment.createdAt excluding userComment itself
  const threadReplies = userComment.replyToId
    ? await prisma.assetComment.findMany({
        where: {
          replyToId: rootCommentId,
          createdAt: { lte: userComment.createdAt },
          id: { not: userComment.id },
        },
        orderBy: { id: 'asc' },
        include: {
          creator: true,
          attachments: { include: { asset: true } },
        },
      })
    : []

  const replyCounts = await prisma.assetComment.groupBy({
    by: ['replyToId'],
    where: { assetId: userComment.assetId, replyToId: { not: null }, message: { not: '__CHAT__' } },
    _count: true,
  })
  const counts = new Map(replyCounts.map((row) => [row.replyToId, row._count]))
  const allCommentsToSync = [...topLevelComments, ...threadReplies]

  // Resolve user mentions from IDs to names and roles
  const mentionRegex = /<@([^>]+)>/g
  const mentionedUserIds = new Set<string>()
  for (const c of allCommentsToSync) {
    if (c.message) {
      const matches = [...c.message.matchAll(mentionRegex)]
      for (const match of matches) {
        mentionedUserIds.add(match[1])
      }
    }
  }

  const userIdToNameMap = new Map<string, string>()
  if (mentionedUserIds.size > 0) {
    const resolvedUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(mentionedUserIds) } },
      select: { id: true, name: true },
    })
    for (const u of resolvedUsers) {
      if (u.name) userIdToNameMap.set(u.id, u.name)
    }
  }

  const userRoleMap = new Map<string, string>()
  const humanCreatorIds = Array.from(
    new Set(
      allCommentsToSync
        .filter((c) => c.creator?.type !== 'agent' && c.creatorId)
        .map((c) => c.creatorId!),
    ),
  )
  if (humanCreatorIds.length > 0) {
    const members = await prisma.teamMember.findMany({
      where: {
        teamId: params.teamId,
        userId: { in: humanCreatorIds },
      },
      select: { userId: true, role: true },
    })
    for (const m of members) {
      userRoleMap.set(m.userId, m.role)
    }
  }

  const assetRecord = await prisma.asset.findUnique({
    where: { id: userComment.assetId },
    select: { media: true },
  })
  const proxyType = (assetRecord?.media as PrismaJson.MediaInfo | null)?.proxyType

  function buildCommentEntry(c: (typeof allCommentsToSync)[0]): EntryDraft {
    const isAgent = c.creator?.type === 'agent' || c.sessionId !== null
    let messageContent = c.message || ''

    messageContent = messageContent.replace(mentionRegex, (match, userId) => {
      const resolvedName = userIdToNameMap.get(userId)
      return resolvedName ? `<@${resolvedName}>` : match
    })

    if (isAgent) {
      const message: AgentMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: messageContent }],
        api: 'custom',
        provider: 'shumai',
        model: 'agent',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop',
        timestamp: c.createdAt.getTime(),
      }
      return {
        kind: 'pi.assistant',
        model: [message],
        data: { sourceCommentId: c.id },
      }
    }

    let userObj: ShumaiMessageContext['user'] = undefined
    if (c.creator) {
      const role = (c.creatorId ? userRoleMap.get(c.creatorId) : undefined) || 'user'
      userObj = {
        id: c.creator.id,
        name: c.creator.name || 'Unknown',
        role,
      }
    }

    let position: ShumaiMediaPosition | undefined = undefined
    if (c.second !== null && c.second !== undefined) {
      if (proxyType === '3d') {
        position = { type: 'degree', degree: secondToDegree(c.second) }
      } else if (proxyType === 'pdf') {
        position = { type: 'page', page: Math.round(c.second) }
      } else {
        position = { type: 'time', seconds: c.second }
      }
    }

    const annotation = !!(c.annotation && Array.isArray(c.annotation) && c.annotation.length > 0)

    const attachedFiles: ShumaiMessageContext['attachedFiles'] = []
    if (c.attachments && c.attachments.length > 0) {
      for (const att of c.attachments) {
        if (att.asset) {
          const attProxyType = (att.asset.media as PrismaJson.MediaInfo | null)?.proxyType
          attachedFiles.push({
            id: att.asset.id,
            name: att.asset.name,
            type: att.asset.type,
            mediaType: attProxyType as
              'image' | 'video' | 'pdf' | 'audio' | '3d' | 'other' | undefined,
            mimeType: att.asset.mediaType || undefined,
          })
        }
      }
    }

    const commentDetails: ShumaiMessageContext = {
      id: c.id,
      ...(!c.replyToId && counts.get(c.id)
        ? { thread: { id: c.id, replyCount: counts.get(c.id)! } }
        : {}),
      ...(userObj ? { user: userObj } : {}),
      ...(position ? { position } : {}),
      ...(annotation
        ? {
            annotation: true,
            annotations: c.annotation as unknown as ShumaiMessageContext['annotations'],
          }
        : {}),
      ...(attachedFiles.length > 0 ? { attachedFiles } : {}),
    }

    return {
      kind: ShumaiMessageEntry.kind,
      model: [{ role: 'user' as const, content: messageContent, timestamp: c.createdAt.getTime() }],
      data: JSON.parse(
        JSON.stringify({
          displayText: messageContent,
          timestamp: c.createdAt.getTime(),
          context: commentDetails,
          sourceCommentId: c.id,
        }),
      ) as JsonObject,
    }
  }

  await agentSessionService.withWriter(session.id, async (storage) => {
    const harness = await Harness.open(
      storage,
      { models: createModels(), registry: createRegistry() },
      piContext,
    )
    try {
      const root = await harness.root(piContext)
      const present = new Set<string>()
      let cursor: Cursor | undefined
      do {
        const page = await root.entries({ order: 'ascending' }, 100, cursor, piContext)
        for (const entry of page.items) {
          if (
            entry.data &&
            typeof entry.data === 'object' &&
            !Array.isArray(entry.data) &&
            'sourceCommentId' in entry.data &&
            typeof entry.data.sourceCommentId === 'string'
          )
            present.add(entry.data.sourceCommentId)
        }
        cursor = page.next
      } while (cursor)
      await root.commit(async (tx) => {
        const state = await tx.doc(ThreadContextDoc, root.id)
        for (const comment of allCommentsToSync) {
          if (
            comment.id === params.userCommentId ||
            comment.sessionId === session.id ||
            comment.message === '__CHAT__' ||
            present.has(comment.id) ||
            state.commentIds.includes(comment.id)
          )
            continue
          await tx.appendEntry(root.id, buildCommentEntry(comment))
          state.commentIds.push(comment.id)
        }
      }, piContext)
    } finally {
      await harness.close(piContext)
    }
  })
  return session.id
}
