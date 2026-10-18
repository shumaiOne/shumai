import { describe, it, expect, vi } from 'vitest'
import { DBOS, Error as DBOSError } from '@dbos-inc/dbos-sdk'
import {
  defineStep,
  WorkflowFailure,
  ApplicationFailure,
  isNonRetryableError,
  isDbosWorkflowCancelledError,
  sleep,
  getLocalTaskAbortSignal,
  registerLocalTaskAbortController,
  unregisterLocalTaskAbortController,
} from './workflow-utils'

describe('workflow-utils defineStep and DBOS steps', () => {
  it('should preserve function name by default or use custom name', () => {
    async function sampleActivity(arg: string) {
      return `result-${arg}`
    }
    const step1 = defineStep(sampleActivity)
    expect(step1.name).toBe('sampleActivity')

    const step2 = defineStep(async () => 'ok', { name: 'customName' })
    expect(step2.name).toBe('customName')
  })

  it('should execute the function directly when outside DBOS workflow context', async () => {
    const mockFn = vi.fn().mockResolvedValue('success-result')
    const step = defineStep(mockFn, { name: 'mockStep' })

    const result = await step({ some: 'args' })

    expect(mockFn).toHaveBeenCalledWith({ some: 'args' })
    expect(result).toBe('success-result')
  })

  it('should execute via DBOS.runStep when within workflow context', async () => {
    const mockFn = vi.fn().mockResolvedValue('step-success')
    const step = defineStep(mockFn, { name: 'myStepActivity' })

    const isWithinWorkflowSpy = vi.spyOn(DBOS, 'isWithinWorkflow').mockReturnValue(true)
    const runStepSpy = vi
      .spyOn(DBOS, 'runStep')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(async (fn: () => unknown) => fn() as any)

    const result = await step('step-arg')

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

  it('should execute cleanup fallback if cancelled with DBOSWorkflowCancelledError and runOnCancel is true', async () => {
    const mockFn = vi.fn().mockResolvedValue('cleanup-done')
    const step = defineStep(mockFn, { name: 'cleanupStep', runOnCancel: true })

    // SDK's real DBOSWorkflowCancelledError does not set err.name (err.name is 'Error')
    const realCancelErr = new DBOSError.DBOSWorkflowCancelledError('test-workflow-id')
    expect(realCancelErr.name).toBe('Error')

    const isWithinWorkflowSpy = vi.spyOn(DBOS, 'isWithinWorkflow').mockReturnValue(true)
    const runStepSpy = vi.spyOn(DBOS, 'runStep').mockRejectedValue(realCancelErr)

    const result = await step('arg')

    expect(result).toBe('cleanup-done')
    expect(mockFn).toHaveBeenCalledWith('arg')

    isWithinWorkflowSpy.mockRestore()
    runStepSpy.mockRestore()
  })

  it('should correctly identify DBOS workflow cancellation errors', () => {
    const realCancelErr = new DBOSError.DBOSWorkflowCancelledError('wf-1')
    expect(isDbosWorkflowCancelledError(realCancelErr)).toBe(true)

    const duckTypedErr = { name: 'DBOSWorkflowCancelledError' }
    expect(isDbosWorkflowCancelledError(duckTypedErr)).toBe(true)

    const codeErr = { dbosErrorCode: 24 }
    expect(isDbosWorkflowCancelledError(codeErr)).toBe(true)

    expect(isDbosWorkflowCancelledError(new Error('other error'))).toBe(false)
    expect(isDbosWorkflowCancelledError(null)).toBe(false)
    expect(isDbosWorkflowCancelledError(undefined)).toBe(false)
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
