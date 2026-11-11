import { hydrateRequest } from './session-content'
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context'
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai'
import {
  createRegistry,
  defineExtension,
  Harness,
  GenerationTask,
  hook,
  ROOT_CONVERSATION_ID,
  type StorageWrite,
} from '@earendil-works/pi-durable'
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node'
import { setupTestDbHooks } from '@shumai/db/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { s3Service } from '../s3/s3'
import { agentService } from './agent'
import { hydrateStorage, synchronizeStorage } from './session-storage'

describe('native Durable content storage', () => {
  setupTestDbHooks()
  afterEach(() => vi.restoreAllMocks())

  it('keeps an uncertain commit dirty and refuses subsequent writes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'shumai-failed-session-'))
    const dirty = vi.fn(async () => {})
    const clean = vi.fn(async () => {})
    const persist = vi.fn(async () => {
      throw new Error('mirror unavailable')
    })
    const storage = synchronizeStorage(
      await openNodeSqliteStorage(join(directory, 'session.sqlite')),
      {
        dirty,
        clean,
        persist,
      },
    )
    const acknowledge = vi.fn()
    try {
      await expect(
        storage.commit(
          [[{ type: 'conversation', value: { id: ROOT_CONVERSATION_ID } }]],
          acknowledge,
          context,
        ),
      ).rejects.toThrow('mirror unavailable')
      expect(await storage.conversation(ROOT_CONVERSATION_ID, context)).toBeDefined()
      await expect(storage.commit([[]], acknowledge, context)).rejects.toThrow('mirror unavailable')
      expect(dirty).toHaveBeenCalledTimes(1)
      expect(persist).toHaveBeenCalledTimes(1)
      expect(clean).not.toHaveBeenCalled()
      expect(acknowledge).not.toHaveBeenCalled()
    } finally {
      await storage.close(context)
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('hydrates generation and compaction after reopening while both persisted copies stay compact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'shumai-content-'))
    const path = join(directory, 'session.sqlite')
    const commits: StorageWrite[][] = []
    const text = 'Resolved skill instructions '.repeat(100)
    vi.spyOn(agentService, 'getSkillContent').mockResolvedValue(text)
    vi.spyOn(s3Service, 'getObject').mockResolvedValue({
      buffer: Buffer.from('image bytes'),
      contentType: 'image/png',
    })
    const faux = fauxProvider({
      models: [{ id: 'test', input: ['text', 'image'], contextWindow: 100000, maxTokens: 1024 }],
    })
    const models = createModels()
    models.setProvider(faux.provider)
    const registry = createRegistry()
    registry.install(
      defineExtension({
        name: 'shumai',
        hooks: [
          hook(GenerationTask, {
            beforeRequest: async ({ messages }, api, context) => ({
              messages: await hydrateRequest(messages, api, context),
            }),
          }),
        ],
        tools: [
          {
            name: 'read_skill',
            description: 'Read a skill',
            parameters: { type: 'object', properties: {} },
            execute: async () => ({
              output: [{ type: 'text', text }],
              details: { skillId: 'skill' },
            }),
          },
          {
            name: 'read_asset',
            description: 'Read an image',
            parameters: { type: 'object', properties: {} },
            execute: async () => ({
              output: [
                {
                  type: 'image',
                  data: Buffer.from('image bytes').toString('base64'),
                  mimeType: 'image/png',
                },
              ],
              details: { sourceKeys: ['image-key'] },
            }),
          },
        ],
      }),
    )
    const open = async () =>
      Harness.open(
        hydrateStorage(
          synchronizeStorage(await openNodeSqliteStorage(path), {
            dirty: async () => {},
            clean: async () => {},
            persist: async (accepted) => {
              commits.push(
                ...accepted.map(
                  ({ writes }) => JSON.parse(JSON.stringify(writes)) as StorageWrite[],
                ),
              )
            },
          }),
        ),
        { models, registry, settings: () => ({ compaction: { keepRecentTokens: 1 } }) },
        context,
      )
    let harness = await open()
    try {
      faux.setResponses([
        (input) => {
          expect(JSON.stringify(input.messages)).toContain(
            Buffer.from('image bytes').toString('base64'),
          )
          return fauxAssistantMessage(
            [fauxToolCall('read_skill', {}), fauxToolCall('read_asset', {})],
            { stopReason: 'toolUse' },
          )
        },
        (input) => {
          expect(JSON.stringify(input.messages)).toContain('Resolved skill instructions')
          expect(JSON.stringify(input.messages)).toContain(
            Buffer.from('image bytes').toString('base64'),
          )
          return fauxAssistantMessage('First answer')
        },
      ])
      let root = await harness.root(context, {
        agent: { model: { provider: faux.provider.id, modelId: 'test' } },
      })
      expect(
        (
          await (
            await root.submit(
              {
                type: 'input',
                content: [
                  { type: 'text', text: 'Read the skill and image' },
                  { type: 'image', data: '__S3_DATA__', mimeType: 'image/png' },
                ],
                entry: {
                  kind: 'shumai.message',
                  data: {
                    displayText: 'Read the skill and image',
                    timestamp: 1,
                    context: {},
                    sourceKeys: ['image-key'],
                  },
                },
              },
              context,
            )
          ).wait(context)
        ).status,
      ).toBe('done')
      await harness.close(context)
      expect(JSON.stringify(commits)).toContain('__S3_DATA__')
      expect(JSON.stringify(commits)).toContain('__SKILL_CONTENT__')
      expect(JSON.stringify(commits)).not.toContain(text)
      expect(JSON.stringify(commits)).not.toContain(Buffer.from('image bytes').toString('base64'))
      harness = await open()
      root = await harness.root(context)
      faux.setResponses([
        (input) => {
          expect(JSON.stringify(input.messages)).toContain('Resolved skill instructions')
          expect(JSON.stringify(input.messages)).not.toContain('__SKILL_CONTENT__')
          return fauxAssistantMessage('Summary')
        },
      ])
      const compact = await root.compact(undefined, context)
      expect((await harness.waitForTask(compact, context)).state.status).toBe('terminal')
      await harness.close(context)
      const native = await openNodeSqliteStorage(path)
      try {
        const entries = await native.scanEntries(
          { conversationId: root.id },
          100,
          undefined,
          context,
        )
        const stored = JSON.stringify(entries.items)
        expect(stored).toContain('__SKILL_CONTENT__')
        expect(stored).not.toContain(text)
      } finally {
        await native.close(context)
      }
    } finally {
      await harness.close(context)
      await rm(directory, { recursive: true, force: true })
    }
  })
})
