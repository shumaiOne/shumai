import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aiEmbeddingMedia } from './ai-embedding'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@/generated/prisma/client'
import * as workflowUtils from '../workflow-utils'

vi.mock('../workflow-utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
    sleep: vi.fn(),
  }
})

describe('AIEmbedding Workflow', () => {
  const mockActivities = {
    updateTaskStatusActivity: Object.assign(vi.fn(), {
      _activityName: 'updateTaskStatusActivity',
    }),
    generateEmbeddingActivity: Object.assign(vi.fn(), {
      _activityName: 'generateEmbeddingActivity',
    }),
    updateTaskUsageActivity: Object.assign(vi.fn(), { _activityName: 'updateTaskUsageActivity' }),
    createCommentActivity: Object.assign(vi.fn(), { _activityName: 'createCommentActivity' }),
    updateCommentActivity: Object.assign(vi.fn(), { _activityName: 'updateCommentActivity' }),
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

  it('should generate embeddings successfully', async () => {
    const task: WorkflowTask = {
      id: 'task-1',
      assetId: 'asset-1',
      teamId: 'team-1',
      type: WorkflowTaskType.ai_embedding,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      projectId: 'proj-1',
      uid: 'task-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-1' })
    mockActivities.generateEmbeddingActivity.mockResolvedValue({
      inputTokens: 5,
      outputTokens: 5,
      model: 'clip',
    })

    await aiEmbeddingMedia(task)

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      message: '__EMBEDDING__',
      isAi: true,
      agentId: 'default',
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.processing,
    })

    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      inputTokens: 5,
      outputTokens: 5,
      model: 'clip',
    })

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'placeholder-1',
      message: expect.stringContaining('successfully'),
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: WorkflowTaskStatus.completed,
    })
  })

  it('should use agentId from payload if provided', async () => {
    const task: WorkflowTask = {
      id: 'task-1',
      assetId: 'asset-1',
      type: WorkflowTaskType.ai_embedding,
      status: WorkflowTaskStatus.pending,
      teamId: 'team-1',
      output: null,
      payload: { agentId: 'real-agent-id' },
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      projectId: 'proj-1',
      uid: 'task-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-1' })
    mockActivities.generateEmbeddingActivity.mockResolvedValue({
      inputTokens: 5,
      outputTokens: 5,
      model: 'clip',
    })

    await aiEmbeddingMedia(task)

    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'asset-1',
      message: '__EMBEDDING__',
      isAi: true,
      agentId: 'real-agent-id',
    })
  })

  it('should handle failures and update task status with error', async () => {
    const task: WorkflowTask = {
      id: 'task-fail',
      assetId: 'asset-1',
      teamId: 'team-1',
      type: WorkflowTaskType.ai_embedding,
      status: WorkflowTaskStatus.pending,
      output: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      heartbeat: null,
      projectId: 'proj-1',
      uid: 'task-uid',
      model: null,
      inputTokens: 0,
      outputTokens: 0,
    }

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'placeholder-err' })
    mockActivities.generateEmbeddingActivity.mockRejectedValue(new Error('Embedding error'))

    await expect(aiEmbeddingMedia(task)).rejects.toThrow('Embedding error')

    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'placeholder-err',
      message: expect.stringContaining('failed'),
    })

    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: 'task-fail',
      status: WorkflowTaskStatus.failed,
      output: { error: 'Embedding error' },
    })
  })
})
