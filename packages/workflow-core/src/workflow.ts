import { logger } from '@shumai/core/src/logger'
import {
  AssetStatus,
  prisma,
  registerWorkflowCancel,
  registerWorkflowTrigger,
  WorkflowTask,
  WorkflowTaskStatus,
} from '@shumai/db'
import { DbosExecutor, getQueueForTaskType, getRegisteredWorkflows } from './dbos-executor'

export class WorkflowService {
  private executor: DbosExecutor
  private staleRecoveryTimer: Timer | null = null

  constructor() {
    this.executor = new DbosExecutor()
  }

  getExecutor(): DbosExecutor {
    return this.executor
  }

  async submit(task: WorkflowTask): Promise<string> {
    return this.executor.submit(task)
  }

  async cancel(taskId: string): Promise<void> {
    await this.executor.cancel(taskId)
  }

  async executeWait(task: WorkflowTask, timeoutMs: number = 30000): Promise<WorkflowTask> {
    const { task: finished, done } = await this.waitFor(task, timeoutMs)
    if (!done) {
      throw new Error('Workflow task timed out')
    }
    return finished
  }

  /**
   * Wait up to `timeoutMs` for a task to finish. Unlike `executeWait`, running out of time is
   * not an error: it resolves with the latest task state and `done: false`, so callers can hand
   * the task ID back and complete the work later. Throws if the task failed or disappeared.
   */
  async waitFor(
    task: WorkflowTask,
    timeoutMs: number,
  ): Promise<{ task: WorkflowTask; done: boolean }> {
    const start = Date.now()
    for (;;) {
      const updatedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })

      if (!updatedTask) {
        throw new Error(`WorkflowTask ${task.id} not found`)
      }

      if (updatedTask.status === 'completed') {
        return { task: updatedTask, done: true }
      }

      if (updatedTask.status === 'failed') {
        const output = updatedTask.output as Record<string, unknown> | null
        const error = typeof output?.error === 'string' ? output.error : 'Workflow task failed'
        throw new Error(error)
      }

