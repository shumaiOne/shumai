import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentEmbeddingMedia } from './agent-embedding'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import * as workflowUtils from '@/workflow/workflow-utils'

vi.mock('@/workflow/workflow-utils', async () => {
  const actual = await vi.importActual('@/workflow/workflow-utils')
  return {
    ...actual,
    getActivities: vi.fn(),
    executeActivity: vi.fn(),
  }
})

describe('Agent Embedding Workflow', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run agent embedding workflow successfully', async () => {
    const mockActivities = {
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

    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getEmbeddingContextActivity.mockResolvedValue({ agent: { id: 'b1' }, asset: { id: 'a1' }, dbProvider: { name: 'google' } })
    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
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

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_embedding',
        status: 'pending',
        assetId: 'a1',
        teamId: 't1',
      },
    })

    await agentEmbeddingMedia(task)

    expect(mockActivities.getEmbeddingContextActivity).toHaveBeenCalled()
    expect(mockActivities.generateEmbeddingActivity).toHaveBeenCalled()
    expect(mockActivities.saveAssetEmbeddingsActivity).toHaveBeenCalled()
  })
})
