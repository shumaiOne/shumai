import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentChat } from './agent-chat'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowUtils from '@shumai/workflow-core'
import { AgentChatPromptBuilder } from './agent-chat-prompt-builder'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
  }
})

describe('Agent Chat Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: Object.assign(vi.fn(), {
        _activityName: 'updateTaskStatusActivity',
      }),
      getCommentActivity: Object.assign(vi.fn(), { _activityName: 'getCommentActivity' }),
      createCommentActivity: Object.assign(vi.fn(), { _activityName: 'createCommentActivity' }),
      getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
      initializeAgentSessionActivity: Object.assign(vi.fn(), {
        _activityName: 'initializeAgentSessionActivity',
      }),
      getAgentChatContextActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentChatContextActivity',
      }),
      getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentWorkerQueueActivity',
      }),
      agentChatActivity: Object.assign(vi.fn(), { _activityName: 'agentChatActivity' }),
      updateCommentActivity: Object.assign(vi.fn(), { _activityName: 'updateCommentActivity' }),
      updateTaskUsageActivity: Object.assign(vi.fn(), { _activityName: 'updateTaskUsageActivity' }),
      deleteCommentActivity: Object.assign(vi.fn(), { _activityName: 'deleteCommentActivity' }),
      getAssetPathContextActivity: Object.assign(vi.fn(), {
        _activityName: 'getAssetPathContextActivity',
      }),
    }

    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      project: { teamId: 't1' },
      type: 'file',
      name: 'test-file.png',
      mediaType: 'image/png',
      parentId: 'parent-folder-id',
    })
    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'c1',
      message: 'hello agent',
      replyToId: null,
      attachments: [],
    })
    mockActivities.initializeAgentSessionActivity.mockResolvedValue('session-123')
    mockActivities.getAgentChatContextActivity.mockResolvedValue({ agent: { id: 'b1' } })
    mockActivities.getAssetPathContextActivity.mockResolvedValue('Path: folder/subfolder/file.png')
    mockActivities.agentChatActivity.mockResolvedValue({
      text: 'Hello user, how can I help you?',
      sessionId: 'session-123',
      usage: { inputTokens: 10, outputTokens: 20, model: 'gemini-model' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })
  })

  it('should run agent chat workflow successfully with default configurations', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1', explicitMention: true },
        },
      },
    })

    await agentChat(task)

    // Verify queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).toHaveBeenCalled()

    // Verify task status processing
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify comment context fetched
    expect(mockActivities.getCommentActivity).toHaveBeenCalledWith('c1')

    // Verify placeholder comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: '__CHAT__',
      sessionId: 'pending',
      agentId: 'b1',
      replyToId: 'c1',
    })

    // Verify session initialized since sessionId was missing
    expect(mockActivities.initializeAgentSessionActivity).toHaveBeenCalledWith({
      teamId: 't1',
      agentId: 'b1',
      userCommentId: 'c1',
      userId: undefined,
    })

    // Verify agent instruction composition
    const expectedInstruction1 = new AgentChatPromptBuilder('a1')
      .withPathContext('Path: folder/subfolder/file.png')
      .withAssetDetails('test-file.png', 'image/png', undefined)
      .withCommentTimestamp(null)
      .withExplicitMention(true)
      .build()

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 't1',
        agentId: 'b1',
        message: 'hello agent',
        agentsInstruction: expectedInstruction1,
        sessionId: 'session-123',
        folderId: 'parent-folder-id',
      }),
    )

    // Verify comment update
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Hello user, how can I help you?',
      sessionId: 'session-123',
    })

    // Verify task usage update
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 10,
      outputTokens: 20,
      model: 'gemini-model',
    })

    // Verify task completed status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
      output: { sessionId: 'session-123' },
    })
  })

  it('should skip session initialization if sessionId is already provided', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1', sessionId: 'existing-session-456' },
        },
      },
    })

    await agentChat(task)

    expect(mockActivities.initializeAgentSessionActivity).not.toHaveBeenCalled()
    const expectedInstruction2 = new AgentChatPromptBuilder('a1')
      .withPathContext('Path: folder/subfolder/file.png')
      .withAssetDetails('test-file.png', 'image/png', undefined)
      .withCommentTimestamp(null)
      .withExplicitMention(false)
      .build()

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'existing-session-456',
        agentsInstruction: expectedInstruction2,
      }),
    )
  })

  it('should delete placeholder comment and finish when AI responds with __NO_REPLY__', async () => {
    mockActivities.agentChatActivity.mockResolvedValue({
      text: '__NO_REPLY__',
      sessionId: 'session-123',
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1', explicitMention: false },
        },
      },
    })

    await agentChat(task)

    // Verify instruction contains not explicitly mentioned instructions
    const expectedInstruction3 = new AgentChatPromptBuilder('a1')
      .withPathContext('Path: folder/subfolder/file.png')
      .withAssetDetails('test-file.png', 'image/png', undefined)
      .withCommentTimestamp(null)
      .withExplicitMention(false)
      .build()

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        agentsInstruction: expectedInstruction3,
      }),
    )

    // Verify placeholder comment is deleted
    expect(mockActivities.deleteCommentActivity).toHaveBeenCalledWith('comment-placeholder-id')
    expect(mockActivities.updateCommentActivity).not.toHaveBeenCalled()

    // Verify task still completes successfully
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
      output: { sessionId: 'session-123' },
    })
  })

  it('should collect S3 keys for image attachments from the user comment', async () => {
    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'c1',
      message: 'look at this',
      replyToId: null,
      attachments: [
        {
          asset: {
            mediaType: 'image/png',
            storageKey: { key: 'attachments/image1.png' },
          },
        },
        {
          asset: {
            mediaType: 'video/mp4', // non-image, should be ignored
            storageKey: { key: 'attachments/video.mp4' },
          },
        },
        {
          asset: {
            mediaType: 'image/jpeg',
            storageKey: { key: 'attachments/image2.jpg' },
          },
        },
      ],
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await agentChat(task)

    const expectedInstruction4 = new AgentChatPromptBuilder('a1')
      .withPathContext('Path: folder/subfolder/file.png')
      .withAssetDetails('test-file.png', 'image/png', undefined)
      .withCommentTimestamp(null)
      .withExplicitMention(false)
      .build()

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrls: ['attachments/image1.png', 'attachments/image2.jpg'],
        agentsInstruction: expectedInstruction4,
      }),
    )
  })

  it('should format instructions with asset media info when available', async () => {
    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'a1',
      project: { teamId: 't1' },
      type: 'file',
      name: 'test-asset',
      mediaType: 'video/mp4',
      media: {
        duration: 10,
        height: 1080,
        width: 1920,
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await agentChat(task)

    const expectedInstruction5 = new AgentChatPromptBuilder('a1')
      .withPathContext('Path: folder/subfolder/file.png')
      .withAssetDetails('test-asset', 'video/mp4', 10)
      .withCommentTimestamp(null)
      .withExplicitMention(false)
      .build()

    expect(mockActivities.agentChatActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        agentsInstruction: expectedInstruction5,
      }),
    )
  })

  it('should handle errors gracefully by updating the placeholder comment with error message and marking task as failed', async () => {
    mockActivities.agentChatActivity.mockRejectedValue(new Error('AI error: API limit reached'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await expect(agentChat(task)).rejects.toThrow('AI error: API limit reached')

    // Verify placeholder updated with formatted error message
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'AI error:  API limit reached',
    })

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'AI error: API limit reached' },
    })
  })

  it('should handle generic errors in error handling block', async () => {
    mockActivities.agentChatActivity.mockRejectedValue(new Error('Some DB connection error'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agent: { userCommentId: 'c1', agentId: 'b1' },
        },
      },
    })

    await expect(agentChat(task)).rejects.toThrow('Some DB connection error')

    // Verify placeholder updated with generic error message
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Sorry, I encountered an error while processing your request.',
    })
  })
})
