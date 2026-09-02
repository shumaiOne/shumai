import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { s3Service } from '@shumai/core/src/s3/s3'
import { type SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { DatabaseSessionStorage } from './database-session-storage'
import { agentService } from '@shumai/core/src/agent/agent'
import { createAgentSession, type DbProviderInfo } from './index'
import * as sandboxedBashModule from './tools/sandboxed-bash'
import * as analyzeImageModule from './tools/analyze-image'
import * as screenshotModule from './tools/screenshot'

describe('DatabaseSessionStorage', () => {
  setupTestDbHooks()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockModelConfig: PrismaJson.ModelConfig = {
    reasoning: false,
    input: ['text'],
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }

  const mockProviders: DbProviderInfo[] = [
    {
      name: 'test-provider',
      config: { api: 'openai-responses', apiKey: 'TEST_KEY' },
      models: [
        {
          modelId: 'test-model',
          name: 'Test Model',
          config: mockModelConfig,
        },
      ],
    },
  ]

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

    const entry: SessionTreeEntry = {
      type: 'message',
      id: 'entry-1',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'Test' }],
        timestamp: Date.now(),
      },
    }
    await storage.appendEntry(entry)
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

    // Record data is generic Json
    const record = await prisma.agentSessionEntry.findUnique({ where: { id: 'msg-1' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedEntry = record?.data as any
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

  it('should strip and reinject skill content', async () => {
    const { agent } = await setupTestData()
    const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

    const getSkillContentSpy = vi
      .spyOn(agentService, 'getSkillContent')
      .mockResolvedValue('# Mocked Skill Content')

    const entry: SessionTreeEntry = {
      type: 'message',
      id: 'msg-skill',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'toolResult',
        toolCallId: 'call-2',
        toolName: 'read_skill',
        isError: false,
        timestamp: Date.now(),
        content: [{ type: 'text', text: 'original-skill-content' }],
        details: {
          skillId: 'some-skill-id',
        },
      },
    }

    await storage.appendEntry(entry)

    // Verify saved entry is stripped
    const record = await prisma.agentSessionEntry.findUnique({ where: { id: 'msg-skill' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedEntry = record?.data as any
    expect(savedEntry.message.content[0].text).toBe('__SKILL_CONTENT__')

    // Verify retrieval reinjects data
    const retrieved = await storage.getEntry('msg-skill')
    expect(getSkillContentSpy).toHaveBeenCalledWith('some-skill-id')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((retrieved as any).message.content[0].text).toBe('# Mocked Skill Content')
  })

  it('should restore environment variables when resuming session', async () => {
    const { agent, user } = await setupTestData()

    // 1. Create a session first to get a sessionId
    const initialStorage = await DatabaseSessionStorage.create({ agentId: agent.id })
    const sessionId = initialStorage.sessionId

    // 2. Append a successful read_skill entry
    const entry: SessionTreeEntry = {
      type: 'message',
      id: 'msg-skill-env',
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'toolResult',
        toolCallId: 'call-env-1',
        toolName: 'read_skill',
        isError: false,
        timestamp: Date.now(),
        content: [{ type: 'text', text: 'skill content' }],
        details: {
          skillId: 'env-skill-id',
        },
      },
    }
    await initialStorage.appendEntry(entry)

    // 3. Mock getSkillEnvs to return environment variables
    const getSkillEnvsSpy = vi.spyOn(agentService, 'getSkillEnvs').mockResolvedValue({
      MOCK_ENV_VAR: 'mocked-value',
    })

    // 4. Mock agentService.getSkillContent to avoid actual download throws
    vi.spyOn(agentService, 'getSkillContent').mockResolvedValue('# Skill')

    // 5. Spy on createSandboxedBashTool
    const createSandboxedBashToolSpy = vi.spyOn(sandboxedBashModule, 'createSandboxedBashTool')

    // 6. Resume the session via createAgentSession
    await createAgentSession({
      teamId: 't1',
      agentId: agent.id,
      providerName: 'test-provider',
      modelId: 'test-model',
      systemPrompt: 'Test prompt',
      teamSkills: [],
      allowedDomains: [],
      sessionId: sessionId,
      userId: user.id,
      providers: mockProviders,
    })

    // 7. Verify skill environment variables are restored.
    expect(getSkillEnvsSpy).toHaveBeenCalledWith('env-skill-id')
    expect(createSandboxedBashToolSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        MOCK_ENV_VAR: 'mocked-value',
      }),
      expect.any(Object),
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

  it('should use the current comment ID for media tools in subsequent turns (image)', async () => {
    const { agent, user, team } = await setupTestData()

    // Create a project and asset to satisfy FK constraints
    const project = await prisma.project.create({
      data: { name: 'Test Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        id: 'asset-123',
        name: 'test.png',
        type: 'file',
        mediaType: 'image/png',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial MediaInfo mock for testing
        media: { proxyType: 'image' } as any,
        projectId: project.id,
        status: 'uploaded',
      },
    })

    // 1. Create a session with an original comment ID and an asset ID using the storage class
    const initialStorage = await DatabaseSessionStorage.create({
      agentId: agent.id,
      userId: user.id,
      cwd: '/test/cwd',
      assetId: asset.id,
      userCommentId: 'original-comment-123',
    })
    const sessionId = initialStorage.sessionId

    // 2. Spy on media tools constructors
    const createAnalyzeImageToolSpy = vi.spyOn(analyzeImageModule, 'createAnalyzeImageTool')
    const createScreenshotToolSpy = vi.spyOn(screenshotModule, 'createScreenshotTool')

    // 3. Resume the session via createAgentSession with a NEW comment ID
    await createAgentSession({
      teamId: 't1',
      agentId: agent.id,
      providerName: 'test-provider',
      modelId: 'test-model',
      systemPrompt: 'Test prompt',
      teamSkills: [],
      allowedDomains: [],
      sessionId: sessionId,
      userId: user.id,
      userCommentId: 'new-comment-456',
      providers: mockProviders,
    })

    // 4. Assert that the tools were instantiated using user ID
    expect(createAnalyzeImageToolSpy).toHaveBeenCalledWith(user.id)
    expect(createScreenshotToolSpy).toHaveBeenCalledWith(user.id)
  })

  it('should instantiate media tools with user ID in subsequent turns (video)', async () => {
    const { agent, user, team } = await setupTestData()

    // Create a project and asset to satisfy FK constraints
    const project = await prisma.project.create({
      data: { name: 'Test Project', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        id: 'asset-456',
        name: 'test.mp4',
        type: 'file',
        mediaType: 'video/mp4',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial MediaInfo mock for testing
        media: { proxyType: 'video' } as any,
        projectId: project.id,
        status: 'uploaded',
      },
    })

    // 1. Create a session with an original comment ID and an asset ID using the storage class
    const initialStorage = await DatabaseSessionStorage.create({
      agentId: agent.id,
      userId: user.id,
      cwd: '/test/cwd',
      assetId: asset.id,
      userCommentId: 'original-comment-123',
    })
    const sessionId = initialStorage.sessionId

    // 2. Spy on media tools constructors
    const createAnalyzeImageToolSpy = vi.spyOn(analyzeImageModule, 'createAnalyzeImageTool')
    const createScreenshotToolSpy = vi.spyOn(screenshotModule, 'createScreenshotTool')

    // 3. Resume the session via createAgentSession with a NEW comment ID
    await createAgentSession({
      teamId: 't1',
      agentId: agent.id,
      providerName: 'test-provider',
      modelId: 'test-model',
      systemPrompt: 'Test prompt',
      teamSkills: [],
      allowedDomains: [],
      sessionId: sessionId,
      userId: user.id,
      userCommentId: 'new-comment-456',
      providers: mockProviders,
    })

    // 4. Assert that the tools were instantiated using user ID
    expect(createScreenshotToolSpy).toHaveBeenCalledWith(user.id)
    expect(createAnalyzeImageToolSpy).toHaveBeenCalledWith(user.id)
  })

  describe('P1 Bug Reproductions', () => {
    it('should persist a leaf entry and validate targetId when setLeafId is called', async () => {
      const { agent } = await setupTestData()
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

      const msgEntry: SessionTreeEntry = {
        type: 'message',
        id: 'msg-100',
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
          timestamp: Date.now(),
        },
      }
      await storage.appendEntry(msgEntry)
      expect(await storage.getLeafId()).toBe('msg-100')

      // setLeafId to an existing entry
      await storage.setLeafId('msg-100')

      // Verify that a 'leaf' entry was appended to database entries
      const entries = await storage.getEntries()
      const leafEntries = entries.filter((e) => e.type === 'leaf')
      expect(leafEntries.length).toBe(1)
      expect(leafEntries[0]).toMatchObject({
        type: 'leaf',
        targetId: 'msg-100',
      })

      // Calling setLeafId with non-existent targetId should throw not_found error
      await expect(storage.setLeafId('non-existent-id')).rejects.toThrow(
        'Entry non-existent-id not found',
      )
    })

    it('should execute appendEntry in a single atomic transaction', async () => {
      const { agent } = await setupTestData()
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

      // Mock prisma.agentSession.update to throw an error during setLeafId inside appendEntry
      const updateSpy = vi
        .spyOn(prisma.agentSession, 'update')
        .mockRejectedValueOnce(new Error('DB Update Failed'))

      const entry: SessionTreeEntry = {
        type: 'message',
        id: 'atomic-msg-1',
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Atomic test' }],
          timestamp: Date.now(),
        },
      }

      await expect(storage.appendEntry(entry)).rejects.toThrow('DB Update Failed')

      // Because appendEntry should be atomic, atomic-msg-1 must NOT exist in the database
      const dbEntry = await prisma.agentSessionEntry.findUnique({
        where: { id: 'atomic-msg-1' },
      })
      expect(dbEntry).toBeNull()

      updateSpy.mockRestore()
    })

    it('should return session name from agentSession record', async () => {
      const { agent } = await setupTestData()
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

      expect(await storage.getSessionName()).toBeUndefined()

      await prisma.agentSession.update({
        where: { id: storage.sessionId },
        data: { name: 'My Chat Session' },
      })

      expect(await storage.getSessionName()).toBe('My Chat Session')
    })

    it('should aggregate session stats correctly', async () => {
      const { agent } = await setupTestData()
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

      const msg1: SessionTreeEntry = {
        type: 'message',
        id: 'stats-msg-1',
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
          timestamp: Date.now(),
        },
      }

      const msg2: SessionTreeEntry = {
        type: 'message',
        id: 'stats-msg-2',
        parentId: 'stats-msg-1',
        timestamp: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
          api: 'openai-responses',
          provider: 'test-provider',
          model: 'test-model',
          stopReason: 'stop',
          timestamp: Date.now(),
          usage: {
            input: 100,
            output: 50,
            cacheRead: 20,
            cacheWrite: 0,
            totalTokens: 170,
            cost: { input: 0.01, output: 0.02, cacheRead: 0.002, cacheWrite: 0, total: 0.032 },
          },
        },
      }

      await storage.appendEntry(msg1)
      await storage.appendEntry(msg2)

      const stats = await storage.getSessionStats()
      expect(stats.messageCount).toBe(2)
      expect(stats.cachedTokens).toBe(20)
      expect(stats.uncachedTokens).toBe(150)
      expect(stats.totalTokens).toBe(170)
      expect(stats.costTotal).toBeCloseTo(0.032)
    })

    it('should save user message turn as custom_message (shumai_message) in DB when currentMessageContext is set', async () => {
      const { agent, user } = await setupTestData()
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id, userId: user.id })

      storage.currentMessageContext = {
        user: { id: user.id, name: user.name, role: 'owner' },
        currentAsset: { id: 'asset-123', name: 'video.mp4', type: 'file' },
      }

      const userEntry: SessionTreeEntry = {
        type: 'message',
        id: 'msg-user-1',
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: 'Hello, help me analyze this video',
          timestamp: Date.now(),
        },
      }

      await storage.appendEntry(userEntry)

      // 1. Verify DB record type is 'custom_message', not 'message'
      const record = await prisma.agentSessionEntry.findUnique({
        where: { id: 'msg-user-1' },
      })
      expect(record).toBeDefined()
      expect(record?.type).toBe('custom_message')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = record?.data as any
      expect(data.customType).toBe('shumai_message')
      expect(data.content).toBe('Hello, help me analyze this video')
      expect(data.details?.user?.id).toBe(user.id)
      expect(data.details?.currentAsset?.id).toBe('asset-123')

      // 2. Verify getEntries() and getPathToRoot() do not throw and return proper custom_message
      const entries = await storage.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe('custom_message')

      const pathEntries = await storage.getPathToRoot('msg-user-1')
      expect(pathEntries).toHaveLength(1)
      expect(pathEntries[0].type).toBe('custom_message')

      const stats = await storage.getSessionStats()
      expect(stats.messageCount).toBe(1)
    })

    it('should safely handle legacy records where type was message but data was shumai_message', async () => {
      const { agent } = await setupTestData()
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id })

      await prisma.agentSessionEntry.create({
        data: {
          id: 'legacy-corrupted-entry',
          sessionId: storage.sessionId,
          type: 'message',
          data: {
            customType: 'shumai_message',
            content: 'Legacy prompt',
            display: true,
            details: { user: { id: 'u1', name: 'User 1' } },
          },
        },
      })

      // Must not throw in getEntries(), getPathToRoot(), or getSessionStats()
      const entries = await storage.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe('custom_message')

      const path = await storage.getPathToRoot('legacy-corrupted-entry')
      expect(path).toHaveLength(1)
      expect(path[0].type).toBe('custom_message')

      const stats = await storage.getSessionStats()
      expect(stats.messageCount).toBe(1)
    })

    it('should dynamically inject thread metadata into details.thread in getPathToRoot when replies exist', async () => {
      const { agent, user } = await setupTestData()
      const project = await prisma.project.create({
        data: { name: 'Test Project', teamId: agent.teamId },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'Test Asset',
          type: 'file',
          status: 'uploaded',
          projectId: project.id,
        },
      })
      const storage = await DatabaseSessionStorage.create({ agentId: agent.id, assetId: asset.id })

      const rootComment = await prisma.assetComment.create({
        data: {
          id: 'comment-root-1',
          assetId: asset.id,
          message: 'Top-level question',
          creatorId: user.id,
        },
      })

      // Add a reply
      await prisma.assetComment.create({
        data: {
          id: 'comment-reply-1',
          assetId: asset.id,
          message: 'Reply 1',
          creatorId: user.id,
          replyToId: rootComment.id,
        },
      })

      // Create session entry for root comment
      await prisma.agentSessionEntry.create({
        data: {
          id: rootComment.id,
          sessionId: storage.sessionId,
          assetId: asset.id,
          type: 'custom_message',
          data: {
            customType: 'shumai_message',
            content: 'Top-level question',
            display: true,
            details: { user: { id: user.id, name: user.name } },
          },
        },
      })

      const path = await storage.getPathToRoot(rootComment.id)
      expect(path).toHaveLength(1)
      expect(path[0].type).toBe('custom_message')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = (path[0] as any).details
      expect(details.thread).toEqual({
        id: rootComment.id,
        replyCount: 1,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((path[0] as any).content).toBe('Top-level question')

      const entries = await storage.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe('custom_message')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((entries[0] as any).details?.thread).toEqual({
        id: rootComment.id,
        replyCount: 1,
      })
    })
  })
})
