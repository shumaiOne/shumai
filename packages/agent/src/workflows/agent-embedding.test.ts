import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentEmbeddingMedia } from './agent-embedding'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import * as workflowUtils from '@shumai/workflow-core'

vi.mock('@shumai/workflow-core', async () => {
  const actual = await vi.importActual('@shumai/workflow-core')
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
  }
})

describe('Agent Embedding Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: Object.assign(vi.fn(), {
        _activityName: 'updateTaskStatusActivity',
      }),
      getEmbeddingContextActivity: Object.assign(vi.fn(), {
        _activityName: 'getEmbeddingContextActivity',
      }),
      generateEmbeddingActivity: Object.assign(vi.fn(), {
        _activityName: 'generateEmbeddingActivity',
      }),
      saveAssetEmbeddingsActivity: Object.assign(vi.fn(), {
        _activityName: 'saveAssetEmbeddingsActivity',
      }),
      updateTaskUsageActivity: Object.assign(vi.fn(), { _activityName: 'updateTaskUsageActivity' }),
      createCommentActivity: Object.assign(vi.fn(), { _activityName: 'createCommentActivity' }),
      updateCommentActivity: Object.assign(vi.fn(), { _activityName: 'updateCommentActivity' }),
      getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentWorkerQueueActivity',
      }),
    }

    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({
      agent: { id: 'b1' },
      asset: { id: 'a1' },
      dbProvider: { name: 'google' },
    })
    mockActivities.generateEmbeddingActivity.mockResolvedValue({
      embeddings: [{ embedding: [0.1, 0.2] }],
      usage: { inputTokens: 5, outputTokens: 5, model: 'gpt' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })
  })

  it('should run agent embedding workflow successfully', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
        payload: {
          projectId: 'p1',
          agent: { sessionId: 's1', agentId: 'agent-1' },
        },
      },
    })

    await agentEmbeddingMedia(task)

    // Verify queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).toHaveBeenCalled()

    // Verify task processing status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify placeholder comment created
    expect(mockActivities.createCommentActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      message: '__EMBEDDING__',
      sessionId: 's1',
      agentId: 'agent-1',
    })

    // Verify context fetching
    expect(mockActivities.getEmbeddingContextActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetId: 'a1',
    })

    // Verify embedding generation
    expect(mockActivities.generateEmbeddingActivity).toHaveBeenCalledWith({
      teamId: 't1',
      assetId: 'a1',
      context: {
        agent: { id: 'b1' },
        asset: { id: 'a1' },
        dbProvider: { name: 'google' },
      },
    })

    // Verify embeddings saved
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalledWith({
      assetId: 'a1',
      embeddings: [{ embedding: [0.1, 0.2] }],
    })

    // Verify usage update
    expect(mockActivities.updateTaskUsageActivity).toHaveBeenCalledWith({
      taskId: task.id,
      inputTokens: 5,
      outputTokens: 5,
      model: 'gpt',
    })

    // Verify placeholder comment updated
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Embedding completed successfully.',
    })

    // Verify completed task status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should throw if task has no teamId', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow('Task has no teamId')

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'Task has no teamId' },
    })
  })

  it('should skip saving embeddings if none are returned', async () => {
    mockActivities.generateEmbeddingActivity.mockResolvedValue({
      embeddings: [],
      usage: null,
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    expect(mockActivities.saveAssetEmbeddingsActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateTaskUsageActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
    })
  })

  it('should handle failures, update placeholder with error, and set status to failed', async () => {
    mockActivities.generateEmbeddingActivity.mockRejectedValue(new Error('AI Service Unavailable'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await expect(agentEmbeddingMedia(task)).rejects.toThrow('AI Service Unavailable')

    // Verify placeholder updated with error
    expect(mockActivities.updateCommentActivity).toHaveBeenCalledWith({
      commentId: 'comment-placeholder-id',
      message: 'Embedding failed: AI Service Unavailable',
    })

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'AI Service Unavailable' },
    })
  })
})
