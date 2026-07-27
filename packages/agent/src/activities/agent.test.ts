import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  agentChatActivity,
  autofillAiActivity,
  type AgentExecutionContext,
  initializeAgentSessionActivity,
  deleteCommentActivity,
  createCommentActivity,
  updateCommentActivity,
  getAgentChatContextActivity,
  getAgentAutofillContextActivity,
  getAssetActivity,
  getCommentActivity,
  getProjectAutofillFieldsActivity,
  updateAssetMetadataActivity,
  getAssetPathContextActivity,
  executeAgentToolActivity,
  generateSessionNameActivity,
  type GenerateSessionNameParams,
  getUserTeamInfoActivity,
  getAssetTopLevelThreadsActivity,
} from './agent'
import * as piAgent from '../index'
import { type AgentHarness, type Session } from '@earendil-works/pi-agent-core'
import { type DatabaseSessionMetadata } from '../database-session-storage'
import { triggerLocalCancel } from '@shumai/workflow-core'
import { Context } from '@temporalio/activity'

import {
  prisma,
  AssetType,
  AssetStatus,
  type Team,
  type User,
  type Project,
  type Asset,
} from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { authzService } from '@shumai/core/src/authz/authz'
import { uploadService } from '@shumai/core/src/upload/upload'

vi.mock('../index', async () => {
  const actual = await vi.importActual('../index')
  return {
    ...actual,
    createAgentSession: vi.fn(),
    fieldsToTypeBoxSchema: vi.fn(),
  }
})

