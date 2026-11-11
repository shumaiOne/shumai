import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context'
import { createModels, fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai'
import { Harness, ROOT_CONVERSATION_ID, UsageDoc, createRegistry } from '@earendil-works/pi-durable'
import { prisma } from '@shumai/db'
import { acquireAdvisoryLock } from '@shumai/db/src/advisory-lock'
import * as advisoryLock from '@shumai/db/src/advisory-lock'
import { setupTestDbHooks } from '@shumai/db/test'
import { rm, writeFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { s3Service } from '../s3/s3'
import { openSessionCache } from './session-cache'
import * as sessionCache from './session-cache'
import * as sessionStorage from './session-storage'
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
      const cache = await openSessionCache(session.id)
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

  it('reads locally committed entries while PostgreSQL persistence is pending', async () => {
    const { session } = await fixture()
    const started = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const synchronize = sessionStorage.synchronizeStorage
    let paused = false
    vi.spyOn(sessionStorage, 'synchronizeStorage').mockImplementation((storage, callbacks) =>
      synchronize(storage, {
        ...callbacks,
        persist: async (commits) => {
          if (paused) {
            started.resolve()
            await resume.promise
          }
          await callbacks.persist(commits)
        },
      }),
    )
    const writer = await agentSessionService.openWriter(session.id)
    const harness = await Harness.open(
      writer.storage,
      { models: createModels(), registry: createRegistry() },
      context,
    )
    const root = await harness.root(context)
    paused = true
    let acknowledged = false
    const commit = root.commit(
      (tx) => tx.appendEntry(root.id, { kind: 'pi.user', data: { text: 'locally committed' } }),
      context,
    )
    void commit.then(() => {
      acknowledged = true
    })
    let closing: Promise<void> | undefined
    try {
      await started.promise
      expect(await prisma.agentSessionCommit.count({ where: { sessionId: session.id } })).toBe(1)
      expect(await agentSessionService.getEntries(session.id)).toMatchObject([
        { kind: 'pi.user', data: { text: 'locally committed' } },
      ])
      expect(acknowledged).toBe(false)
      closing = writer.storage.close(context)
      // Closing drains persistence before entering the lifecycle queue, so reads still work.
      expect(await agentSessionService.getEntries(session.id)).toHaveLength(1)
    } finally {
      resume.resolve()
      await commit
      await closing
      await harness.close(context)
    }
    expect(acknowledged).toBe(true)
    // A history read must not close the writer's connection.
    await agentSessionService.withWriter(session.id, async (storage) => {
      expect(await storage.conversation(root.id, context)).toBeDefined()
    })
  })

  it('uses one cache directory for concurrent initial reads and subsequent writes', async () => {
    const { session } = await fixture()
    const paths: string[] = []
    const openCache = sessionCache.openSessionCache
    vi.spyOn(sessionCache, 'openSessionCache').mockImplementation(async (...args) => {
      const cache = await openCache(...args)
      paths.push(cache.path)
      return cache
    })
    expect(
      await Promise.all([
        agentSessionService.getEntries(session.id),
        agentSessionService.listEntries(session.id),
      ]),
    ).toEqual([[], { items: [], next: undefined }])
    const [written] = await Promise.all([
      appendSessionEntries(session.id, [{ kind: 'pi.user', data: { text: 'shared cache' } }]),
      agentSessionService.getEntries(session.id),
    ])
    expect(await agentSessionService.getEntries(session.id)).toEqual(written)
    expect(new Set(paths).size).toBe(1)
  })

  it('keeps history compact while the live writer hydrates image references', async () => {
    const { session } = await fixture()
    const image = Buffer.from('image bytes')
    vi.spyOn(s3Service, 'getObject').mockResolvedValue({ buffer: image, contentType: 'image/png' })
    await agentSessionService.withWriter(session.id, async (storage) => {
      const harness = await Harness.open(
        storage,
        { models: createModels(), registry: createRegistry() },
        context,
      )
      try {
        const root = await harness.root(context)
        const entry = await root.commit(
          (tx) =>
            tx.appendEntry(root.id, {
              kind: 'pi.user',
              data: { sourceKeys: ['image-key'] },
              model: [
                {
                  role: 'user',
                  content: [
                    { type: 'image', data: image.toString('base64'), mimeType: 'image/png' },
                  ],
                  timestamp: 1,
                },
              ],
            }),
          context,
        )
        expect(JSON.stringify((await storage.entry(entry.id, context))?.entry)).toContain(
          image.toString('base64'),
        )
        const history = await agentSessionService.getEntries(session.id)
        expect(JSON.stringify(history)).toContain('__S3_DATA__')
        expect(JSON.stringify(history)).not.toContain(image.toString('base64'))
        expect((await agentSessionService.listEntries(session.id)).items).toEqual(history)
      } finally {
        await harness.close(context)
      }
    })
  })

  it('waits for an admitted history read before closing the live writer', async () => {
    const { session } = await fixture()
    const entered = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const openCache = sessionCache.openSessionCache
    let paused = false
    vi.spyOn(sessionCache, 'openSessionCache').mockImplementation(async (...args) => {
      const cache = await openCache(...args)
      const scan = cache.storage.scanEntries.bind(cache.storage)
      cache.storage.scanEntries = async (...query) => {
        if (paused) {
          entered.resolve()
          await resume.promise
        }
        return scan(...query)
      }
      return cache
    })
    const writer = await agentSessionService.openWriter(session.id)
    const harness = await Harness.open(
      writer.storage,
      { models: createModels(), registry: createRegistry() },
      context,
    )
    const root = await harness.root(context)
    await root.commit((tx) => tx.appendEntry(root.id, { kind: 'pi.user', data: {} }), context)
    paused = true
    const read = agentSessionService.getEntries(session.id)
    await entered.promise
    let closed = false
    const closing = writer.storage.close(context).then(() => {
      closed = true
    })
    try {
      expect(closed).toBe(false)
    } finally {
      resume.resolve()
      expect(await read).toHaveLength(1)
      await closing
      await harness.close(context)
    }
    expect(closed).toBe(true)
  })

  it('drains a writer being opened before shutdown removes the shared cache', async () => {
    const { session } = await fixture()
    const entered = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const openCache = sessionCache.openSessionCache
    vi.spyOn(sessionCache, 'openSessionCache').mockImplementationOnce(async (...args) => {
      const cache = await openCache(...args)
      entered.resolve()
      await resume.promise
      return cache
    })
    const opening = agentSessionService.openWriter(session.id)
    await entered.promise
    const shutdown = agentSessionService.closeAll()
    try {
      expect(agentSessionService.closeAll()).toBe(shutdown)
      await expect(agentSessionService.getEntries(session.id)).rejects.toThrow('service is closing')
    } finally {
      resume.resolve()
      await shutdown
    }
    const writer = await opening
    await expect(writer.storage.conversation(ROOT_CONVERSATION_ID, context)).rejects.toThrow(
      'closed',
    )
    expect(await agentSessionService.getEntries(session.id)).toEqual([])
  })

  it('cancels a writer waiting for ownership when the service shuts down', async () => {
    const { session } = await fixture()
    const held = await acquireAdvisoryLock(`agent-session:${session.id}`)
    const opening = agentSessionService.openWriter(session.id)
    const rejected = expect(opening).rejects.toThrow('Session service is closing')
    try {
      await agentSessionService.closeAll()
      await rejected
    } finally {
      await held.release()
    }
    expect(await agentSessionService.getEntries(session.id)).toEqual([])
  })

  it('drains a writer that lost ownership before a replacement rebuilds its shared cache', async () => {
    const { session } = await fixture()
    const acquire = advisoryLock.acquireAdvisoryLock
    const lost = new AbortController()
    let release: (() => Promise<void>) | undefined
    vi.spyOn(advisoryLock, 'acquireAdvisoryLock').mockImplementationOnce(async (...args) => {
      const lock = await acquire(...args)
      release = lock.release
      return { ...lock, signal: lost.signal }
    })
    const started = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const synchronize = sessionStorage.synchronizeStorage
    vi.spyOn(sessionStorage, 'synchronizeStorage').mockImplementationOnce((storage, callbacks) =>
      synchronize(storage, {
        ...callbacks,
        persist: async (commits) => {
          started.resolve()
          await resume.promise
          await callbacks.persist(commits)
        },
      }),
    )
    const opens = vi.spyOn(sessionCache, 'openSessionCache')
    const first = await agentSessionService.openWriter(session.id)
    const closing = vi.spyOn(first.storage, 'close')
    const acknowledge = vi.fn()
    const commit = first.storage.commit(
      [
        [
          { type: 'conversation', value: { id: ROOT_CONVERSATION_ID } },
          {
            type: 'entry',
            value: {
              id: await first.storage.mintId(),
              conversationId: ROOT_CONVERSATION_ID,
              kind: 'pi.user',
              data: { text: 'unmirrored' },
            },
          },
        ],
      ],
      acknowledge,
      context,
    )
    const rejected = expect(commit).rejects.toThrow('lock lost')
    await started.promise
    lost.abort(new Error('lock lost'))
    await release?.()
    const replacement = agentSessionService.openWriter(session.id)
    try {
      await vi.waitFor(() => expect(closing).toHaveBeenCalledOnce())
      expect(await agentSessionService.getEntries(session.id)).toMatchObject([
        { data: { text: 'unmirrored' } },
      ])
      expect(opens).toHaveBeenCalledTimes(1)
    } finally {
      resume.resolve()
      await rejected
      await replacement
    }
    expect(acknowledge).not.toHaveBeenCalled()
    await first.storage.close(context)
    expect(await agentSessionService.getEntries(session.id)).toEqual([])
    expect(opens).toHaveBeenCalledTimes(2)
    await (await replacement).storage.close(context)
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
              value: { id: ROOT_CONVERSATION_ID },
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
        const receipt = await (
          await root.submit({ type: 'input', requestId: 'once', content: 'question' }, context)
        ).wait(context)
        expect(await agentSessionService.getEntryForRequest(session.id, 'once')).toBeDefined()
        return receipt
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
    expect(failure).toHaveBeenCalledTimes(1)
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