      if (Date.now() - start >= timeoutMs) {
        return { task: updatedTask, done: false }
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  start(listenQueues?: string[]): void {
    if (listenQueues) {
      this.executor.setListenQueues(listenQueues)
    }
    this.executor.start()
  }

  close(): void {
    this.stopStaleTaskRecovery()
    this.executor.close()
  }

  async ensureLaunched(): Promise<void> {
    await this.executor.ensureLaunched()
  }

  async shutdownWorkers(options?: { workflowCompletionTimeoutMs?: number }): Promise<void> {
    this.stopStaleTaskRecovery()
    await this.executor.shutdown(options)
  }

  isStarted(): boolean {
    return this.executor.isStarted()
  }

  async waitForPendingSubmissions(): Promise<void> {
    await this.executor.waitForPendingSubmissions()
  }

  // Starts DBOS worker for specific task queue(s)
  async startWorkers(queue: string | string[]): Promise<void> {
    const queues = Array.isArray(queue) ? queue : [queue]
    console.log(`Starting DBOS worker for queue(s): ${queues.join(', ')}`)
    this.executor.setListenQueues(queues)
    this.executor.start()
    await this.executor.ensureLaunched()
  }

  startStaleTaskRecovery(options?: {
    intervalMs?: number
    staleThresholdMs?: number
    maxRecoveryAttempts?: number
  }): void {
    if (this.staleRecoveryTimer) {
      return
    }
    const intervalMs = options?.intervalMs ?? 30_000
    this.staleRecoveryTimer = setInterval(() => {
      this.recoverStaleTasks(options).catch((err) => {
        logger.error({ err }, '[WorkflowService] Stale task recovery sweep encountered an error')
      })
    }, intervalMs)
  }

  stopStaleTaskRecovery(): void {
    if (this.staleRecoveryTimer) {
      clearInterval(this.staleRecoveryTimer)
      this.staleRecoveryTimer = null
    }
  }

  async recoverStaleTasks(options?: {
    staleThresholdMs?: number
    maxRecoveryAttempts?: number
  }): Promise<number> {
    const staleThresholdMs = options?.staleThresholdMs ?? 90_000
    const maxRecoveryAttempts = options?.maxRecoveryAttempts ?? 3
    const cutoff = new Date(Date.now() - staleThresholdMs)

    const staleTasks = await prisma.workflowTask.findMany({
      where: {
        status: WorkflowTaskStatus.processing,
        heartbeat: { lt: cutoff },
      },
    })

    if (staleTasks.length === 0) return 0

    let recoveredCount = 0
    const client = await this.executor.getClient()

    for (const task of staleTasks) {
      try {
        const currentTask = await prisma.workflowTask.findUnique({
          where: { id: task.id },
        })
        if (
          !currentTask ||
          currentTask.status !== WorkflowTaskStatus.processing ||
          (currentTask.heartbeat &&
            currentTask.heartbeat.getTime() >= Date.now() - staleThresholdMs)
        ) {
          continue
        }

        const output = (currentTask.output as PrismaJson.WorkflowTaskOutput | null) || {}
        const recoveryAttempts = (output.recoveryAttempts ?? 0) + 1

        if (recoveryAttempts > maxRecoveryAttempts) {
          logger.error(
            { taskId: task.id, recoveryAttempts, maxRecoveryAttempts },
            '[WorkflowService] Stale task exceeded max recovery attempts. Marking as failed.',
          )
          await prisma.workflowTask.update({
            where: { id: task.id },
            data: {
              status: WorkflowTaskStatus.failed,
              output: {
                ...output,
                recoveryAttempts,
                error: `Task exceeded maximum stale recovery attempts (${maxRecoveryAttempts}). Marked as failed.`,
              },
            },
          })
          if (task.assetId && task.type && task.type.startsWith('transcode')) {
            await prisma.asset.updateMany({
              where: { id: task.assetId, status: AssetStatus.processing },
              data: { status: AssetStatus.failed },
            })
          }
          recoveredCount++
          continue
        }

        const handle = client.retrieveWorkflow(task.id)
        const wfStatus = await handle.getStatus().catch(() => null)

        if (wfStatus?.status === 'PENDING') {
          await prisma.workflowTask.update({
            where: { id: task.id },
            data: {
              heartbeat: new Date(),
              output: {
                ...output,
                recoveryAttempts,
              },
            },
          })
          const queueName = getQueueForTaskType(task.type)
          await client.resumeWorkflow(task.id, { queueName })
          logger.info(
            { taskId: task.id, queueName, recoveryAttempts },
            '[WorkflowService] Resumed stale pending workflow task in DBOS',
          )
          recoveredCount++
        } else if (wfStatus?.status === 'SUCCESS') {
          await prisma.workflowTask.update({
            where: { id: task.id },
            data: { status: WorkflowTaskStatus.completed },
          })
          recoveredCount++
        } else if (wfStatus?.status === 'ERROR') {
          await prisma.workflowTask.update({
            where: { id: task.id },
            data: {
              status: WorkflowTaskStatus.failed,
              output: {
                ...output,
                error: wfStatus.error ? String(wfStatus.error) : 'Workflow failed in DBOS',
              },
            },
          })
          recoveredCount++
        } else if (wfStatus?.status === 'CANCELLED') {
          await prisma.workflowTask.update({
            where: { id: task.id },
            data: {
              status: WorkflowTaskStatus.failed,
              output: {
                ...output,
                error: 'Workflow was cancelled',
              },
            },
          })
          recoveredCount++
        }
      } catch (err) {
        logger.warn({ taskId: task.id, err }, '[WorkflowService] Error while checking stale task')
      }
    }

    return recoveredCount
  }
}

export const workflowService = new WorkflowService()
registerWorkflowTrigger(async (task) => {
  if (
    process.env.NODE_ENV === 'test' &&
    !workflowService.isStarted() &&
    getRegisteredWorkflows().size === 0
  ) {
    return
  }
  await workflowService.submit(task)
})
registerWorkflowCancel(async (taskId) => {
  await workflowService.cancel(taskId)
})
