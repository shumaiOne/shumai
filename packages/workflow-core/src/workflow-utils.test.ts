import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import * as wf from '@temporalio/workflow'
import { getActivities, executeActivity } from './workflow-utils'

const mockWorkflowInfo = vi.fn().mockImplementation(() => {
  throw new Error('Not in workflow context')
})
const mockProxyActivities = vi.fn()

vi.mock('@temporalio/workflow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@temporalio/workflow')>()
  return {
    ...actual,
    workflowInfo: () => mockWorkflowInfo(),
    proxyActivities: (...args: unknown[]) => mockProxyActivities(...args),
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('workflow-utils executeActivity', () => {
  beforeAll(() => {
    // Inject mock activities for local execution tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__localActivities = {
      updateTaskStatusActivity: vi.fn(),
    }
  })

  it('should attach _activityName to proxy functions from getActivities', () => {
    const { updateTaskStatusActivity } = getActivities()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((updateTaskStatusActivity as any)._activityName).toBe('updateTaskStatusActivity')
  })

  it('should execute the function and pass arguments in local mode', async () => {
    const mockFn = vi.fn().mockResolvedValue('success-result')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockFn as any)._activityName = 'mockActivity'

    const result = await executeActivity(
      'test-queue',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFn as any,
      { some: 'args' },
    )

    expect(mockFn).toHaveBeenCalledWith({ some: 'args' })
    expect(result).toBe('success-result')
  })

  it('should throw error if function does not have _activityName', async () => {
    const normalFn = async () => {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(executeActivity('queue', normalFn as any)).rejects.toThrow(
      'executeActivity must be called with an activity function obtained from getActivities()',
    )
  })

  describe('Temporal mode', () => {
    beforeAll(() => {
      // Mock workflowInfo to simulate running in Temporal by returning a fake object
      mockWorkflowInfo.mockReturnValue({} as unknown as wf.WorkflowInfo)
    })

    afterAll(() => {
      mockWorkflowInfo.mockImplementation(() => {
        throw new Error('Not in workflow context')
      })
      vi.restoreAllMocks()
    })

    it('should configure proxyActivities with retry options', async () => {
      mockProxyActivities.mockReturnValue({
        mockActivity: vi.fn().mockResolvedValue('temporal-success'),
      })

      const { mockActivity } = getActivities()
      const result = await executeActivity('test-queue', mockActivity, 'arg1')

      expect(mockProxyActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          retry: {
            maximumAttempts: 5,
            initialInterval: '10s',
          },
        }),
      )
      expect(result).toBe('temporal-success')
    })
  })
})
