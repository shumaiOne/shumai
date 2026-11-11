import { createModels, fauxAssistantMessage, type Models } from '@earendil-works/pi-ai'
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream'
import { agentSessionService } from '@shumai/core/src/agent/session-service'
import { prisma, type AssetComment } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { getShumaiMessage } from '@shumai/dtos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentChatActivity, getAgentChatContextActivity } from './activities/agent'
import { initializeCommentSession } from './comment-context'
import { closeAgentSessions } from './runtime'

async function createThread() {
  const team = await prisma.team.create({ data: { name: 'Concurrent comment team' } })
  const project = await prisma.project.create({
    data: { name: 'Concurrent comment project', teamId: team.id },
  })
  const users = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      prisma.user.create({
        data: { name: `User ${index}`, email: `comment-user-${index}@example.test` },
      }),
    ),
  )
  await prisma.teamMember.createMany({
    data: users.map((user) => ({ teamId: team.id, userId: user.id, role: 'owner' })),
  })
  const provider = await prisma.provider.create({
    data: {
      teamId: team.id,
      name: 'google',
      config: { api: 'google-generative-ai', apiKey: 'unused-test-key' },
    },
  })
  const model = await prisma.model.create({
    data: {
      providerId: provider.id,
      modelId: 'gemini-test',
      config: {
        input: ['text'],
        reasoning: false,
        contextWindow: 8192,
        maxTokens: 1024,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    },
  })
  const agentUser = await prisma.user.create({
    data: { name: 'Comment agent', email: 'comment-agent@example.test', type: 'agent' },
  })
  const agent = await prisma.agent.create({
    data: {
      id: agentUser.id,
      teamId: team.id,
      type: 'chat',
      providerId: provider.id,
      modelId: model.id,
      config: { provider: 'google', model: 'gemini-test' },
    },
  })
  const asset = await prisma.asset.create({
    data: { name: 'comments.txt', type: 'file', projectId: project.id, status: 'processed' },
  })
  const root = await prisma.assetComment.create({
    data: {
      assetId: asset.id,
      creatorId: users[0].id,
      message: 'Discuss this asset here.',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  })
  const mentions: AssetComment[] = []
  for (const [index, user] of users.entries()) {
    mentions.push(
      await prisma.assetComment.create({
        data: {
          assetId: asset.id,
          creatorId: user.id,
          replyToId: root.id,
          message: `<@${agent.id}> Request ${index}`,
          // Explicit ordering makes the imported history independent of clock resolution.
          createdAt: new Date(root.createdAt.getTime() + index + 1),
        },
      }),
    )
  }
  const initialize = (comment: AssetComment) =>
    initializeCommentSession({
      teamId: team.id,
      agentId: agent.id,
      userId: comment.creatorId!,
      userCommentId: comment.id,
    })
  return { team, project, users, agent, asset, root, mentions, initialize }
}

describe('Comment session concurrency regressions', () => {
  setupTestDbHooks()

  afterEach(async () => {
    await closeAgentSessions()
    vi.restoreAllMocks()
  })

  describe('simultaneous first mentions in a human-created thread', () => {
    let sessionIds: string[]
    let persistedIds: string[]

    beforeEach(async () => {
      const thread = await createThread()
      sessionIds = await Promise.all(thread.mentions.map(thread.initialize))
      const sessions = await prisma.agentSession.findMany({
        where: { assetId: thread.asset.id, type: 'comment', userCommentId: thread.root.id },
        orderBy: { id: 'asc' },
      })
      persistedIds = sessions.map((session) => session.id)
      // Keep setup/storage failures outside the expected-failure assertion.
      expect(sessionIds).toHaveLength(5)
      expect(new Set(persistedIds)).toEqual(new Set(sessionIds))
      for (const sessionId of new Set(sessionIds)) {
        expect(await agentSessionService.getEntries(sessionId)).not.toHaveLength(0)
      }
    })

    // Known bug: remove .fails when thread session creation is atomic.
    it.fails('uses one durable session for all five callers', () => {
      expect({ returned: [...new Set(sessionIds)], persisted: persistedIds }).toEqual({
        returned: [sessionIds[0]],
        persisted: [sessionIds[0]],
      })
    })
  })

  describe('concurrent history synchronization before live submissions', () => {
    let sourceCounts: number[]

    beforeEach(async () => {
      // Mock only the provider boundary; admission, history, locks, SQLite, and DB remain real.
      const model = vi
        .spyOn(Object.getPrototypeOf(createModels()) as Models, 'streamSimple')
        .mockImplementation(() => {
          const stream = new AssistantMessageEventStream()
          stream.push({ type: 'done', reason: 'stop', message: fauxAssistantMessage('Test reply') })
          stream.end()
          return stream
        })
      const thread = await createThread()
      const sessionId = await thread.initialize(thread.root)
      const initialized = await Promise.all(thread.mentions.map(thread.initialize))
      expect(new Set(initialized)).toEqual(new Set([sessionId]))
      const context = await getAgentChatContextActivity({
        teamId: thread.team.id,
        agentId: thread.agent.id,
        userId: thread.users[0].id,
        projectId: thread.project.id,
      })
      // All initializers can finish before the workflows acquire their generation writer.
      const replies = await Promise.all(
        thread.mentions.map((comment) =>
          agentChatActivity({
            teamId: thread.team.id,
            agentId: thread.agent.id,
            sessionId,
            userId: comment.creatorId!,
            userCommentId: comment.id,
            message: comment.message!,
            imageUrls: [],
            projectId: thread.project.id,
            folderId: thread.asset.id,
            assetId: thread.asset.id,
            context,
          }),
        ),
      )
      expect(replies.map((reply) => reply.text)).toEqual(Array(5).fill('Test reply'))
      expect(model).toHaveBeenCalledTimes(5)
      // Reopen from PostgreSQL commits rather than trusting the in-process SQLite cache.
      await closeAgentSessions()
      const entries = await agentSessionService.getEntries(sessionId)
      sourceCounts = thread.mentions.map(
        (comment) =>
          entries.filter((entry) => getShumaiMessage(entry)?.sourceCommentId === comment.id).length,
      )
      expect(sourceCounts).toHaveLength(5)
      expect(sourceCounts.every((count) => count >= 1)).toBe(true)
    })

    // Known bug: remove .fails when context imports and live inputs share deduplication.
    it.fails('includes each source comment only once in persisted model history', () => {
      expect(sourceCounts).toEqual([1, 1, 1, 1, 1])
    })
  })
})
