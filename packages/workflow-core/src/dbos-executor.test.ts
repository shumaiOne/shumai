import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DbosExecutor, getDbosDatabaseUrl, getQueueForTaskType } from './dbos-executor'
import { TaskQueueAgent, TaskQueueTranscode } from './workflow-utils'
import { WorkflowTaskStatus, WorkflowTaskType, WorkflowTask, prisma } from '@shumai/db'
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

    it('should update effective queue worker concurrency when environment variables change', async () => {
      // First start with agent concurrency = 5 and transcode = 2
      process.env.CONCURRENCY_AGENT = '5'
      process.env.CONCURRENCY_TRANSCODE = '2'
      executor.start()
      await executor.ensureLaunched()

      const agentQueueFirst = await DBOS.retrieveQueue(TaskQueueAgent)
      expect(agentQueueFirst?.workerConcurrency).toBe(5)
      const transcodeQueueFirst = await DBOS.retrieveQueue(TaskQueueTranscode)
      expect(transcodeQueueFirst?.workerConcurrency).toBe(2)

      await executor.shutdown()

      // Now change environment variables to safety limits (e.g. CONCURRENCY_AGENT=1, CONCURRENCY_TRANSCODE=4)
      process.env.CONCURRENCY_AGENT = '1'
      process.env.CONCURRENCY_TRANSCODE = '4'
      const executor2 = new DbosExecutor()
      try {
        executor2.start()
        await executor2.ensureLaunched()

        const agentQueueUpdated = await DBOS.retrieveQueue(TaskQueueAgent)
        const transcodeQueueUpdated = await DBOS.retrieveQueue(TaskQueueTranscode)

        expect(agentQueueUpdated?.workerConcurrency).toBe(1)
        expect(transcodeQueueUpdated?.workerConcurrency).toBe(4)
      } finally {
        await executor2.shutdown()
      }
    })

    it('should only update queues the worker listens to or configures, leaving unmanaged queues untouched', async () => {
      const registerQueueSpy = vi.spyOn(DBOS, 'registerQueue')

      process.env.CONCURRENCY_TRANSCODE = '3'
      const transcodeWorker = new DbosExecutor([TaskQueueTranscode])
      try {
        transcodeWorker.start()
        await transcodeWorker.ensureLaunched()

        const transcodeQueue = await DBOS.retrieveQueue(TaskQueueTranscode)
        expect(transcodeQueue?.workerConcurrency).toBe(3)

        // transcodeWorker should only have registered TaskQueueTranscode, not unmanaged queues like TaskQueueAgent
        const registeredQueueNames = registerQueueSpy.mock.calls.map((call) => call[0])
        expect(registeredQueueNames).toContain(TaskQueueTranscode)
        expect(registeredQueueNames).not.toContain(TaskQueueAgent)
      } finally {
        registerQueueSpy.mockRestore()
        delete process.env.CONCURRENCY_TRANSCODE
        await transcodeWorker.shutdown()
      }
    })
  })

  describe('Executor Identity & Multi-instance Recovery', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should derive unique executor IDs for multiple replicas of the same role when no explicit ID is provided', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.DBOS__VMID
      delete process.env.SHUMAI_WORKER_ID
      delete process.env.POD_NAME

      const worker1 = new DbosExecutor([TaskQueueTranscode])
      const worker2 = new DbosExecutor([TaskQueueTranscode])

      const id1 = worker1.getExecutorId()
      const id2 = worker2.getExecutorId()

      expect(id1).not.toBe(id2)
      expect(id1).toContain('shumai-transcode')
      expect(id2).toContain('shumai-transcode')
    })

    it('should incorporate SHUMAI_WORKER_ID or POD_NAME when configured', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.DBOS__VMID

      process.env.SHUMAI_WORKER_ID = 'replica-42'
      const workerWithId = new DbosExecutor([TaskQueueTranscode])
      expect(workerWithId.getExecutorId()).toBe('shumai-transcode-replica-42')

      delete process.env.SHUMAI_WORKER_ID
      process.env.POD_NAME = 'shumai-transcode-pod-0'
      const workerWithPod = new DbosExecutor([TaskQueueTranscode])
      expect(workerWithPod.getExecutorId()).toBe('shumai-transcode-pod-0')
    })

    it('should allow setting explicit executorId via constructor or setExecutorId', () => {
      const customWorker = new DbosExecutor([TaskQueueAgent], 'my-custom-worker')
      expect(customWorker.getExecutorId()).toBe('my-custom-worker')

      customWorker.setExecutorId('updated-worker-id')
      expect(customWorker.getExecutorId()).toBe('updated-worker-id')
    })

    it('should not recover live workflows belonging to another executor ID on startup', async () => {
      const activeWorkerId = `active-worker-${Date.now()}`
      const newWorkerId = `new-worker-${Date.now()}`
      const taskUuid = `task-recovery-test-${Date.now()}`

      // Seed a pending task claimed by activeWorkerId
      await prisma.$queryRawUnsafe(
        `
        INSERT INTO dbos.workflow_status (
          workflow_uuid, status, name, executor_id, created_at, updated_at, application_version, application_name, queue_name
        ) VALUES (
          $1, 'PENDING', 'testRecoveryWorkflow', $2, 0, 0, '1.0.0', 'shumai', 'transcode_queue'
        )
      `,
        taskUuid,
        activeWorkerId,
      )

      try {
        // Launch a new worker with a distinct executor ID
        const newWorker = new DbosExecutor([TaskQueueTranscode], newWorkerId)
        newWorker.start()
        await newWorker.ensureLaunched()

        // Verify the active worker's task was NOT recovered (remains PENDING with activeWorkerId)
        const rowsAfterOtherWorker = await prisma.$queryRawUnsafe<
          Array<{ status: string; executorId: string }>
        >(
          'SELECT status, executor_id AS "executorId" FROM dbos.workflow_status WHERE workflow_uuid = $1',
          taskUuid,
        )
        expect(rowsAfterOtherWorker[0].status).toBe('PENDING')
        expect(rowsAfterOtherWorker[0].executorId).toBe(activeWorkerId)

        await newWorker.shutdown()

        // Now simulate the active worker restarting with its OWN executor ID
        const restartedWorker = new DbosExecutor([TaskQueueTranscode], activeWorkerId)
        restartedWorker.start()
        await restartedWorker.ensureLaunched()

        // Verify that on restart with the SAME executor ID, DBOS startup recovery DOES re-enqueue it
        const rowsAfterRestart = await prisma.$queryRawUnsafe<
          Array<{ status: string; executorId: string }>
        >(
          'SELECT status, executor_id AS "executorId" FROM dbos.workflow_status WHERE workflow_uuid = $1',
          taskUuid,
        )
        expect(rowsAfterRestart[0].status).toBe('ENQUEUED')

        await restartedWorker.shutdown()
      } finally {
        await prisma.$queryRawUnsafe(
          'DELETE FROM dbos.workflow_status WHERE workflow_uuid = $1',
          taskUuid,
        )
      }
    }, 20000)
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

    it('should enqueue workflow via client even when executor is not started and no local workflows are registered', async () => {
      // executor is not started and has no local workflows registered (e.g. CLI or producer mode)
      const mockClient = {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS property name
        enqueue: vi.fn().mockResolvedValue({ workflowID: 'task-cli-123' }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(executor, 'getClient').mockResolvedValue(mockClient as any)

      const mockTask = {
        id: 'task-cli-123',
        type: WorkflowTaskType.ai_embedding,
        status: WorkflowTaskStatus.pending,
      } as WorkflowTask

      const res = await executor.submit(mockTask)
      expect(mockClient.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: TaskQueueAgent,
          workflowName: WorkflowTaskType.ai_embedding,
          // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS property name
          workflowID: 'task-cli-123',
        }),
        mockTask,
      )
      expect(res).toBe('task-cli-123')
    })

    it('should allow submitting tasks from within a running DBOS step', async () => {
      executor.start()
      await executor.ensureLaunched()

      const mockClient = {
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS property name
        enqueue: vi.fn().mockResolvedValue({ workflowID: 'task-from-step' }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(executor, 'getClient').mockResolvedValue(mockClient as any)

      activeExecutor = executor
      const result = await wf()
      expect(result).toBe('task-from-step')
      expect(mockClient.enqueue).toHaveBeenCalled()
    }, 15000)
  })

  describe('Once mode, events, and conflict handling', () => {
    it('should force concurrency to 1 in onceMode', () => {
      executor.setOnceMode(true)
      expect(executor.isOnceMode()).toBe(true)
      expect(executor.getTranscodeConcurrencyLimit()).toBe(1)
    })

    it('should emit workflowStarted and workflowFinished events during execution', async () => {
      let startedTask: WorkflowTask | null = null
      let finishedPayload: { taskId: string; success: boolean } | null = null

      executor.on('workflowStarted', (task) => {
        startedTask = task
      })
      executor.on('workflowFinished', (payload) => {
        finishedPayload = payload
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = (executor as any).createDbosWorkflowWrapper('test-events-workflow')
      const { registerWorkflow } = await import('./dbos-executor')
      registerWorkflow('test-events-workflow', async () => {
        // do work
      })

      const task = await prisma.workflowTask.create({
        data: {
          id: 'test-events-task',
          assetId: 'asset-events',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.pending,
        },
      })

      await wrapper(task)

      expect(startedTask).toBeDefined()
      expect((startedTask as WorkflowTask | null)?.id).toBe('test-events-task')
      expect(finishedPayload).toBeDefined()
      expect((finishedPayload as { taskId: string; success: boolean } | null)?.taskId).toBe(
        'test-events-task',
      )
      expect((finishedPayload as { taskId: string; success: boolean } | null)?.success).toBe(true)
    })

    it('should handle DBOSWorkflowConflictError without marking task failed', async () => {
      const { DBOSWorkflowConflictError: DbosWorkflowConflictError } =
        await import('@dbos-inc/dbos-sdk')
      const { registerWorkflow } = await import('./dbos-executor')

      registerWorkflow('test-conflict-workflow', async () => {
        throw new DbosWorkflowConflictError('test-conflict-task')
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrapper = (executor as any).createDbosWorkflowWrapper('test-conflict-workflow')

      const task = await prisma.workflowTask.create({
        data: {
          id: 'test-conflict-task',
          assetId: 'asset-conflict',
          type: WorkflowTaskType.transcode,
          status: WorkflowTaskStatus.pending,
        },
      })

      await expect(wrapper(task)).rejects.toThrow('is no longer owned by this execution')

      const updatedTask = await prisma.workflowTask.findUnique({
        where: { id: 'test-conflict-task' },
      })
      // Task should NOT be marked as failed!
      expect(updatedTask?.status).not.toBe(WorkflowTaskStatus.failed)
    })

    it('should pass workflowCompletionTimeoutMs to DBOS.shutdown', async () => {
      const shutdownSpy = vi.spyOn(DBOS, 'shutdown').mockResolvedValue(undefined)
      const isInitSpy = vi.spyOn(DBOS, 'isInitialized').mockReturnValue(true)

      await executor.shutdown({ workflowCompletionTimeoutMs: 290000 })

      expect(shutdownSpy).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS SDK parameter name
        workflowCompletionTimeoutMS: 290000,
      })

      shutdownSpy.mockRestore()
      isInitSpy.mockRestore()
    })
  })
})
