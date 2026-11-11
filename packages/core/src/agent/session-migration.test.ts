import { openSessionCache } from './session-cache'
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context'
import { createModels, fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai'
import { Harness, createRegistry, UsageDoc } from '@earendil-works/pi-durable'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { agentSessionService } from './session-service'

const migration = new URL(
  '../../../db/prisma/migrations/20261110070817_pi_durable_session_commits/migration.sql',
  import.meta.url,
)
async function backfill() {
  const sql = await readFile(migration, 'utf8')
  const start = sql.indexOf('DO $migration$')
  const checkpoint = await readFile(
    new URL(
      '../../../db/prisma/migrations/20261110072953_agent_session_usage_checkpoint/migration.sql',
      import.meta.url,
    ),
    'utf8',
  )
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(sql.slice(start, sql.lastIndexOf('COMMIT;')))
    await tx.$executeRawUnsafe(checkpoint.slice(checkpoint.indexOf('-- Historical')))
    const preserve = await readFile(
      new URL(
        '../../../db/prisma/migrations/20261110094140_preserve_session_json_nulls/migration.sql',
        import.meta.url,
      ),
      'utf8',
    )
    await tx.$executeRawUnsafe(
      preserve.slice(preserve.indexOf('CREATE FUNCTION'), preserve.lastIndexOf('COMMIT;')),
    )
  })
}

