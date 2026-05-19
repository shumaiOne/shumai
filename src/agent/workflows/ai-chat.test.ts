import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aiChat } from './ai-chat'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@/generated/prisma/client'
import * as workflowUtils from '@/workflow/workflow-utils'

vi.mock('@/workflow/workflow-utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
  }
})

describe('AIChat Workflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    getAssetActivity: Object.assign(vi.fn(), { _activityName: 'getAssetActivity' }),
    getCommentActivity: Object.assign(vi.fn(), { _activityName: 'getCommentActivity' }),
    extractAiMetadataActivity: Object.assign(vi.fn(), {
      _activityName: 'extractAiMetadataActivity',
    }),
    aiChatActivity: Object.assign(vi.fn(), { _activityName: 'aiChatActivity' }),
    createCommentActivity: Object.assign(vi.fn(), { _activityName: 'createCommentActivity' }),
    updateCommentActivity: Object.assign(vi.fn(), { _activityName: 'updateCommentActivity' }),
    updateTaskUsageActivity: Object.assign(vi.fn(), { _activityName: 'updateTaskUsageActivity' }),
    getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
      _activityName: 'getAgentWorkerQueueActivity',
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(workflowUtils.getActivities as any).mockReturnValue(mockActivities)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(workflowUtils.executeActivity as any).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_queue: string, fn: any, ...args: any[]) => {
        if (typeof fn !== 'function') {
          throw new Error(`fn is not a function in executeActivity. Queue: ${_queue}`)
        }
        return fn(...args)
      },
    )
    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_worker_queue')
  })

  it('should process AI chat successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-1',
      assetId: 'asset-1',
      type: WorkflowTaskType.chat,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        userCommentId: 'comment-1',
        agentId: 'bot-1',
        projectId: 'proj-1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-1',
      key: 'test.png',
      mediaType: 'image/png',
      project: { teamId: 'team-1', id: 'proj-1' },
    })

    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'comment-1',
      message: 'Hello AI',
    })

    mockActivities.createCommentActivity.mockResolvedValue({
      id: 'placeholder-1',
    })

    mockActivities.aiChatActivity.mockResolvedValue({
      text: 'Hello Human',
      usage: { inputTokens: 10, outputTokens: 20, model: 'gpt-4' },
    })

    await aiChat(task)

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.processing,
    })

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      message: '__CHAT__',
      isAi: true,
      agentId: 'bot-1',
      replyToId: 'comment-1',
    })

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'placeholder-1',
      message: 'Hello Human',
    })

    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      inputTokens: 10,
      outputTokens: 20,
      model: 'gpt-4',
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.completed,
      output: { sessionId: undefined },
    })
  })

  it('should attach AI response to thread root if triggering comment is a reply', async () => {
    const task: WorkflowTask = {
      id: 'task-nested',
      assetId: 'asset-1',
      type: WorkflowTaskType.chat,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        userCommentId: 'reply-1',
        agentId: 'bot-1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid-nested',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.getAssetActivity.mockResolvedValue({
      id: 'asset-1',
      project: { teamId: 'team-1', id: 'proj-1' },
    })

    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'reply-1',
      replyToId: 'root-comment-id',
      message: 'Nested reply message',
    })

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-nested' })

    mockActivities.aiChatActivity.mockResolvedValue({
      text: 'AI response to root',
    })

    await aiChat(task)

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      message: '__CHAT__',
      isAi: true,
      agentId: 'bot-1',
      replyToId: 'root-comment-id', // MUST be root, not reply-1
    })
  })

  it('should handle failures and update placeholder with error', async () => {
    const task: WorkflowTask = {
      id: 'task-fail',
      assetId: 'asset-1',
      type: WorkflowTaskType.chat,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {
        userCommentId: 'comment-1',
        agentId: 'bot-1',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      teamId: 'team-1',
      projectId: 'proj-1',
      uid: 'task-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.createCommentActivity.mockResolvedValue({
      id: 'placeholder-err',
    })

    mockActivities.getAssetActivity.mockRejectedValue(new Error('DB Down'))

    await expect(aiChat(task)).rejects.toThrow('DB Down')

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'placeholder-err',
      message: expect.stringContaining('error'),
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-fail',
      status: WorkflowTaskStatus.failed,
      output: { error: 'DB Down' },
    })
  })
})
