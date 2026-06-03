import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryEmbeddingForSearch } from './query-embedding-for-search'
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

describe('Query Embedding For Search Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateWorkflowTaskActivity: Object.assign(vi.fn(), {
        _activityName: 'updateWorkflowTaskActivity',
      }),
      generateTextEmbeddingActivity: Object.assign(vi.fn(), {
        _activityName: 'generateTextEmbeddingActivity',
      }),
      getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentWorkerQueueActivity',
      }),
    }

    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.updateWorkflowTaskActivity.mockResolvedValue({})
    mockActivities.generateTextEmbeddingActivity.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      usage: { inputTokens: 4, outputTokens: 0, model: 'gemini-embedding-2' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })
  })

  it('should run query embedding workflow successfully', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'query_embedding_for_search',
        status: 'pending',
        teamId: 't1',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          queryEmbeddingForSearch: {
            text: 'search query',
          },
        },
      },
    })

    await queryEmbeddingForSearch(task)

    // Verify queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).toHaveBeenCalled()

    // Verify task processing status
    expect(mockActivities.updateWorkflowTaskActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
      heartbeat: true,
    })

    // Verify embedding generation
    expect(mockActivities.generateTextEmbeddingActivity).toHaveBeenCalledWith({
      text: 'search query',
      teamId: 't1',
    })

    // Verify completed status and details
    expect(mockActivities.updateWorkflowTaskActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
      output: { embedding: [0.1, 0.2, 0.3] },
      inputTokens: 4,
      outputTokens: 0,
      model: 'gemini-embedding-2',
    })
  })

  it('should throw immediately if text is missing', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'query_embedding_for_search',
        status: 'pending',
        teamId: 't1',
        assetId: 'a1',
      },
    })

    await expect(queryEmbeddingForSearch(task)).rejects.toThrow(
      'Missing text in query_embedding_for_search task payload',
    )

    // Should not call any activities because it throws before queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).not.toHaveBeenCalled()
    expect(mockActivities.updateWorkflowTaskActivity).not.toHaveBeenCalled()
  })

  it('should handle activity failure and update task status to failed', async () => {
    mockActivities.generateTextEmbeddingActivity.mockRejectedValue(
      new Error('Embedding API failed'),
    )

    const task = await prisma.workflowTask.create({
      data: {
        type: 'query_embedding_for_search',
        status: 'pending',
        teamId: 't1',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          queryEmbeddingForSearch: {
            text: 'search query',
          },
        },
      },
    })

    await expect(queryEmbeddingForSearch(task)).rejects.toThrow('Embedding API failed')

    // Verify it updates task to failed
    expect(mockActivities.updateWorkflowTaskActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'Embedding API failed' },
    })
  })
})