describe('SQL migration to Pi Durable', () => {
  setupTestDbHooks()

  async function fixture() {
    const team = await prisma.team.create({ data: { name: 'Migration team' } })
    const user = await prisma.user.create({
      data: { name: 'Migration agent', email: 'pi-migration@example.test', type: 'agent' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: user.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'faux', model: 'faux-1' },
      },
    })
    const parent = await prisma.agentSession.create({
      data: { agentId: agent.id, cwd: '/migration', leafId: 'legacy-root' },
    })
    const child = await prisma.agentSession.create({
      data: { agentId: agent.id, cwd: '/migration', leafId: 'legacy-reply' },
    })
    await prisma.agentSessionEntry.createMany({
      data: [
        {
          id: 'legacy-root',
          sessionId: parent.id,
          type: 'custom_message',
          data: {
            customType: 'shumai_message',
            content: 'Original question',
            details: {
              annotation: true,
              annotations: [{ type: 'line' }],
              currentAsset: { id: 'asset', name: 'Image', type: 'file' },
            },
          },
        },
        {
          id: 'legacy-reply',
          sessionId: child.id,
          parentId: 'legacy-root',
          type: 'custom_message',
          data: { customType: 'shumai_message', content: 'Follow-up', details: {} },
        },
      ],
    })
    return { team, parent, child }
  }

  it('copies inherited records, preserves annotations and opens as a continuable native session', async () => {
    const { parent, child } = await fixture()
    await backfill()
    expect(await agentSessionService.getEntries(parent.id)).toHaveLength(1)
    const entries = await agentSessionService.getEntries(child.id)
    expect(entries.map((entry) => entry.id)).toEqual([7, 9])
    expect(entries[0].data).toMatchObject({
      displayText: 'Original question',
      context: { annotation: true, id: `chat:${child.id}:legacy-legacy-root` },
    })
    expect(
      await agentSessionService.getEntryForRequest(child.id, 'legacy-legacy-root'),
    ).toMatchObject({ id: 7 })
    const faux = fauxProvider()
    faux.setResponses([fauxAssistantMessage('Continued migrated conversation')])
    const models = createModels()
    models.setProvider(faux.provider)
    await agentSessionService.withWriter(child.id, async (storage) => {
      const harness = await Harness.open(storage, { models, registry: createRegistry() }, context)
      try {
        const root = await harness.root(context)
        await root.configure(
          { model: { provider: faux.provider.id, modelId: faux.getModel().id } },
          context,
        )
        const settled = await (
          await root.submit({ type: 'input', content: 'Continue', requestId: 'continued' }, context)
        ).wait(context)
        expect(settled.status).toBe('done')
      } finally {
        await harness.close(context)
      }
    })
    const count = await prisma.agentSessionCommit.count({ where: { sessionId: child.id } })
    await backfill()
    expect(await prisma.agentSessionCommit.count({ where: { sessionId: child.id } })).toBe(count)
  })

  it('preserves compact tool results, remaps annotation references, compaction boundaries and historical usage', async () => {
    const { child } = await fixture()
    const assistant = fauxAssistantMessage([
      {
        type: 'toolCall',
        id: 'read',
        name: 'read_asset',
        arguments: { annotationId: 'legacy-root' },
      },
    ])
    assistant.usage = {
      input: 10,
      output: 5,
      cacheRead: 2,
      cacheWrite: 0,
      totalTokens: 17,
      cost: { input: 0.1, output: 0.1, cacheRead: 0, cacheWrite: 0, total: 0.2 },
    }
    await prisma.agentSessionEntry.createMany({
      data: [
        {
          id: 'legacy-call',
          parentId: 'legacy-reply',
          sessionId: child.id,
          type: 'message',
          data: { message: assistant },
        },
        {
          id: 'legacy-tool',
          parentId: 'legacy-call',
          sessionId: child.id,
          type: 'message',
          data: {
            message: {
              role: 'toolResult',
              toolCallId: 'read',
              toolName: 'read_asset',
              content: [{ type: 'image', data: '__S3_DATA__', mimeType: 'image/png' }],
              details: { sourceKeys: ['historical-image'], exitCode: null },
              isError: false,
              timestamp: 1,
            },
          },
        },
        {
          id: 'legacy-compact',
          parentId: 'legacy-tool',
          sessionId: child.id,
          type: 'compaction',
          data: { summary: 'Earlier discussion', firstKeptEntryId: 'legacy-call' },
        },
        {
          id: 'legacy-branch',
          parentId: 'legacy-compact',
          sessionId: child.id,
          type: 'branch_summary',
          data: { summary: 'Copied branch context' },
        },
      ],
    })
    await prisma.agentSession.update({ where: { id: child.id }, data: { leafId: 'legacy-branch' } })
    await backfill()
    const entries = await agentSessionService.getEntries(child.id)
    expect(entries[2].model?.[0]).toMatchObject({
      content: [{ arguments: { annotationId: `chat:${child.id}:legacy-legacy-root` } }],
    })
    expect(entries[3].model?.[0]).toMatchObject({
      content: [{ data: '__S3_DATA__' }],
      details: { sourceKeys: ['historical-image'], exitCode: null },
    })
    expect(entries[4]).toMatchObject({ kind: 'pi.compaction', head: entries[2].id })
    expect(JSON.stringify(entries[5].model)).toContain('Copied branch context')
    expect(
      (await prisma.agentSession.findUniqueOrThrow({ where: { id: child.id } })).accountedUsage,
    ).toMatchObject({ totalTokens: 17, cost: 0.2 })
    // Read the native ledger without hydrating image references.
    const cache = await openSessionCache(child.id)
    const harness = await Harness.open(
      cache.storage,
      { models: createModels(), registry: createRegistry() },
      context,
    )
    try {
      expect(
        (await harness.snapshot(UsageDoc, (await harness.root(context)).id, context))?.models[
          'faux/faux-1'
        ].totalTokens,
      ).toBe(17)
    } finally {
      await harness.close(context)
    }
  })

  it('rejects missing ancestry before writing any converted records', async () => {
    const { child } = await fixture()
    await prisma.agentSessionEntry.update({
      where: { id: 'legacy-reply' },
      data: { parentId: 'missing' },
    })
    await expect(backfill()).rejects.toThrow('ancestor is missing')
    expect(await prisma.agentSessionCommit.count({ where: { sessionId: child.id } })).toBe(0)
  })

  it('rejects cyclic ancestry', async () => {
    await fixture()
    await prisma.agentSessionEntry.update({
      where: { id: 'legacy-root' },
      data: { parentId: 'legacy-reply' },
    })
    await expect(backfill()).rejects.toThrow('cyclic history')
  })
})
