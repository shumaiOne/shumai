import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentChat } from './agent-chat'
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

describe('Agent Chat Workflow', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run agent chat workflow successfully', async () => {
    const mockActivities = {
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
    }

    mockActivities.getCommentActivity.mockResolvedValue({
      id: 'c1',
      message: 'hello',
      replyToId: null,
    })
    mockActivities.createCommentActivity.mockResolvedValue({ id: 'comment-placeholder-id' })
    mockActivities.getAssetActivity.mockResolvedValue({ id: 'a1', project: { teamId: 't1' } })
    mockActivities.initializeAgentSessionActivity.mockResolvedValue('session-123')
    mockActivities.getAgentChatContextActivity.mockResolvedValue({ agent: { id: 'b1' } })
    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.agentChatActivity.mockResolvedValue({
      text: 'arr matey!',
      sessionId: 'session-123',
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

    expect(mockActivities.getAgentChatContextActivity).toHaveBeenCalled()
    expect(mockActivities.agentChatActivity).toHaveBeenCalled()
  })
})
