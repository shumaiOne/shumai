import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentToolCall } from './agent-tool-call'
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

describe('Agent Tool Call Workflow', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities holds mock functions cast to expected types
  let mockActivities: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockActivities = {
      updateTaskStatusActivity: Object.assign(vi.fn(), {
        _activityName: 'updateTaskStatusActivity',
      }),
      executeAgentToolActivity: Object.assign(vi.fn(), {
        _activityName: 'executeAgentToolActivity',
      }),
      getAgentWorkerQueueActivity: Object.assign(vi.fn(), {
        _activityName: 'getAgentWorkerQueueActivity',
      }),
    }

    mockActivities.getAgentWorkerQueueActivity.mockResolvedValue('agent_queue')
    mockActivities.updateTaskStatusActivity.mockResolvedValue({})
    mockActivities.executeAgentToolActivity.mockResolvedValue({ success: true, count: 42 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mockActivities contains vi.fn mock functions which are cast to expected activity proxy types
    vi.mocked(workflowUtils.getActivities).mockReturnValue(mockActivities as any)
    vi.mocked(workflowUtils.executeActivity).mockImplementation(async (_queue, act, ...args) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- act is one of the mocked activities
      return (act as any)(...args)
    })
  })

  it('should run agent tool call workflow successfully', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'agent_tool_call',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agentToolCall: {
            toolName: 'list_assets',
            args: { parent: 'folder-123' },
            userId: 'user-456',
          },
        },
      },
    })

    await agentToolCall(task)

    // Verify queue discovery
    expect(mockActivities.getAgentWorkerQueueActivity).toHaveBeenCalled()

    // Verify task processing status
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'processing',
    })

    // Verify tool execution
    expect(mockActivities.executeAgentToolActivity).toHaveBeenCalledWith({
      taskId: task.id,
      toolName: 'list_assets',
      args: { parent: 'folder-123' },
      userId: 'user-456',
    })

    // Verify task completed status with output
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'completed',
      output: { success: true, count: 42 },
    })
  })

  it('should throw if payload or agentToolCall is missing', async () => {
    const task = await prisma.workflowTask.create({
      data: {
        type: 'agent_tool_call',
        status: 'pending',
        assetId: 'a1',
      },
    })

    await expect(agentToolCall(task)).rejects.toThrow('Task payload or agentToolCall is missing')

    // Verify status updated to failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'Task payload or agentToolCall is missing' },
    })
  })

  it('should handle tool execution failures by updating task to failed and throwing', async () => {
    mockActivities.executeAgentToolActivity.mockRejectedValue(new Error('Authz failure'))

    const task = await prisma.workflowTask.create({
      data: {
        type: 'agent_tool_call',
        status: 'pending',
        assetId: 'a1',
        payload: {
          projectId: 'p1',
          agentToolCall: {
            toolName: 'create_folder',
            args: { parent: 'folder-123', name: 'new-folder' },
            userId: 'user-456',
          },
        },
      },
    })

    await expect(agentToolCall(task)).rejects.toThrow('Authz failure')

    // Verify task status failed
    expect(mockActivities.updateTaskStatusActivity).toHaveBeenCalledWith({
      taskId: task.id,
      status: 'failed',
      output: { error: 'Authz failure' },
    })
  })
})
