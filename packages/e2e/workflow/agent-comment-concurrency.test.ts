import { closeAgentSessions, initAgentWorkflows } from '@shumai/agent'
import { agentSessionService } from '@shumai/core/src/agent/session-service'
import { assetService } from '@shumai/core/src/asset/asset'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { getShumaiMessage } from '@shumai/dtos'
import { TaskQueueAgent, workflowService } from '@shumai/workflow-core'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockModelPrompt } from './model-mock'

describe('Workflow E2E - concurrent agent mentions', () => {
  setupTestDbHooks()
  let model: ReturnType<typeof mockModelPrompt>

  beforeAll(async () => {
    vi.stubEnv('CONCURRENCY_AGENT', '5')
    initAgentWorkflows()
    model = mockModelPrompt(async (prompt) => ({
      content: [{ type: 'text', text: `Reply to ${prompt.split('\n')[0]}` }],
    }))
    await workflowService.startWorkers(TaskQueueAgent)
  })

  beforeEach(() => {
    model.mockClear()
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()
    await closeAgentSessions()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it.each(['new', 'existing'] as const)(
    'keeps five mentions in one %s thread session with each source comment recorded once',
    async (kind) => {
      const team = await prisma.team.create({ data: { name: 'Mention concurrency team' } })
      const project = await prisma.project.create({
        data: { name: 'Mention concurrency project', teamId: team.id },
      })
      const users = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          prisma.user.create({
            data: { name: `Mention user ${index}`, email: `mention-${index}@example.test` },
          }),
        ),
      )
      await prisma.teamMember.createMany({
        data: users.map((user) => ({ teamId: team.id, userId: user.id, role: 'owner' })),
      })
      const agentUser = await prisma.user.create({
        data: { name: 'Mention agent', email: 'mention-agent@example.test', type: 'agent' },
      })
      const provider = await prisma.provider.create({
        data: {
          teamId: team.id,
          name: 'google',
          config: { api: 'google-generative-ai', apiKey: 'unused-test-key' },
        },
      })
      const modelRecord = await prisma.model.create({
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
      const agent = await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: team.id,
          type: 'chat',
          providerId: provider.id,
          modelId: modelRecord.id,
          config: { provider: 'google', model: 'gemini-test' },
        },
      })
      const asset = await prisma.asset.create({
        data: { name: 'comments.txt', type: 'file', projectId: project.id, status: 'processed' },
      })
      const root = await assetService.createComment({
        assetId: asset.id,
        userId: users[0].id,
        message: 'Discuss this asset.',
        attachmentIds: [],
      })
      const note = await assetService.createComment({
        assetId: asset.id,
        userId: users[0].id,
        replyToId: root.id,
        message: 'An ordinary review note.',
        attachmentIds: [],
      })
      const post = (userId: string, message: string) =>
        assetService.createComment({
          assetId: asset.id,
          userId,
          replyToId: root.id,
          message: `<@${agent.id}> ${message}`,
          attachmentIds: [],
        })
      const expected = []
      if (kind === 'existing') {
        expected.push(await post(users[0].id, 'Establish this thread'))
        const initialTask = await prisma.workflowTask.findFirstOrThrow({
          where: { assetId: asset.id, type: 'chat' },
        })
        await workflowService.executeWait(initialTask, 45000)
      }
      const mentions = await Promise.all(
        users.map((user, index) => post(user.id, `Request ${index}`)),
      )
      expected.push(...mentions)
      const tasks = await prisma.workflowTask.findMany({
        where: { assetId: asset.id, type: 'chat' },
        orderBy: { id: 'desc' },
      })
      expect(tasks).toHaveLength(expected.length)
      const completed = await Promise.all(
        tasks.map((task) => workflowService.executeWait(task, 45000)),
      )
      expect(completed.every((task) => task.status === 'completed')).toBe(true)
      const sessions = await prisma.agentSession.findMany({
        where: { agentId: agent.id, assetId: asset.id, userCommentId: root.id, type: 'comment' },
      })
      expect(sessions).toHaveLength(1)
      expect(new Set(completed.map((task) => task.output?.sessionId))).toEqual(
        new Set([sessions[0].id]),
      )
      const entries = await agentSessionService.getEntries(sessions[0].id)
      const sources = entries.map(getShumaiMessage).filter((message) => message !== undefined)
      for (const comment of [root, note, ...expected]) {
        expect(sources.filter((message) => message.sourceCommentId === comment.id)).toHaveLength(1)
      }
      for (const mention of mentions) {
        expect(
          sources.find((message) => message.sourceCommentId === mention.id)?.context.user?.id,
        ).toBe(mention.creator.id)
      }
      const replies = await prisma.assetComment.findMany({
        where: {
          assetId: asset.id,
          replyToId: root.id,
          creatorId: agent.id,
          sessionId: sessions[0].id,
        },
      })
      expect(replies).toHaveLength(expected.length)
      for (let index = 0; index < 5; index++)
        expect(replies.filter((reply) => reply.message?.includes(`Request ${index}`))).toHaveLength(
          1,
        )
      expect(replies.some((reply) => reply.message === '__CHAT__')).toBe(false)
      expect(model).toHaveBeenCalledTimes(expected.length)
      const commits = await prisma.agentSessionCommit.findMany({
        where: { sessionId: sessions[0].id },
        orderBy: { seq: 'asc' },
      })
      expect(commits.every((commit, index) => commit.seq === BigInt(index + 1))).toBe(true)
      await closeAgentSessions()
      expect(await agentSessionService.getEntries(sessions[0].id)).toEqual(entries)
    },
    60000,
  )
})
