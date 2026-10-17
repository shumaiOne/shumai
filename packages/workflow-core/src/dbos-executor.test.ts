import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DbosExecutor, getDbosDatabaseUrl, getQueueForTaskType } from './dbos-executor'
import { TaskQueueAgent, TaskQueueTranscode } from './workflow-utils'
import { WorkflowTaskStatus, WorkflowTaskType, WorkflowTask } from '@shumai/db'
import { DBOS } from '@dbos-inc/dbos-sdk'

let activeExecutor: DbosExecutor | null = null

const stepFn = DBOS.registerStep(
  async () => {
    const mockTask = {
      id: 'task-from-step',
      type: WorkflowTaskType.chat,
      status: WorkflowTaskStatus.pending,
    } as WorkflowTask
    return await activeExecutor!.submit(mockTask)
  },
  { name: 'testStepSubmittingTask' },
)

const wf = DBOS.registerWorkflow(
  async () => {
    return await stepFn()
  },
  { name: 'testWfRunningStep' },
)

describe('DbosExecutor Tests', () => {
  let executor: DbosExecutor

  beforeEach(() => {
    vi.clearAllMocks()
    executor = new DbosExecutor()
  })

  afterEach(async () => {
    await executor.shutdown()
  })

  describe('Queue and URL resolution', () => {
    it('should map task types to proper queues', () => {
      expect(getQueueForTaskType(WorkflowTaskType.transcode)).toBe(TaskQueueTranscode)
      expect(getQueueForTaskType(WorkflowTaskType.transcode_video)).toBe(TaskQueueTranscode)
      expect(getQueueForTaskType(WorkflowTaskType.transcode_image)).toBe(TaskQueueTranscode)
      expect(getQueueForTaskType(WorkflowTaskType.ai_embedding)).toBe(TaskQueueAgent)
      expect(getQueueForTaskType(WorkflowTaskType.chat)).toBe(TaskQueueAgent)
      expect(getQueueForTaskType('unknown_type')).toBe(TaskQueueAgent)
    })

    it('should sanitize query parameters for dbos database url', () => {
      const sanitized = getDbosDatabaseUrl(
        'postgresql://user:pass@localhost:5432/shumai?schema=public&search_path=public',
      )
      expect(sanitized).toBe('postgresql://user:pass@localhost:5432/shumai')
    })
  })

  describe('Concurrency Configuration', () => {
    let originalTranscode: string | undefined
    let originalAgent: string | undefined

    beforeEach(() => {
      originalTranscode = process.env.CONCURRENCY_TRANSCODE
      originalAgent = process.env.CONCURRENCY_AGENT
    })

    afterEach(() => {
      if (originalTranscode === undefined) {
        delete process.env.CONCURRENCY_TRANSCODE
      } else {
        process.env.CONCURRENCY_TRANSCODE = originalTranscode
      }

      if (originalAgent === undefined) {
        delete process.env.CONCURRENCY_AGENT
      } else {
        process.env.CONCURRENCY_AGENT = originalAgent
      }
    })

    it('should initialize with values from environment variables', () => {
      process.env.CONCURRENCY_TRANSCODE = '3'
      process.env.CONCURRENCY_AGENT = '7'

      expect(executor.getTranscodeConcurrencyLimit()).toBe(3)
      expect(executor.getAgentConcurrencyLimit()).toBe(7)
    })

    it('should fallback to defaults when environment variables are not set or invalid', () => {
      delete process.env.CONCURRENCY_TRANSCODE
      delete process.env.CONCURRENCY_AGENT

      expect(executor.getTranscodeConcurrencyLimit()).toBe(1)
      expect(executor.getAgentConcurrencyLimit()).toBe(5)

      process.env.CONCURRENCY_TRANSCODE = 'invalid'
      process.env.CONCURRENCY_AGENT = '-1'

      expect(executor.getTranscodeConcurrencyLimit()).toBe(1)
      expect(executor.getAgentConcurrencyLimit()).toBe(5)
    })
  })

  describe('Cancellation', () => {
    it('should trigger local cancellation and abort signal', async () => {
      const {
        registerLocalCancelHandler,
        unregisterLocalCancelHandler,
        getLocalTaskAbortSignal,
        runInLocalTaskContext,
      } = await import('./workflow-utils')

      const cancelSpy = vi.fn()
      const taskId = 'task-cancel-dbos-test'
      const abortController = new AbortController()

      registerLocalCancelHandler(taskId, cancelSpy)

      await runInLocalTaskContext({ taskId, abortController }, async () => {
        const signal = getLocalTaskAbortSignal(taskId)
        expect(signal?.aborted).toBe(false)

        await executor.cancel(taskId)

        expect(cancelSpy).toHaveBeenCalled()
        expect(signal?.aborted).toBe(true)
      })

      unregisterLocalCancelHandler(taskId)
    })

    it('should clear heartbeat intervals on cancel', async () => {
      const taskId = 'test-heartbeat-cancel'
      const interval = setInterval(() => {}, 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private field for verification
      const heartbeats = (executor as any).heartbeatIntervals as Map<string, Timer>
      heartbeats.set(taskId, interval)

      await executor.cancel(taskId)

      expect(heartbeats.has(taskId)).toBe(false)
    })
  })

  describe('Submit', () => {
    it('should enqueue workflow with correct parameters', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(executor as any).started = true
      vi.spyOn(executor, 'ensureLaunched').mockResolvedValueOnce(undefined)
      const mockClient = {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS property name
        enqueue: vi.fn().mockResolvedValue({ workflowID: 'task-123' }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(executor, 'getClient').mockResolvedValue(mockClient as any)

      const mockTask = {
        id: 'task-123',
        type: WorkflowTaskType.chat,
        status: WorkflowTaskStatus.pending,
      } as WorkflowTask

      const res = await executor.submit(mockTask)
      expect(res).toBe('task-123')
      expect(mockClient.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: TaskQueueAgent,
          workflowName: WorkflowTaskType.chat,
          // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS property name
          workflowID: 'task-123',
        }),
        mockTask,
      )
    })

    it('should allow submitting tasks from within a running DBOS step', async () => {
      executor.start()
      await executor.ensureLaunched()

      activeExecutor = executor
      const result = await wf()
      expect(result).toBe('task-from-step')
    })
  })
})
