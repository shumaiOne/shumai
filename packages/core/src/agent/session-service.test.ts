import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context'
import { createModels, fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai'
import { Harness, UsageDoc, createRegistry } from '@earendil-works/pi-durable'
import { prisma } from '@shumai/db'
import { acquireAdvisoryLock } from '@shumai/db/src/advisory-lock'
import { setupTestDbHooks } from '@shumai/db/test'
import { rm, writeFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSessionCache } from './session-cache'
import { agentSessionService } from './session-service'
import { appendSessionEntries } from './session-test-utils'

describe('Native session storage and PostgreSQL synchronization', () => {
  setupTestDbHooks()
  afterEach(async () => {
    vi.restoreAllMocks()
    await agentSessionService.closeAll()
  })

  async function fixture() {
    const team = await prisma.team.create({ data: { name: 'Storage team' } })
    const user = await prisma.user.create({
      data: { name: 'Agent', email: 'storage@example.test', type: 'agent' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: user.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'faux', model: 'faux-1' },
      },
    })
    const session = await prisma.agentSession.create({ data: { agentId: agent.id, cwd: '/test' } })
    return { team, session }
  }

  it('reconstructs missing SQLite files and preserves native IDs, ordering and pagination', async () => {
    const { session } = await fixture()
    const entries = await appendSessionEntries(
      session.id,
      Array.from({ length: 25 }, (_, i) => ({
        kind: 'pi.user',
        model: [{ role: 'user' as const, content: `message ${i}`, timestamp: i }],
      })),
    )
    await agentSessionService.closeAll()
    expect(await agentSessionService.getEntries(session.id)).toEqual(entries)
    const first = await agentSessionService.listEntries(session.id)
    expect(first.items).toHaveLength(20)
    const next = await agentSessionService.listEntries(session.id, {
      after: first.items.at(-1)!.id,
    })
    expect(next.items).toEqual(entries.slice(20))
    const cursor = await agentSessionService.listEntries(session.id, { cursor: first.next })
    expect(cursor.items).toEqual(next.items)
    expect(await prisma.agentSessionEntry.count({ where: { sessionId: session.id } })).toBe(0)
  })

  it.each(['missing', 'corrupt', 'dirty'] as const)(
    'rebuilds a %s local cache from mirrored commits',
    async (failure) => {
      const { session } = await fixture()
      const entries = await appendSessionEntries(session.id, [
        { kind: 'pi.user', model: [{ role: 'user', content: 'safe', timestamp: 1 }] },
      ])
      const cache = await openSessionCache(session.id, 'read')
      await cache.storage.close(context)
      if (failure === 'missing') await rm(cache.path)
      else if (failure === 'corrupt') await writeFile(cache.path, 'invalid sqlite')
      else await cache.dirty()
      expect(await agentSessionService.getEntries(session.id)).toEqual(entries)
    },
  )

  it('holds the session ownership lock until close and permits cancellation while waiting', async () => {
    const { session } = await fixture()
    const writer = await agentSessionService.openWriter(session.id)
    const abort = new AbortController()
    const waiting = acquireAdvisoryLock(`agent-session:${session.id}`, abort.signal)
    abort.abort(new Error('cancelled'))
    await expect(waiting).rejects.toThrow('cancelled')
    await writer.storage.close(context)
    const next = await acquireAdvisoryLock(`agent-session:${session.id}`)
    await next.release()
  })

  it('refuses a fenced writer and rebuilds its unacknowledged SQLite commit', async () => {
    const { session } = await fixture()
    const writer = await agentSessionService.openWriter(session.id)
    await prisma.agentSession.update({
      where: { id: session.id },
      data: { writerVersion: { increment: 1 } },
    })
    await expect(
      writer.storage.commit(
        [
          [
            {
              type: 'conversation',
              value: { id: 1 as import('@earendil-works/pi-durable').ConversationId },
            },
          ],
        ],
        () => {
          throw new Error('must not acknowledge')
        },
        context,
      ),
    ).rejects.toThrow('ownership was lost')
    await writer.storage.close(context)
    expect(await agentSessionService.getEntries(session.id)).toEqual([])
  })

  it('commits usage and transcript together, and does not bill replay or completed request recovery', async () => {
    const { team, session } = await fixture()
    const faux = fauxProvider()
    const answer = fauxAssistantMessage('paid answer')
    answer.usage = {
      input: 12,
      output: 7,
      cacheRead: 3,
      cacheWrite: 0,
      totalTokens: 22,
      cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0, total: 0.3 },
    }
    faux.setResponses([answer])
    const models = createModels()
    models.setProvider(faux.provider)
    const run = async () => {
      const writer = await agentSessionService.openWriter(session.id, context, { teamId: team.id })
      const harness = await Harness.open(
        writer.storage,
        { models, registry: createRegistry() },
        context,
      )
      try {
        const root = await harness.root(context)
        await root.configure(
          { model: { provider: faux.provider.id, modelId: faux.getModel().id } },
          context,
        )
        return await (
          await root.submit({ type: 'input', requestId: 'once', content: 'question' }, context)
        ).wait(context)
      } finally {
        await harness.close(context)
      }
    }
    const receipt = await run()
    await agentSessionService.closeAll()
    expect(await run()).toEqual(receipt)
    const usage = await prisma.aiUsage.findFirstOrThrow({ where: { teamId: team.id } })
    const checkpoint = (await prisma.agentSession.findUniqueOrThrow({ where: { id: session.id } }))
      .accountedUsage!
    expect(Number(usage.totalTokens)).toBeGreaterThan(0)
    expect(Number(usage.totalTokens)).toBe(checkpoint.totalTokens)
    expect(Number(usage.cost)).toBe(checkpoint.cost)
  })

  it('rolls back usage if PostgreSQL cannot persist the native commit', async () => {
    const { team, session } = await fixture()
    const writer = await agentSessionService.openWriter(session.id, context, { teamId: team.id })
    const harness = await Harness.open(
      writer.storage,
      { models: createModels(), registry: createRegistry() },
      context,
    )
    const root = await harness.root(context)
    const failure = vi
      .spyOn(prisma.agentSessionCommit, 'createMany')
      .mockRejectedValueOnce(new Error('mirror unavailable'))
    await expect(
      root.commit(async (tx) => {
        const usage = await tx.doc(UsageDoc, root.id)
        usage.models['faux/test'] = fauxAssistantMessage('answer').usage
        usage.models['faux/test'].totalTokens = 25
        await tx.appendEntry(root.id, {
          kind: 'pi.assistant',
          model: [fauxAssistantMessage('answer')],
        })
      }, context),
    ).rejects.toThrow('mirror unavailable')
    failure.mockRestore()
    await harness.close(context)
    expect(await prisma.aiUsage.count({ where: { teamId: team.id } })).toBe(0)
    expect(await agentSessionService.getEntries(session.id)).toEqual([])
  })

  it('deletes mirrored records with their session and rejects subsequent history reads', async () => {
    const { session } = await fixture()
    await appendSessionEntries(session.id, [{ kind: 'pi.user', data: {} }])
    await prisma.agentSession.delete({ where: { id: session.id } })
    expect(await prisma.agentSessionCommit.count({ where: { sessionId: session.id } })).toBe(0)
    await expect(agentSessionService.getEntries(session.id)).rejects.toThrow('Session not found')
  })
})
