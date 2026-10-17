import { DBOS } from '@dbos-inc/dbos-sdk'
import { logger } from '@shumai/core/src/logger'
import { prisma, WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import type { Executor } from './executor'
import { getRegisteredWorkflows } from './registry'
import {
  getConcurrencyLimit,
  registerLocalTaskAbortController,
  runInLocalTaskContext,
  TaskQueueAgent,
  TaskQueueTranscode,
  triggerLocalCancel,
  unregisterLocalTaskAbortController,
} from './workflow-utils'

export function getDbosDatabaseUrl(rawUrl?: string): string {
  const urlStr =
    rawUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shumai'
  try {
    const parsed = new URL(urlStr)
    parsed.searchParams.delete('schema')
    parsed.searchParams.delete('search_path')
    return parsed.toString()
  } catch {
    return urlStr
  }
}

export function getQueueForTaskType(type: string | null | undefined): string {
  switch (type) {
    case WorkflowTaskType.ai_embedding:
    case WorkflowTaskType.ai_metadata_autofill:
    case WorkflowTaskType.chat:
      return TaskQueueAgent
    case WorkflowTaskType.transcode:
    case WorkflowTaskType.transcode_video:
    case WorkflowTaskType.transcode_image:
    case WorkflowTaskType.transcode_pdf:
    case WorkflowTaskType.transcode_pdf_pages:
    case WorkflowTaskType.transcode_screenshot:
    case WorkflowTaskType.transcode_image_annotation:
    case WorkflowTaskType.transcode_watermark:
    case WorkflowTaskType.transcode_3d:
      return TaskQueueTranscode
    default:
      if (type && type.startsWith('transcode')) {
        return TaskQueueTranscode
      }
      return TaskQueueAgent
  }
}

let dbosMigrationsRan = false
const registeredDbosWorkflowNames = new Set<string>()

export class DbosExecutor implements Executor {
  private launchPromise: Promise<void> | null = null
  private started = false
  private listenQueues: string[] = [TaskQueueAgent, TaskQueueTranscode]
  private heartbeatIntervals = new Map<string, Timer>()

  constructor(listenQueues?: string[]) {
    if (listenQueues) {
      this.listenQueues = listenQueues
    }
  }

  setListenQueues(queues: string[]): void {
    this.listenQueues = queues
  }

  getTranscodeConcurrencyLimit(): number {
    return getConcurrencyLimit(process.env.CONCURRENCY_TRANSCODE, 1)
  }

  getAgentConcurrencyLimit(): number {
    return getConcurrencyLimit(process.env.CONCURRENCY_AGENT, 5)
  }

  private registerAllWorkflowsWithDbos(): void {
    const workflows = getRegisteredWorkflows()
    for (const type of workflows.keys()) {
      if (registeredDbosWorkflowNames.has(type)) {
        continue
      }
      const wrappedFn = this.createDbosWorkflowWrapper(type)
      DBOS.registerWorkflow(wrappedFn, { name: type })
      registeredDbosWorkflowNames.add(type)
    }
  }

  private createDbosWorkflowWrapper(type: string): (task: WorkflowTask) => Promise<void> {
    return async (task: WorkflowTask): Promise<void> => {
      const fn = getRegisteredWorkflows().get(type)
      if (!fn) {
        throw new Error(`No workflow registered for type: ${type}`)
      }
      // Mark task as processing and start heartbeat
      try {
        await prisma.workflowTask.updateMany({
          where: {
            id: task.id,
            status: WorkflowTaskStatus.pending,
          },
          data: {
            status: WorkflowTaskStatus.processing,
            heartbeat: new Date(),
          },
        })
      } catch (err) {
        logger.warn({ taskId: task.id, err }, '[DbosExecutor] Failed to mark task as processing')
      }

      const heartbeatInterval = setInterval(async () => {
        try {
          const { count } = await prisma.workflowTask.updateMany({
            where: { id: task.id },
            data: { heartbeat: new Date() },
          })
          if (count === 0) {
            clearInterval(heartbeatInterval)
            this.heartbeatIntervals.delete(task.id)
          }
        } catch {
          // Ignore transient heartbeat errors
        }
      }, 5000)
      this.heartbeatIntervals.set(task.id, heartbeatInterval)

      const abortController = new AbortController()
      registerLocalTaskAbortController(task.id, abortController)

      try {
        await runInLocalTaskContext({ taskId: task.id, abortController }, async () => {
          await fn(task)
        })
      } catch (err) {
        logger.error({ taskId: task.id, type, err }, `[DbosExecutor] Error in workflow ${type}`)
        try {
          await prisma.workflowTask.updateMany({
            where: { id: task.id },
            data: {
              status: WorkflowTaskStatus.failed,
              output: { error: err instanceof Error ? err.message : String(err) },
            },
          })
        } catch (updateErr) {
          logger.error(
            { taskId: task.id, err: updateErr },
            '[DbosExecutor] Failed to mark task failed',
          )
        }
        throw err
      } finally {
        clearInterval(heartbeatInterval)
        this.heartbeatIntervals.delete(task.id)
        unregisterLocalTaskAbortController(task.id)
      }
    }
  }

  private getDefaultExecutorId(): string {
    if (process.env.DBOS__VMID) return process.env.DBOS__VMID
    if (process.env.SHUMAI_WORKER_ID) return process.env.SHUMAI_WORKER_ID
    if (this.listenQueues.length === 0) return 'shumai-web'
    if (this.listenQueues.length === 1) {
      if (this.listenQueues[0] === TaskQueueTranscode) return 'shumai-transcode'
      if (this.listenQueues[0] === TaskQueueAgent) return 'shumai-agent'
    }
    return 'shumai-all'
  }

  async ensureLaunched(): Promise<void> {
    if (DBOS.isInitialized()) {
      return
    }
    if (this.launchPromise) {
      return this.launchPromise
    }

    this.launchPromise = (async () => {
      this.registerAllWorkflowsWithDbos()

      const isTest = process.env.NODE_ENV === 'test'
      DBOS.setConfig({
        name: 'shumai',
        systemDatabaseUrl: getDbosDatabaseUrl(),
        applicationVersion: process.env.SHUMAI_VERSION || '1.0.0',
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS config property name
        executorID: this.getDefaultExecutorId(),
        listenQueues: this.listenQueues,
        runMigrations: !dbosMigrationsRan,
        logLevel: isTest ? 'error' : 'info',
      })

      await DBOS.launch()
      dbosMigrationsRan = true

      const minPollingIntervalMs = isTest ? 50 : 1000
      await DBOS.registerQueue(TaskQueueTranscode, {
        workerConcurrency: this.getTranscodeConcurrencyLimit(),
        minPollingIntervalMs,
        onConflict: 'never_update',
      })
      await DBOS.registerQueue(TaskQueueAgent, {
        workerConcurrency: this.getAgentConcurrencyLimit(),
        minPollingIntervalMs,
        onConflict: 'never_update',
      })
    })()

    try {
      await this.launchPromise
    } catch (err) {
      this.launchPromise = null
      throw err
    }
  }

  async submit(task: WorkflowTask): Promise<string> {
    if (task.status !== WorkflowTaskStatus.pending) {
      await prisma.workflowTask.updateMany({
        where: { id: task.id },
        data: { status: WorkflowTaskStatus.pending },
      })
    }

    // In unit tests that do not start the workflow service or register workflows,
    // avoid launching DBOS in the background if no workflows are registered.
    if (!this.started && getRegisteredWorkflows().size === 0) {
      return task.id
    }

    await this.ensureLaunched()

    const workflowName = task.type
    if (!workflowName) {
      throw new Error(`WorkflowTask ${task.id} is missing task.type`)
    }

    const queueName = getQueueForTaskType(workflowName)
    const handle = await DBOS.enqueueWorkflowWithOptions(
      {
        queueName,
        workflowName,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS property name
        workflowID: task.id,
        appVersion: process.env.SHUMAI_VERSION || '1.0.0',
      },
      task,
    )

    return handle.workflowID
  }

  async cancel(taskId: string): Promise<void> {
    const timer = this.heartbeatIntervals.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatIntervals.delete(taskId)
    }
    triggerLocalCancel(taskId)
    if (DBOS.isInitialized()) {
      try {
        await DBOS.cancelWorkflow(taskId)
        logger.info({ taskId }, '[DbosExecutor] Cancelled workflow task')
      } catch (err) {
        logger.warn({ taskId, err }, '[DbosExecutor] Failed to cancel workflow task in DBOS')
      }
    }
  }

  start(): void {
    this.started = true
    this.ensureLaunched().catch((err) => {
      logger.error({ err }, '[DbosExecutor] Failed to launch DBOS on start()')
    })
  }

  close(): void {
    this.started = false
    for (const timer of this.heartbeatIntervals.values()) {
      clearInterval(timer)
    }
    this.heartbeatIntervals.clear()
    if (DBOS.isInitialized()) {
      DBOS.shutdown({ deregister: true })
        .then(() => {
          registeredDbosWorkflowNames.clear()
          this.launchPromise = null
        })
        .catch((err) => {
          logger.warn({ err }, '[DbosExecutor] Error during DBOS shutdown')
        })
    }
  }

  async shutdown(): Promise<void> {
    this.started = false
    for (const timer of this.heartbeatIntervals.values()) {
      clearInterval(timer)
    }
    this.heartbeatIntervals.clear()
    if (DBOS.isInitialized()) {
      await DBOS.shutdown({ deregister: true })
      registeredDbosWorkflowNames.clear()
      this.launchPromise = null
    }
  }
}
