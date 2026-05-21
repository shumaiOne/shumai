import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { s3Service } from '@/services/s3/s3'
import { type SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { describe, expect, it, vi } from 'vitest'
import { DatabaseSessionStorage } from './database-session-storage'

describe('DatabaseSessionStorage', () => {
  setupTestDbHooks()

  const mockModelConfig: PrismaJson.ModelConfig = {
    reasoning: false,
    input: ['text'],
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }

  const setupTestData = async () => {
    const team = await prisma.team.create({ data: { name: 'Test Team' } })
    const provider = await prisma.provider.create({
      data: {
        name: 'test-provider',
        teamId: team.id,
        config: { api: 'openai-responses' },
      },
    })
    const model = await prisma.model.create({
      data: {
        modelId: 'test-model',
        name: 'Test Model',
        providerId: provider.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: mockModelConfig as any,
      },
    })
    const user = await prisma.user.create({
      data: { name: 'Test User', email: 'test@example.com', type: 'human' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: user.id,
        teamId: team.id,
        type: 'chat',
        providerId: provider.id,
        modelId: model.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { provider: 'test-provider', model: 'test-model' } as any,
      },
    })
    return { team, user, agent }
  }

  it('should create and retrieve metadata', async () => {
    const { agent, user } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({
      agentId: agent.id,
      userId: user.id,
      cwd: '/test/cwd',
    })

    const metadata = await storage.getMetadata()
    expect(metadata.agentId).toBe(agent.id)
    expect(metadata.userId).toBe(user.id)
    expect(metadata.cwd).toBe('/test/cwd')
    expect(metadata.id).toBeDefined()
    expect(metadata.createdAt).toBeDefined()
  })

  it('should manage leafId', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    expect(await storage.getLeafId()).toBeNull()

    await storage.setLeafId('entry-1')
    expect(await storage.getLeafId()).toBe('entry-1')

    await storage.setLeafId(null)
    expect(await storage.getLeafId()).toBeNull()
  })

  it('should append and retrieve entries', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    const entry: SessionTreeEntry = {
      type: 'message',
      id: 'msg-1',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'hello' }],
        timestamp: Date.now(),
      },
    }

    await storage.appendEntry(entry)

    // Verify leafId was auto-updated
    expect(await storage.getLeafId()).toBe('msg-1')

    const retrieved = await storage.getEntry('msg-1')
    expect(retrieved).toEqual(entry)

    const allEntries = await storage.getEntries()
    expect(allEntries).toHaveLength(1)
    expect(allEntries[0]).toEqual(entry)
  })

  it('should find entries by type', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    await storage.appendEntry({
      type: 'message',
      id: 'msg-1',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: [], timestamp: Date.now() },
    })

    await storage.appendEntry({
      type: 'thinking_level_change',
      id: 'think-1',
      parentId: 'msg-1',
      timestamp: new Date().toISOString(),
      thinkingLevel: 'high',
    })

    const messages = await storage.findEntries('message')
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('msg-1')

    const thinkChanges = await storage.findEntries('thinking_level_change')
    expect(thinkChanges).toHaveLength(1)
    expect(thinkChanges[0].id).toBe('think-1')
  })

  it('should retrieve path to root', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    await storage.appendEntry({
      type: 'message',
      id: 'msg-1',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: [], timestamp: Date.now() },
    })

    await storage.appendEntry({
      type: 'message',
      id: 'msg-2',
      parentId: 'msg-1',
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [],
        timestamp: Date.now(),
        provider: 'p',
        model: 'm',
        api: 'api',
        usage: { input: 0, output: 0 },
        // AssistantMessage has many internal fields from pi-ai
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })

    await storage.appendEntry({
      type: 'message',
      id: 'msg-3',
      parentId: 'msg-2',
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: [], timestamp: Date.now() },
    })

    const path = await storage.getPathToRoot('msg-3')
    expect(path).toHaveLength(3)
    expect(path[0].id).toBe('msg-1')
    expect(path[1].id).toBe('msg-2')
    expect(path[2].id).toBe('msg-3')
  })

  it('should strip and reinject image data', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    const getObjectSpy = vi.spyOn(s3Service, 'getObject').mockResolvedValue({
      buffer: Buffer.from('reinjected-data'),
      contentType: 'image/png',
      // S3Object has complex metadata requirements not needed for this test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const entry: SessionTreeEntry = {
      type: 'message',
      id: 'msg-1',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'toolResult',
        toolCallId: 'call-1',
        toolName: 'tool',
        isError: false,
        timestamp: Date.now(),
        content: [{ type: 'image', data: 'original-base64-data', mimeType: 'image/png' }],
        details: {
          sourceKeys: ['path/to/image.png'],
        },
      },
    }

    await storage.appendEntry(entry)

    // Record entry is generic Json
    const record = await prisma.agentSessionEntry.findUnique({ where: { id: 'msg-1' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedEntry = record?.entry as any
    expect(savedEntry.message.content[0].data).toBe('__S3_DATA__')

    // Verify retrieval reinjects data
    const retrieved = await storage.getEntry('msg-1')
    expect(getObjectSpy).toHaveBeenCalledWith('shumai', 'path/to/image.png')
    // retrieved is a SessionTreeEntry, but we need to access internal message properties for verification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((retrieved as any).message.content[0].data).toBe(
      Buffer.from('reinjected-data').toString('base64'),
    )
  })

  it('should retrieve label', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    await storage.appendEntry({
      type: 'label',
      id: 'label-1',
      targetId: 'target-1',
      parentId: null,
      timestamp: new Date().toISOString(),
      label: 'Test Label',
    })

    const label = await storage.getLabel('label-1')
    expect(label).toBe('Test Label')
  })

  it('should retrieve entries in order', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    // Insert entries out of order (by insertion time) but with ordered IDs
    await storage.appendEntry({
      type: 'message',
      id: '01B',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: [], timestamp: Date.now() },
    })

    await storage.appendEntry({
      type: 'message',
      id: '01A',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: [], timestamp: Date.now() },
    })

    await storage.appendEntry({
      type: 'message',
      id: '01C',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: [], timestamp: Date.now() },
    })

    const entries = await storage.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].id).toBe('01A')
    expect(entries[1].id).toBe('01B')
    expect(entries[2].id).toBe('01C')
  })
})
