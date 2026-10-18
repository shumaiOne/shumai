import EventEmitter from 'node:events'
import os from 'node:os'
import { DBOS, DBOSClient, DBOSWorkflowConflictError } from '@dbos-inc/dbos-sdk'
import { logger } from '@shumai/core/src/logger'
import { prisma, WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import {
  getConcurrencyLimit,
  registerLocalTaskAbortController,
  runInLocalTaskContext,
  TaskQueueAgent,
  TaskQueueTranscode,
  triggerLocalCancel,
  unregisterLocalTaskAbortController,
} from './workflow-utils'

export function isWorkflowConflictError(err: unknown): boolean {
  if (err instanceof DBOSWorkflowConflictError) return true
  if (
    err &&
    typeof err === 'object' &&
    'dbosErrorCode' in err &&
    (err as { dbosErrorCode: unknown }).dbosErrorCode === 5
  ) {
    return true
  }
  if (err instanceof Error && err.message.includes('is no longer owned by this execution')) {
    return true
  }
  return false
}

export type WorkflowFn = (task: WorkflowTask) => Promise<void>
const workflowRegistry = new Map<string, WorkflowFn>()

export function registerWorkflow(type: string, fn: WorkflowFn): void {
  workflowRegistry.set(type, fn)
}

export function getRegisteredWorkflows(): Map<string, WorkflowFn> {
  return workflowRegistry
}

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

export class DbosExecutor extends EventEmitter {
  private launchPromise: Promise<void> | null = null
  private started = false
  private client: DBOSClient | null = null
  private listenQueues: string[] = [TaskQueueAgent, TaskQueueTranscode]
  private heartbeatIntervals = new Map<string, Timer>()
  private inFlightSubmits = new Set<Promise<string>>()
  private executorId?: string
  private instanceSuffix = Math.random().toString(36).slice(2, 8)
  private onceMode = false

  constructor(listenQueues?: string[], executorId?: string) {
    super()
    if (listenQueues) {
      this.listenQueues = listenQueues
    }
    if (executorId) {
      this.executorId = executorId
    }
  }

  setOnceMode(once: boolean): void {
    this.onceMode = once
  }

  isOnceMode(): boolean {
    return this.onceMode
  }

  isStarted(): boolean {
    return this.started
  }

  setListenQueues(queues: string[]): void {
    this.listenQueues = queues
  }

  getTranscodeConcurrencyLimit(): number {
    if (this.onceMode) return 1
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
      this.emit('workflowStarted', task)
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

      let workflowError: unknown
      try {
        await runInLocalTaskContext({ taskId: task.id, abortController }, async () => {
          await fn(task)
        })
      } catch (err) {
        workflowError = err
        if (isWorkflowConflictError(err)) {
          logger.warn(
            { taskId: task.id, type, err },
            '[DbosExecutor] Workflow execution superseded (ownership lost or conflict). Skipping marking task as failed.',
          )
          throw err
        }
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
        this.emit('workflowFinished', {
          taskId: task.id,
          type,
          success: !workflowError,
          error: workflowError,
        })
      }
    }
  }

  getRole(): string {
    if (this.listenQueues.length === 0) return 'shumai-web'
    if (this.listenQueues.length === 1) {
      if (this.listenQueues[0] === TaskQueueTranscode) return 'shumai-transcode'
      if (this.listenQueues[0] === TaskQueueAgent) return 'shumai-agent'
    }
    return 'shumai-all'
  }

  setExecutorId(id: string): void {
    this.executorId = id
  }

  getExecutorId(): string {
    return this.getDefaultExecutorId()
  }

  private getDefaultExecutorId(): string {
    if (this.executorId) return this.executorId
    if (process.env.DBOS__VMID) return process.env.DBOS__VMID

    const role = this.getRole()
    if (process.env.SHUMAI_WORKER_ID) {
      const workerId = process.env.SHUMAI_WORKER_ID
      return workerId.startsWith(role) ? workerId : `${role}-${workerId}`
    }

    if (process.env.NODE_ENV === 'test') {
      return `shumai-test-${process.pid}-${this.instanceSuffix}`
    }

    // In Kubernetes, POD_NAME is standard and stable across pod restarts in StatefulSets
    if (process.env.POD_NAME) {
      const pod = process.env.POD_NAME
      return pod.startsWith(role) ? pod : `${role}-${pod}`
    }

    // In Docker containers, HOSTNAME is set to the unique container short ID.
    // If running on host machine / bare metal, disambiguate with pid and instance suffix.
    const host = process.env.HOSTNAME || os.hostname() || 'instance'
    return `${role}-${host}-${process.pid}-${this.instanceSuffix}`
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
      if (!isTest && !dbosMigrationsRan) {
        await DBOS.migrate(getDbosDatabaseUrl())
        dbosMigrationsRan = true
      }

      DBOS.setConfig({
        name: 'shumai',
        systemDatabaseUrl: getDbosDatabaseUrl(),
        systemDatabasePoolSize: isTest ? 5 : undefined,
        applicationVersion: process.env.SHUMAI_VERSION || '1.0.0',
        // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS config property name
        executorID: this.getDefaultExecutorId(),
        listenQueues: this.listenQueues,
        runMigrations: false,
        logLevel: isTest ? 'error' : 'info',
      })

      await DBOS.launch()

      const minPollingIntervalMs = isTest ? 50 : 1000
      for (const queueName of this.listenQueues) {
        if (queueName === TaskQueueTranscode) {
          await DBOS.registerQueue(TaskQueueTranscode, {
            workerConcurrency: this.getTranscodeConcurrencyLimit(),
            minPollingIntervalMs,
            onConflict: 'always_update',
          })
        } else if (queueName === TaskQueueAgent) {
          await DBOS.registerQueue(TaskQueueAgent, {
            workerConcurrency: this.getAgentConcurrencyLimit(),
            minPollingIntervalMs,
            onConflict: 'always_update',
          })
        }
      }
    })()

    try {
      await this.launchPromise
    } catch (err) {
      this.launchPromise = null
      throw err
    }
  }

  async getClient(): Promise<DBOSClient> {
    if (!this.client) {
      const isTest = process.env.NODE_ENV === 'test'
      this.client = await DBOSClient.create({
        systemDatabaseUrl: getDbosDatabaseUrl(),
        systemDatabasePoolSize: isTest ? 3 : undefined,
      })
    }
    return this.client
  }

  async submit(task: WorkflowTask): Promise<string> {
    const submitPromise = this.doSubmit(task)
    this.inFlightSubmits.add(submitPromise)
    try {
      return await submitPromise
    } finally {
      this.inFlightSubmits.delete(submitPromise)
    }
  }

  private async doSubmit(task: WorkflowTask): Promise<string> {
    if (task.status !== WorkflowTaskStatus.pending) {
      await prisma.workflowTask.updateMany({
        where: { id: task.id },
        data: { status: WorkflowTaskStatus.pending },
      })
    }

    if (this.started) {
      await this.ensureLaunched()
    }

    const workflowName = task.type
    if (!workflowName) {
      throw new Error(`WorkflowTask ${task.id} is missing task.type`)
    }

    const queueName = getQueueForTaskType(workflowName)
    const client = await this.getClient()
    const handle = await client.enqueue(
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

  async waitForPendingSubmissions(): Promise<void> {
    while (this.inFlightSubmits.size > 0) {
      await Promise.allSettled(Array.from(this.inFlightSubmits))
    }
  }

  async cancel(taskId: string): Promise<void> {
    const timer = this.heartbeatIntervals.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatIntervals.delete(taskId)
    }
    triggerLocalCancel(taskId)
    try {
      const client = await this.getClient()
      await client.cancelWorkflow(taskId)
      logger.info({ taskId }, '[DbosExecutor] Cancelled workflow task')
    } catch (err) {
      logger.warn({ taskId, err }, '[DbosExecutor] Failed to cancel workflow task in DBOS')
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
    this.waitForPendingSubmissions().catch(() => {})
    const cleanupResources = () => {
      for (const timer of this.heartbeatIntervals.values()) {
        clearInterval(timer)
      }
      this.heartbeatIntervals.clear()
      if (this.client) {
        this.client.destroy().catch(() => {})
        this.client = null
      }
    }

    if (DBOS.isInitialized()) {
      DBOS.shutdown()
        .then(() => {
          this.launchPromise = null
        })
        .catch((err) => {
          logger.warn({ err }, '[DbosExecutor] Error during DBOS shutdown')
        })
        .finally(cleanupResources)
    } else {
      cleanupResources()
    }
  }

  async shutdown(options?: { workflowCompletionTimeoutMs?: number }): Promise<void> {
    this.started = false
    await this.waitForPendingSubmissions()

    const timeoutMs =
      options?.workflowCompletionTimeoutMs ??
      (process.env.SHUMAI_WORKER_DRAIN_TIMEOUT_MS
        ? parseInt(process.env.SHUMAI_WORKER_DRAIN_TIMEOUT_MS, 10)
        : undefined)

    try {
      if (DBOS.isInitialized()) {
        await DBOS.shutdown(
          timeoutMs !== undefined
            ? {
                // eslint-disable-next-line @typescript-eslint/naming-convention -- DBOS SDK parameter name
                workflowCompletionTimeoutMS: timeoutMs,
              }
            : undefined,
        )
        this.launchPromise = null
      }
    } finally {
      for (const timer of this.heartbeatIntervals.values()) {
        clearInterval(timer)
      }
      this.heartbeatIntervals.clear()
      if (this.client) {
        await this.client.destroy().catch(() => {})
        this.client = null
      }
    }
  }
}
