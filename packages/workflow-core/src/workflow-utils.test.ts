import { describe, it, expect, vi, beforeAll } from 'vitest'
import { DBOS } from '@dbos-inc/dbos-sdk'
import {
  getActivities,
  executeActivity,
  WorkflowFailure,
  ApplicationFailure,
  isNonRetryableError,
  sleep,
  getLocalTaskAbortSignal,
  registerLocalTaskAbortController,
  unregisterLocalTaskAbortController,
} from './workflow-utils'

describe('workflow-utils executeActivity and DBOS steps', () => {
  beforeAll(() => {
    // Inject mock activities for execution tests
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

  it('should execute the function directly when outside DBOS workflow context', async () => {
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

  it('should execute via DBOS.runStep when within workflow context', async () => {
    const mockFn = vi.fn().mockResolvedValue('step-success')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockFn as any)._activityName = 'myStepActivity'

    const isWithinWorkflowSpy = vi.spyOn(DBOS, 'isWithinWorkflow').mockReturnValue(true)
    const runStepSpy = vi
      .spyOn(DBOS, 'runStep')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(async (fn: () => unknown) => fn() as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeActivity('test-queue', mockFn as any, 'step-arg')

    expect(runStepSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        name: 'myStepActivity',
        retriesAllowed: true,
        shouldRetry: expect.any(Function),
      }),
    )
    expect(result).toBe('step-success')

    isWithinWorkflowSpy.mockRestore()
    runStepSpy.mockRestore()
  })

  describe('WorkflowFailure / ApplicationFailure', () => {
    it('should correctly configure nonRetryable errors', () => {
      const err = WorkflowFailure.create({ message: 'fatal error', nonRetryable: true })
      expect(err.message).toBe('fatal error')
      expect(err.nonRetryable).toBe(true)
      expect(isNonRetryableError(err)).toBe(true)

      const appErr = ApplicationFailure.create({ message: 'fatal app error', nonRetryable: true })
      expect(appErr.nonRetryable).toBe(true)
      expect(isNonRetryableError(appErr)).toBe(true)

      const retryableErr = ApplicationFailure.create({ message: 'transient', nonRetryable: false })
      expect(retryableErr.nonRetryable).toBe(false)
      expect(isNonRetryableError(retryableErr)).toBe(false)

      expect(isNonRetryableError(new Error('generic'))).toBe(false)
    })
  })

  describe('sleep and abort signals', () => {
    it('should call DBOS.sleepms when within workflow', async () => {
      const isWithinWorkflowSpy = vi.spyOn(DBOS, 'isWithinWorkflow').mockReturnValue(true)
      const sleepmsSpy = vi.spyOn(DBOS, 'sleepms').mockResolvedValue()

      await sleep(100)
      expect(sleepmsSpy).toHaveBeenCalledWith(100)

      isWithinWorkflowSpy.mockRestore()
      sleepmsSpy.mockRestore()
    })

    it('should resolve abort signals registered for a taskId', () => {
      const controller = new AbortController()
      registerLocalTaskAbortController('task-123', controller)

      const signal = getLocalTaskAbortSignal('task-123')
      expect(signal).toBe(controller.signal)

      unregisterLocalTaskAbortController('task-123')
      expect(getLocalTaskAbortSignal('task-123')).toBeUndefined()
    })
  })
})