describe('Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Context, 'current').mockImplementation(() => {
      throw new Error('Not in Temporal')
    })
  })

  it('should call agentChatActivity and prompt the harness', async () => {
    const mockHarness = {
      subscribe: vi.fn(),
      prompt: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI response' }],
        usage: { input: 10, output: 20 },
      }),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      session: mockSession as unknown as Session<DatabaseSessionMetadata>,
      harness: mockHarness as unknown as AgentHarness,
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    const res = await agentChatActivity({
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      context,
    })

    expect(res.text).toBe('AI response')
    expect(res.usage.inputTokens).toBe(10)
    expect(res.usage.outputTokens).toBe(20)
    expect(piAgent.createAgentSession).toHaveBeenCalled()
  })

  it('should subscribe to harness events and record usage for assistant message_end events', async () => {
    const { aiUsageService } = await import('@shumai/core/src/ai-usage/ai-usage')
    const spyRecordUsage = vi.spyOn(aiUsageService, 'recordUsage').mockResolvedValue()

    let subscribeListener!: (event: unknown) => Promise<void>
    const mockHarness = {
      subscribe: vi.fn().mockImplementation((listener) => {
        subscribeListener = listener
      }),
      prompt: vi.fn().mockImplementation(async () => {
        // Trigger assistant message end event during turn
        if (subscribeListener) {
          await subscribeListener({
            type: 'message_end',
            message: {
              role: 'assistant',
              usage: {
                input: 150,
                output: 75,
                cacheRead: 25,
                totalTokens: 225,
                cost: { total: 0.0015 },
              },
            },
          })
        }
        return {
          content: [{ type: 'text', text: 'Subscribed response' }],
          usage: { input: 150, output: 75 },
        }
      }),
    }

    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      session: mockSession as unknown as Session<DatabaseSessionMetadata>,
      harness: mockHarness as unknown as AgentHarness,
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    const res = await agentChatActivity({
      teamId: 'team123',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      userId: 'user123',
      context,
    })

    expect(res.text).toBe('Subscribed response')
    expect(res.usage.inputTokens).toBe(150)
    expect(res.usage.outputTokens).toBe(75)
    expect(res.usage.cacheReadTokens).toBe(25)
    expect(res.usage.cost).toBe(0.0015)
    expect(spyRecordUsage).toHaveBeenCalledWith({
      teamId: 'team123',
      userId: 'user123',
      inputTokens: 150,
      outputTokens: 75,
      cacheReadTokens: 25,
      totalTokens: 225,
      cost: 0.0015,
    })
  })

  it('should register local cancellation handler and call harness.abort when cancelled in local mode', async () => {
    let resolvePrompt!: (value: {
      content: Array<{ type: string; text: string } | { type: string }>
      usage: { input: number; output: number }
      stopReason?: string
      errorMessage?: string
    }) => void
    const promptPromise = new Promise<Parameters<typeof resolvePrompt>[0]>((resolve) => {
      resolvePrompt = resolve
    })

    const mockHarness = {
      subscribe: vi.fn(),
      prompt: vi.fn().mockReturnValue(promptPromise),
      abort: vi.fn(),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      session: mockSession as unknown as Session<DatabaseSessionMetadata>,
      harness: mockHarness as unknown as AgentHarness,
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    const executionPromise = agentChatActivity({
      taskId: 'task-123',
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      context,
    })

    // Yield to let the asynchronous setup register the cancel handler
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Simulate user cancellation
    const cancelled = triggerLocalCancel('task-123')
    expect(cancelled).toBe(true)
    expect(mockHarness.abort).toHaveBeenCalled()

    // Resolve the prompt promise to allow the activity to finish clean
    resolvePrompt({
      content: [{ type: 'text', text: 'AI response' }],
      usage: { input: 10, output: 20 },
    })

    await executionPromise
  })

  it('should listen to Temporal cancellation signal and call harness.abort when cancelled in Temporal mode', async () => {
    const mockTemporalContext = {
      cancellationSignal: new EventTarget(),
      heartbeat: vi.fn(),
    } as unknown as Context
    vi.spyOn(Context, 'current').mockReturnValue(mockTemporalContext)

    let resolvePrompt!: (value: {
      content: Array<{ type: string; text: string } | { type: string }>
      usage: { input: number; output: number }
      stopReason?: string
      errorMessage?: string
    }) => void
    const promptPromise = new Promise<Parameters<typeof resolvePrompt>[0]>((resolve) => {
      resolvePrompt = resolve
    })

    const mockHarness = {
      subscribe: vi.fn(),
      prompt: vi.fn().mockReturnValue(promptPromise),
      abort: vi.fn(),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      session: mockSession as unknown as Session<DatabaseSessionMetadata>,
      harness: mockHarness as unknown as AgentHarness,
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    const addEventListenerSpy = vi.spyOn(mockTemporalContext.cancellationSignal, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(
      mockTemporalContext.cancellationSignal,
      'removeEventListener',
    )

    const executionPromise = agentChatActivity({
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      context,
    })

    // Yield to let the asynchronous setup add the abort event listener
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(addEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true })

    // Simulate Temporal cancellation event
    mockTemporalContext.cancellationSignal.dispatchEvent(new Event('abort'))
    expect(mockHarness.abort).toHaveBeenCalled()

    // Resolve the prompt promise to allow the activity to finish clean
    resolvePrompt({
      content: [{ type: 'text', text: 'AI response' }],
      usage: { input: 10, output: 20 },
    })

    await executionPromise
    expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function))
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('should include error message in text when stopReason is error', async () => {
    const mockHarness = {
      subscribe: vi.fn(),
      prompt: vi.fn().mockResolvedValue({
        content: [],
        usage: { input: 0, output: 0 },
        stopReason: 'error',
        errorMessage: 'API key not valid',
      }),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      session: mockSession as unknown as Session<DatabaseSessionMetadata>,
      harness: mockHarness as unknown as AgentHarness,
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    const res = await agentChatActivity({
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      context,
    })

    expect(res.text).toBe('Error: API key not valid')
  })

  it('should pass thinkingLevel from agent config to createAgentSession', async () => {
    const mockHarness = {
      subscribe: vi.fn(),
      prompt: vi.fn().mockResolvedValue({
        content: [],
        usage: { input: 0, output: 0 },
      }),
      getThinkingLevel: vi.fn().mockReturnValue('high'),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockResolvedValue({
      session: mockSession as unknown as Session<DatabaseSessionMetadata>,
      harness: mockHarness as unknown as AgentHarness,
    })

    const context = {
      agent: {
        id: 'b1',
        provider: { name: 'google' },
        modelRef: { modelId: 'gemini' },
        config: { thinkingLevel: 'high' },
      },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    await agentChatActivity({
      teamId: 't1',
      agentId: 'b1',
      message: 'Hi',
      imageUrls: [],
      projectId: 'p1',
      folderId: 'f1',
      sessionId: 'mock-session-id',
      context,
    })

    expect(piAgent.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        thinkingLevel: 'high',
      }),
    )
  })

  it('should call autofillAiActivity and run autofill tool', async () => {
    const mockHarness = {
      subscribe: vi.fn(),
      prompt: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Captured' }],
        usage: { input: 5, output: 5 },
      }),
    }
    const mockSession = {
      getEntries: vi.fn().mockResolvedValue([]),
      getStorage: vi.fn().mockReturnValue({ sessionId: 'mock-session-id' }),
    }

    vi.mocked(piAgent.createAgentSession).mockImplementation(async (config: unknown) => {
      const params = config as {
        customTools: Array<{
          name: string
          execute: (id: string, args: Record<string, unknown>) => Promise<unknown>
        }>
      }
      const tool = params.customTools.find((t) => t.name === 'autofill_metadata')
      if (tool) {
        await tool.execute('1', { f1: 'val' })
      }
      return {
        session: mockSession as unknown as Session<DatabaseSessionMetadata>,
        harness: mockHarness as unknown as AgentHarness,
      }
    })

    const context = {
      agent: { id: 'b1', provider: { name: 'google' }, modelRef: { modelId: 'gemini' } },
      dbProviders: [],
      teamSkills: [],
      allowedDomains: [],
    } as unknown as AgentExecutionContext

    const res = await autofillAiActivity({
      teamId: 't1',
      images: [],
      fields: [{ id: 'f1', config: { name: 'F1', type: 'text' } }],
      context,
    })

    expect(res.text).toBe('{"f1":"val"}')
    expect(res.usage.inputTokens).toBe(5)
  })
})

