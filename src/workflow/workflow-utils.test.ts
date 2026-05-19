import { describe, it, expect, vi, beforeAll } from 'vitest'
import { getActivities, executeActivity } from './workflow-utils'

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
})
