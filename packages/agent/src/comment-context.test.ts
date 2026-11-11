import { createModels, fauxAssistantMessage, type Models } from '@earendil-works/pi-ai'
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream'
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { Harness, createRegistry } from '@earendil-works/pi-durable'
import { agentSessionService } from '@shumai/core/src/agent/session-service'
import { prisma, type AssetComment } from '@shumai/db'
import { acquireAdvisoryLock } from '@shumai/db/src/advisory-lock'
import { setupTestDbHooks } from '@shumai/db/test'
import { getShumaiMessage } from '@shumai/dtos'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { agentChatActivity, getAgentChatContextActivity } from './activities/agent'
import { initializeCommentSession, synchronizeCommentContext } from './comment-context'
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
  const tasks = await prisma.workflowTask.createManyAndReturn({
    data: mentions.map((comment) => ({
      teamId: team.id,
      projectId: project.id,
      assetId: asset.id,
      type: 'chat',
      status: 'pending',
      payload: {
        projectId: project.id,
        agent: { agentId: agent.id, userId: comment.creatorId!, userCommentId: comment.id },
      },
    })),
  })
  const reply = async (comment: AssetComment, sessionId: string) => {
    const context = await getAgentChatContextActivity({
      teamId: team.id,
      agentId: agent.id,
      userId: comment.creatorId!,
      projectId: project.id,
    })
    return agentChatActivity({
      taskId: tasks.find((task) => task.payload?.agent?.userCommentId === comment.id)!.id,
      teamId: team.id,
      agentId: agent.id,
      sessionId,
      userId: comment.creatorId!,
      userCommentId: comment.id,
      message: comment.message!,
      imageUrls: [],
      projectId: project.id,
      folderId: asset.id,
      assetId: asset.id,
      context,
    })
  }
  return { team, project, users, agent, asset, root, mentions, tasks, initialize, reply }
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
        expect(await prisma.agentSession.findUnique({ where: { id: sessionId } })).toMatchObject({
          agentId: thread.agent.id,
          assetId: thread.asset.id,
          userCommentId: thread.root.id,
        })
      }
    })

    it('uses one durable session for all five callers', () => {
      expect({ returned: [...new Set(sessionIds)], persisted: persistedIds }).toEqual({
        returned: [sessionIds[0]],
        persisted: [sessionIds[0]],
      })
    })
  })

  describe('concurrent history synchronization before live submissions', () => {
    let sourceCounts: number[]
    let thread: Awaited<ReturnType<typeof createThread>>
    let sessionId: string
    let model: MockInstance<Models['streamSimple']>

    beforeEach(async () => {
      // Mock only the provider boundary; admission, history, locks, SQLite, and DB remain real.
      model = vi
        .spyOn(Object.getPrototypeOf(createModels()) as Models, 'streamSimple')
        .mockImplementation(() => {
          const stream = new AssistantMessageEventStream()
          const answer = fauxAssistantMessage('Test reply')
          answer.usage = { ...answer.usage, input: 3, output: 2, totalTokens: 5 }
          stream.push({ type: 'done', reason: 'stop', message: answer })
          stream.end()
          return stream
        })
      thread = await createThread()
      sessionId = await thread.initialize(thread.root)
      const initialized = await Promise.all(thread.mentions.map(thread.initialize))
      expect(new Set(initialized)).toEqual(new Set([sessionId]))
      // All initializers can finish before the workflows acquire their generation writer.
      const replies = await Promise.all(
        thread.mentions.map((comment) => thread.reply(comment, sessionId)),
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

    it('includes each source comment only once in persisted model history', () => {
      expect(sourceCounts).toEqual([1, 1, 1, 1, 1])
    })

    it('recovers a completed request without another model call, input, or usage charge', async () => {
      const usage = await prisma.aiUsage.findMany({
        where: { teamId: thread.team.id },
        orderBy: { id: 'desc' },
      })
      const entries = await agentSessionService.getEntries(sessionId)
      await closeAgentSessions()
      expect((await thread.reply(thread.mentions[0], sessionId)).text).toBe('Test reply')
      expect(model).toHaveBeenCalledTimes(5)
      expect(await agentSessionService.getEntries(sessionId)).toEqual(entries)
      expect(
        await prisma.aiUsage.findMany({
          where: { teamId: thread.team.id },
          orderBy: { id: 'desc' },
        }),
      ).toEqual(usage)
    })
  })

  it('keeps different agents and different thread roots in separate sessions', async () => {
    const thread = await createThread()
    const first = await thread.initialize(thread.root)
    const secondRoot = await prisma.assetComment.create({
      data: { assetId: thread.asset.id, creatorId: thread.users[0].id, message: 'Another thread' },
    })
    const agentUser = await prisma.user.create({
      data: { name: 'Second agent', email: 'second-agent@example.test', type: 'agent' },
    })
    await prisma.agent.create({
      data: { id: agentUser.id, teamId: thread.team.id, type: 'chat', config: thread.agent.config },
    })
    const [secondThread, secondAgent] = await Promise.all([
      thread.initialize(secondRoot),
      initializeCommentSession({
        teamId: thread.team.id,
        agentId: agentUser.id,
        userCommentId: thread.root.id,
      }),
    ])
    expect(new Set([first, secondThread, secondAgent]).size).toBe(3)
    expect(await thread.initialize(thread.root)).toBe(first)
  })

  it('imports context-only comments once while reserving workflow-owned comments in every status', async () => {
    const thread = await createThread()
    const statuses = ['pending', 'processing', 'failed', 'completed', 'pending'] as const
    for (const [index, task] of thread.tasks.entries()) {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: statuses[index] },
      })
    }
    const note = await prisma.assetComment.create({
      data: {
        assetId: thread.asset.id,
        creatorId: thread.users[0].id,
        replyToId: thread.root.id,
        message: 'Keep this review note.',
        createdAt: new Date(thread.root.createdAt.getTime() + 1),
      },
    })
    const otherAgentComment = await prisma.assetComment.create({
      data: {
        assetId: thread.asset.id,
        creatorId: thread.users[1].id,
        replyToId: thread.root.id,
        message: 'A request for another agent.',
        createdAt: new Date(thread.root.createdAt.getTime() + 2),
      },
    })
    await prisma.workflowTask.create({
      data: {
        assetId: thread.asset.id,
        type: 'chat',
        status: 'pending',
        payload: {
          projectId: thread.project.id,
          agent: { agentId: 'another-agent', userCommentId: otherAgentComment.id },
        },
      },
    })
    await prisma.assetComment.create({
      data: {
        assetId: thread.asset.id,
        replyToId: thread.root.id,
        message: '__CHAT__',
        createdAt: new Date(thread.root.createdAt.getTime() + 3),
      },
    })
    const earlierThread = await prisma.assetComment.create({
      data: {
        assetId: thread.asset.id,
        creatorId: thread.users[0].id,
        message: 'An earlier top-level agent request.',
        createdAt: new Date(thread.root.createdAt.getTime() - 1),
      },
    })
    await prisma.workflowTask.create({
      data: {
        assetId: thread.asset.id,
        type: 'chat',
        status: 'pending',
        payload: {
          projectId: thread.project.id,
          agent: { agentId: thread.agent.id, userCommentId: earlierThread.id },
        },
      },
    })
    const sessionId = await thread.initialize(thread.root)
    await agentSessionService.withWriter(sessionId, async (storage) => {
      const harness = await Harness.open(
        storage,
        { models: createModels(), registry: createRegistry() },
        BACKGROUND_CONTEXT,
      )
      try {
        const params = {
          conversation: await harness.root(BACKGROUND_CONTEXT),
          sessionId,
          teamId: thread.team.id,
          agentId: thread.agent.id,
          userCommentId: thread.mentions[4].id,
        }
        await synchronizeCommentContext(params)
        await synchronizeCommentContext(params)
      } finally {
        await harness.close(BACKGROUND_CONTEXT)
      }
    })
    await closeAgentSessions()
    const sources = (await agentSessionService.getEntries(sessionId)).map(
      (entry) => getShumaiMessage(entry)?.sourceCommentId,
    )
    expect(new Set(sources)).toEqual(
      new Set([earlierThread.id, thread.root.id, note.id, otherAgentComment.id]),
    )
    expect(sources).toHaveLength(4)
  })

  it('reuses the oldest duplicate session without rewriting existing records', async () => {
    const thread = await createThread()
    const first = await thread.initialize(thread.root)
    const duplicate = await prisma.agentSession.create({
      data: {
        agentId: thread.agent.id,
        assetId: thread.asset.id,
        userCommentId: thread.root.id,
        type: 'comment',
        cwd: process.cwd(),
      },
    })
    const original = await prisma.agentSession.findMany({
      where: { id: { in: [first, duplicate.id] } },
      orderBy: { id: 'desc' },
    })
    expect(await thread.initialize(thread.root)).toBe([first, duplicate.id].sort()[0])
    expect(
      await prisma.agentSession.findMany({
        where: { id: { in: [first, duplicate.id] } },
        orderBy: { id: 'desc' },
      }),
    ).toEqual(original)
  })

  it('releases the thread creation lock when initialization rolls back', async () => {
    const thread = await createThread()
    const agentUser = await prisma.user.create({
      data: { name: 'New agent', email: 'new-agent@example.test', type: 'agent' },
    })
    const params = { teamId: thread.team.id, agentId: agentUser.id, userCommentId: thread.root.id }
    await expect(initializeCommentSession({ ...params, teamId: 'missing-team' })).rejects.toThrow()
    const lock = await acquireAdvisoryLock(
      `agent-thread:${agentUser.id}:${thread.asset.id}:${thread.root.id}`,
      AbortSignal.timeout(2000),
    )
    await lock.release()
    expect(await prisma.agent.findUnique({ where: { id: agentUser.id } })).toBeNull()
    expect(await initializeCommentSession(params)).toBeTruthy()
  })
})