describe('Agent Database Activities Integration', () => {
  setupTestDbHooks()

  let team: Team
  let user: User
  let project: Project
  let asset: Asset

  beforeEach(async () => {
    vi.restoreAllMocks()

    team = await prisma.team.create({
      data: { name: 'Test Team' },
    })

    user = await prisma.user.create({
      data: {
        name: 'Test Human',
        email: 'human@shumai.ai',
        type: 'human',
      },
    })

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        teamId: team.id,
      },
    })

    asset = await prisma.asset.create({
      data: {
        name: 'file.png',
        type: AssetType.file,
        status: AssetStatus.uploaded,
        projectId: project.id,
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'owner',
        scope: 'team',
      },
    })
  })

  describe('initializeAgentSessionActivity', () => {
    it('should initialize or reuse an asset session, create agent/user records if missing, and attach sessionId to comment', async () => {
      // Create first comment so it acts as context
      await prisma.assetComment.create({
        data: {
          assetId: asset.id,
          message: 'Hello <@' + user.id + '> check this',
          creatorId: user.id,
        },
      })

      // Create second comment that user responds with, triggering session initialization
      const userComment = await prisma.assetComment.create({
        data: {
          assetId: asset.id,
          message: 'Reply comment',
          creatorId: user.id,
        },
      })

      const sessionId = await initializeAgentSessionActivity({
        teamId: team.id,
        agentId: 'test-agent-id',
        userCommentId: userComment.id,
        userId: user.id,
      })

      expect(sessionId).toBeDefined()

      // Verify agent user created
      const agentUser = await prisma.user.findUnique({ where: { id: 'test-agent-id' } })
      expect(agentUser).toBeDefined()
      expect(agentUser?.type).toBe('agent')

      // Verify agentSession created for the asset
      const agentSession = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      })
      expect(agentSession).toBeDefined()
      expect(agentSession?.assetId).toBe(asset.id)
      expect(agentSession?.type).toBe('comment')

      // Verify user comment is updated with sessionId
      const updatedComment = await prisma.assetComment.findUnique({
        where: { id: userComment.id },
      })
      expect(updatedComment?.sessionId).toBe(sessionId)

      // Test getAssetTopLevelThreadsActivity
      const topLevelThreads = await getAssetTopLevelThreadsActivity({ assetId: asset.id })
      expect(topLevelThreads.length).toBe(2)
      expect(topLevelThreads[0].message).toContain('Hello')
      expect(topLevelThreads[1].message).toBe('Reply comment')
    })

    it('should return user name and role for team member', async () => {
      const info = await getUserTeamInfoActivity({
        userId: user.id,
        teamId: team.id,
      })
      expect(info).toBeDefined()
      expect(info?.name).toBe(user.name)
      expect(info?.role).toBe('owner')
    })
  })

  describe('Comment Operations', () => {
    it('should create, update, and delete comments correctly', async () => {
      const comment = await createCommentActivity({
        assetId: asset.id,
        message: 'Drafting response',
        agentId: 'default',
      })

      expect(comment.id).toBeDefined()
      expect(comment.message).toBe('Drafting response')

      const updated = await updateCommentActivity({
        commentId: comment.id,
        message: 'Final response',
      })
      expect(updated.message).toBe('Final response')

      await deleteCommentActivity(comment.id)
      const deleted = await prisma.assetComment.findUnique({ where: { id: comment.id } })
      expect(deleted).toBeNull()
    })
  })

  describe('Context Retrievals', () => {
    it('should retrieve Agent chat and autofill contexts correctly', async () => {
      const provider = await prisma.provider.create({
        data: {
          teamId: team.id,
          name: 'openai',
          config: {
            api: 'openai-completions',
            apiKey: 'mock-key',
          },
        },
      })

      const model = await prisma.model.create({
        data: {
          providerId: provider.id,
          modelId: 'gpt-4',
          name: 'GPT 4',
          config: {
            reasoning: false,
            input: ['text'],
            contextWindow: 8192,
            maxTokens: 2048,
            cost: { input: 0.01, output: 0.03, cacheRead: 0, cacheWrite: 0 },
          },
        },
      })

      // Create User to map Agent 1-to-1
      const agentUser = await prisma.user.create({
        data: {
          id: 'chat-agent-id',
          name: 'Chat Agent User',
          email: 'chatagent@shumai.ai',
          type: 'agent',
        },
      })

      const agent = await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: team.id,
          type: 'chat',
          providerId: provider.id,
          modelId: model.id,
          config: {
            provider: 'openai',
            model: 'gpt-4',
          },
        },
      })

      const chatCtx = await getAgentChatContextActivity({
        teamId: team.id,
        agentId: agent.id,
      })

      expect(chatCtx.agent.id).toBe(agent.id)
      expect(chatCtx.dbProviders[0].name).toBe('openai')

      // Create User for autofill agent
      const autofillUser = await prisma.user.create({
        data: {
          name: 'Autofill Agent User',
          email: 'autofillagent@shumai.ai',
          type: 'agent',
        },
      })

      const autofillAgent = await prisma.agent.create({
        data: {
          id: autofillUser.id,
          teamId: team.id,
          type: 'autofill',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: {
            provider: 'openai',
            model: 'gpt-4',
          },
        },
      })

      const autofillCtx = await getAgentAutofillContextActivity({
        teamId: team.id,
      })

      expect(autofillCtx.agent.id).toBe(autofillAgent.id)
    })
  })

  describe('Asset and Comment Fetching', () => {
    it('should retrieve asset and comment correctly', async () => {
      const fetchedAsset = await getAssetActivity(asset.id)
      expect(fetchedAsset?.id).toBe(asset.id)

      const comment = await createCommentActivity({
        assetId: asset.id,
        message: 'draft comment',
      })
      const fetchedComment = await getCommentActivity(comment.id)
      expect(fetchedComment?.id).toBe(comment.id)
    })

    it('should resolve version stack asset to its latest version file', async () => {
      const stack = await prisma.asset.create({
        data: {
          name: 'Stack',
          type: AssetType.version_stack,
          status: AssetStatus.uploaded,
          projectId: project.id,
        },
      })

      await prisma.asset.create({
        data: {
          name: 'v1.png',
          type: AssetType.file,
          mediaType: 'image/png',
          status: AssetStatus.uploaded,
          projectId: project.id,
          parentId: stack.id,
          sortIndex: 'a1',
        },
      })

      const v2 = await prisma.asset.create({
        data: {
          name: 'v2.png',
          type: AssetType.file,
          mediaType: 'image/png',
          status: AssetStatus.uploaded,
          projectId: project.id,
          parentId: stack.id,
          sortIndex: 'a0',
        },
      })

      const fetchedAsset = await getAssetActivity(stack.id)
      expect(fetchedAsset?.id).toBe(v2.id)
      expect(fetchedAsset?.name).toBe('v2.png')
    })
  })

  describe('getAssetPathContextActivity', () => {
    it('should build correct asset path context from root to asset', async () => {
      const rootFolder = await prisma.asset.create({
        data: {
          name: 'RootFolder',
          type: AssetType.folder,
          status: AssetStatus.uploaded,
          projectId: project.id,
        },
      })

      const subfolder = await prisma.asset.create({
        data: {
          name: 'SubFolder',
          type: AssetType.folder,
          status: AssetStatus.uploaded,
          projectId: project.id,
          parentId: rootFolder.id,
        },
      })

      const targetAsset = await prisma.asset.create({
        data: {
          name: 'TargetImage.webp',
          type: AssetType.file,
          status: AssetStatus.uploaded,
          projectId: project.id,
          parentId: subfolder.id,
        },
      })

      const pathCtx = await getAssetPathContextActivity(targetAsset.id)
      expect(pathCtx).toContain('Path: RootFolder/SubFolder/TargetImage.webp')
      expect(pathCtx).toContain(`name: RootFolder, id: ${rootFolder.id}`)
      expect(pathCtx).toContain(`name: SubFolder, id: ${subfolder.id}`)
      expect(pathCtx).toContain(`name: TargetImage.webp, id: ${targetAsset.id}`)
    })
  })

  describe('getProjectAutofillFieldsActivity & updateAssetMetadataActivity', () => {
    it('should get fields and update metadata', async () => {
      // Create team field
      await prisma.metadataField.create({
        data: {
          key: 'field_key_1',
          scope: 'TEAM',
          teamId: team.id,
          aiAutofill: true,
          config: { name: 'Title Extractor', type: 'text' },
        },
      })

      const fields = await getProjectAutofillFieldsActivity(project.id)
      expect(fields.length).toBe(1)
      expect(fields[0].key).toBe('field_key_1')

      await updateAssetMetadataActivity({
        assetId: asset.id,
        metadata: [{ key: 'field_key_1', value: 'Hello Web' }],
      })

      const updatedVal = await prisma.assetMetadataValue.findFirst({
        where: { assetId: asset.id, fieldKey: 'field_key_1' },
      })
      expect(updatedVal?.stringValue).toBe('Hello Web')
    })
  })

  describe('executeAgentToolActivity', () => {
    beforeEach(() => {
      vi.spyOn(authzService, 'hasPermission').mockResolvedValue()
      vi.spyOn(uploadService, 'triggerPostUploadWorkflows').mockResolvedValue()
    })

    describe('list_assets', () => {
      it('should list assets inside a folder with cursor pagination', async () => {
        const folder = await prisma.asset.create({
          data: {
            name: 'WorkspaceFolder',
            type: AssetType.folder,
            status: AssetStatus.uploaded,
            projectId: project.id,
          },
        })

        await prisma.asset.create({
          data: {
            name: 'file1.txt',
            type: AssetType.file,
            status: AssetStatus.uploaded,
            projectId: project.id,
            parentId: folder.id,
          },
        })

        await prisma.asset.create({
          data: {
            name: 'subfolder1',
            type: AssetType.folder,
            status: AssetStatus.uploaded,
            projectId: project.id,
            parentId: folder.id,
          },
        })

        const res = await executeAgentToolActivity({
          taskId: 'task-1',
          toolName: 'list_assets',
          args: { parent: folder.id, page: 1, pageSize: 1 },
          userId: user.id,
        })

        expect(res.assets.length).toBe(1)
        expect(res.pageInfo.cursor).toBeDefined()
      })
    })

    describe('create_folder', () => {
      it('should create folder and increment parent fileCount', async () => {
        const folder = await prisma.asset.create({
          data: {
            name: 'WorkspaceFolder',
            type: AssetType.folder,
            status: AssetStatus.uploaded,
            projectId: project.id,
            fileCount: 0,
          },
        })

        const res = await executeAgentToolActivity({
          taskId: 'task-1',
          toolName: 'create_folder',
          args: { parent: folder.id, name: 'subfolder' },
          userId: user.id,
        })

        expect(res.name).toBe('subfolder')
        expect(res.type).toBe('folder')

        const parentFolder = await prisma.asset.findUnique({ where: { id: folder.id } })
        expect(parentFolder?.fileCount).toBe(1)
      })
    })

    describe('create_file', () => {
      it('should create file, increment parent fileCount, and update parent sizes', async () => {
        const folder = await prisma.asset.create({
          data: {
            name: 'WorkspaceFolder',
            type: AssetType.folder,
            status: AssetStatus.uploaded,
            projectId: project.id,
            fileCount: 0,
            sizeByte: 0,
          },
        })

        const res = await executeAgentToolActivity({
          taskId: 'task-1',
          toolName: 'create_file',
          args: {
            parent: folder.id,
            s3Key: 'uploads/testfile.txt',
            name: 'testfile.txt',
            size: 500,
            contentType: 'text/plain',
          },
          userId: user.id,
        })

        expect(res.name).toBe('testfile.txt')
        expect(res.size).toBe(500)

        const parentFolder = await prisma.asset.findUnique({ where: { id: folder.id } })
        expect(parentFolder?.fileCount).toBe(1)
        expect(parentFolder?.sizeByte).toBe(500)
        expect(uploadService.triggerPostUploadWorkflows).toHaveBeenCalled()
      })
    })

    describe('create_version', () => {
      it('should create a version stack when parent is a regular file', async () => {
        const folder = await prisma.asset.create({
          data: {
            name: 'WorkspaceFolder',
            type: AssetType.folder,
            status: AssetStatus.uploaded,
            projectId: project.id,
            fileCount: 1,
            sizeByte: 200,
          },
        })

        const fileAsset = await prisma.asset.create({
          data: {
            name: 'v1.txt',
            type: AssetType.file,
            status: AssetStatus.uploaded,
            projectId: project.id,
            parentId: folder.id,
            sizeByte: 200,
          },
        })

        const res = await executeAgentToolActivity({
          taskId: 'task-1',
          toolName: 'create_version',
          args: {
            parent: fileAsset.id,
            s3Key: 'uploads/v2.txt',
            name: 'v2.txt',
            size: 300,
            contentType: 'text/plain',
          },
          userId: user.id,
        })

        expect(res.name).toBe('v2.txt')
        expect(res.size).toBe(300)

        // Check version stack was created
        const stack = await prisma.asset.findFirst({
          where: { type: AssetType.version_stack, projectId: project.id },
          include: { children: true },
        })

        expect(stack).not.toBeNull()
        expect(stack?.children.length).toBe(2) // v1.txt and v2.txt should both be inside the stack
      })

      it('should add to version stack when parent is already inside a version stack', async () => {
        const folder = await prisma.asset.create({
          data: {
            name: 'WorkspaceFolder',
            type: AssetType.folder,
            status: AssetStatus.uploaded,
            projectId: project.id,
          },
        })

        const stack = await prisma.asset.create({
          data: {
            name: 'VersionStack',
            type: AssetType.version_stack,
            status: AssetStatus.uploaded,
            projectId: project.id,
            parentId: folder.id,
            fileCount: 1,
            sizeByte: 100,
          },
        })

        const existingFileVersion = await prisma.asset.create({
          data: {
            name: 'v1.txt',
            type: AssetType.file,
            status: AssetStatus.uploaded,
            projectId: project.id,
            parentId: stack.id,
            sizeByte: 100,
          },
        })

        const res = await executeAgentToolActivity({
          taskId: 'task-1',
          toolName: 'create_version',
          args: {
            parent: existingFileVersion.id,
            s3Key: 'uploads/v2.txt',
            name: 'v2.txt',
            size: 250,
            contentType: 'text/plain',
          },
          userId: user.id,
        })

        expect(res.name).toBe('v2.txt')

        const updatedStack = await prisma.asset.findUnique({
          where: { id: stack.id },
          include: { children: true },
        })

        expect(updatedStack?.fileCount).toBe(2)
        expect(updatedStack?.sizeByte).toBe(350)
      })
    })
  })

  describe('generateSessionNameActivity', () => {
    it('should generate and save session name for chat sessions', async () => {
      await prisma.team.create({
        data: { id: 't1', name: 'Test Team' },
      })
      const user = await prisma.user.create({
        data: { id: 'u1', name: 'Test User', email: 'u1@test.com' },
      })
      const agentUser = await prisma.user.create({
        data: {
          id: 'agent-123',
          name: 'Chat Agent User',
          email: 'agent@shumai.ai',
          type: 'agent',
        },
      })
      const agent = await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: 't1',
          type: 'chat',
          config: { provider: 'openai', model: 'gpt-4' },
        },
      })
      await prisma.agentSession.create({
        data: {
          id: 'session-123',
          agentId: 'agent-123',
          userId: user.id,
          cwd: process.cwd(),
          type: 'chat',
          name: null,
        },
      })

      const mockHarness = {
        subscribe: vi.fn(),
        prompt: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '  "Summarized Chat Title"  ' }],
        }),
      }
      vi.mocked(piAgent.createAgentSession).mockResolvedValue({
        session: {} as unknown as Session<DatabaseSessionMetadata>,
        harness: mockHarness as unknown as AgentHarness,
      })

      await generateSessionNameActivity({
        teamId: 't1',
        agentId: 'agent-123',
        prompt: 'hello world prompt',
        sessionId: 'session-123',
        context: {
          agent: {
            ...agent,
            provider: { name: 'openai' },
            modelRef: {
              id: 'm1',
              providerName: 'openai',
              modelId: 'gpt-4',
              name: 'GPT-4',
              config: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          } as unknown as GenerateSessionNameParams['context']['agent'],
          dbProviders: [
            {
              name: 'openai',
              config: { api: 'openai-responses', apiKey: 'fake-key' },
              models: [
                {
                  modelId: 'gpt-4',
                  name: 'GPT-4',
                  config: {
                    reasoning: false,
                    input: ['text'],
                    contextWindow: 4096,
                    maxTokens: 4096,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  },
                },
              ],
            },
          ],
        },
      })

      const updatedSession = await prisma.agentSession.findUnique({
        where: { id: 'session-123' },
      })

      expect(updatedSession?.name).toBe('Summarized Chat Title')
      expect(mockHarness.prompt).toHaveBeenCalledWith('hello world prompt')

      // Verify that transient naming session was cleaned up (deleted)
      const namingSessions = await prisma.agentSession.findMany({
        where: { type: 'naming' },
      })
      expect(namingSessions).toHaveLength(0)
    })

    it('should skip name generation for comment sessions or if name is already set', async () => {
      await prisma.team.create({
        data: { id: 't1', name: 'Test Team' },
      })
      const user = await prisma.user.create({
        data: { id: 'u1', name: 'Test User', email: 'u1@test.com' },
      })
      const agentUser = await prisma.user.create({
        data: {
          id: 'agent-123',
          name: 'Chat Agent User',
          email: 'agent2@shumai.ai',
          type: 'agent',
        },
      })
      await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: 't1',
          type: 'chat',
          config: { provider: 'openai', model: 'gpt-4' },
        },
      })
      await prisma.agentSession.create({
        data: {
          id: 'session-comment',
          agentId: 'agent-123',
          userId: user.id,
          cwd: process.cwd(),
          type: 'comment',
          name: null,
        },
      })
      await prisma.agentSession.create({
        data: {
          id: 'session-named',
          agentId: 'agent-123',
          userId: user.id,
          cwd: process.cwd(),
          type: 'chat',
          name: 'Existing Name',
        },
      })

      vi.mocked(piAgent.createAgentSession).mockClear()

      await generateSessionNameActivity({
        teamId: 't1',
        agentId: 'agent-123',
        prompt: 'hello comment',
        sessionId: 'session-comment',
        context: {
          agent: {} as unknown as GenerateSessionNameParams['context']['agent'],
          dbProviders: [],
        },
      })

      await generateSessionNameActivity({
        teamId: 't1',
        agentId: 'agent-123',
        prompt: 'hello named',
        sessionId: 'session-named',
        context: {
          agent: {} as unknown as GenerateSessionNameParams['context']['agent'],
          dbProviders: [],
        },
      })

      expect(piAgent.createAgentSession).not.toHaveBeenCalled()
    })
  })

  describe('initializeAgentSessionActivity', () => {
    it('should perform lazy session creation and incremental 1:1 message entry sync', async () => {
      const team = await prisma.team.create({
        data: { id: 't-lazy-1', name: 'Lazy Team' },
      })
      const user = await prisma.user.create({
        data: { id: 'u-lazy-1', name: 'Matt', email: 'matt@test.com' },
      })
      const agentUser = await prisma.user.create({
        data: { id: 'agent-lazy-1', name: 'Ai Agent', email: 'agent@shumai.ai', type: 'agent' },
      })
      const agent = await prisma.agent.create({
        data: {
          id: agentUser.id,
          teamId: team.id,
          type: 'chat',
          config: { provider: 'openai', model: 'gpt-4' },
        },
      })
      const file = await prisma.asset.create({
        data: { name: 'file.mp4', type: 'file', status: 'processed' },
      })

      const c1 = await prisma.assetComment.create({
        data: { assetId: file.id, message: 'First comment', creatorId: user.id },
      })
      const c2 = await prisma.assetComment.create({
        data: { assetId: file.id, message: 'Second comment', creatorId: user.id },
      })
      const c3 = await prisma.assetComment.create({
        data: {
          assetId: file.id,
          message: '@agent summarize',
          creatorId: user.id,
          replyToId: c1.id,
        },
      })

      const sessionId = await initializeAgentSessionActivity({
        teamId: team.id,
        agentId: agent.id,
        userCommentId: c3.id,
      })

      expect(sessionId).toBeDefined()

      const entries = await prisma.agentSessionEntry.findMany({
        where: { sessionId },
      })

      expect(entries.length).toBeGreaterThanOrEqual(3)
      const c1Entry = entries.find((e) => e.id === c1.id) as unknown as {
        entry: { parentId: string; message: { content: Array<{ text: string }> } }
      }
      expect(c1Entry).toBeDefined()
      // c1 has a reply c3, so it should include [Comment ID: c1.id]
      expect(c1Entry.entry.message.content[0].text).toContain(`[Comment ID: ${c1.id}]`)

      const c2Entry = entries.find((e) => e.id === c2.id) as unknown as {
        entry: { parentId: string; message: { content: Array<{ text: string }> } }
      }
      expect(c2Entry).toBeDefined()
      expect(c2Entry.entry.parentId).toBe(c1.id)
      // c2 has 0 replies, so it should NOT include [Comment ID: ...]
      expect(c2Entry.entry.message.content[0].text).not.toContain('[Comment ID:')

      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
      })
      expect(session?.leafId).toBe(c1.id)
    })
  })
})
