import { prisma } from '@shumai/db'
import { WorkflowTask, WorkflowTaskStatus } from '@shumai/db'
import { Executor } from './executor'
import * as taskActivities from './activities/task'
import {
  getConcurrencyLimit,
  registerLocalTaskAbortController,
  runInLocalTaskContext,
  triggerLocalCancel,
  unregisterLocalTaskAbortController,
} from './workflow-utils'
import { logger } from '@shumai/core/src/logger'
import './local-task-storage'

type WorkflowFn = (task: WorkflowTask) => Promise<void>

const workflowRegistry = new Map<string, WorkflowFn>()
const activityRegistry: Record<string, unknown> = { ...taskActivities }

export function registerWorkflow(type: string, fn: WorkflowFn) {
  workflowRegistry.set(type, fn)
}

/* eslint-disable @typescript-eslint/naming-convention */
const globalObj = globalThis as typeof globalThis & {
  __localActivities?: Record<string, unknown>
  __localLogger?: unknown
}
/* eslint-enable @typescript-eslint/naming-convention */

export function registerActivities(acts: Record<string, unknown>) {
  Object.assign(activityRegistry, acts)
  globalObj.__localActivities = activityRegistry
}

// Inject local dependencies into global scope for workflow-utils
globalObj.__localActivities = activityRegistry
globalObj.__localLogger = logger

// ConcurrencyLimiter manages concurrent execution of promises with a FIFO queue.
export class ConcurrencyLimiter {
  private activeCount = 0
  private queue: (() => void)[] = []

  constructor(private readonly limit: number) {}

  getLimit(): number {
    return this.limit
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    } else {
      this.activeCount++
    }

    try {
      return await fn()
    } finally {
      const next = this.queue.shift()
      if (next) {
        next()
      } else {
        this.activeCount--
      }
    }
  }

  // Exposed for testing concurrency status
  getActiveCount(): number {
    return this.activeCount
  }

  getQueueLength(): number {
    return this.queue.length
  }
}

export class LocalExecutor implements Executor {
  private interval: Timer | null = null
  private processingTasks = new Set<string>()
  private heartbeatIntervals = new Map<string, Timer>()

  private transcodeLimiter: ConcurrencyLimiter
  private generalLimiter: ConcurrencyLimiter

  constructor() {
    const transcodeLimit = getConcurrencyLimit(process.env.CONCURRENCY_TRANSCODE, 1)
    const agentLimit = getConcurrencyLimit(process.env.CONCURRENCY_AGENT, 5)

    this.transcodeLimiter = new ConcurrencyLimiter(transcodeLimit)
    this.generalLimiter = new ConcurrencyLimiter(agentLimit)
  }

  getTranscodeConcurrencyLimit(): number {
    return this.transcodeLimiter.getLimit()
  }

  getAgentConcurrencyLimit(): number {
    return this.generalLimiter.getLimit()
  }

  async submit(task: WorkflowTask): Promise<string> {
    if (task.status !== WorkflowTaskStatus.pending) {
      await prisma.workflowTask.updateMany({
        where: { id: task.id },
        data: { status: WorkflowTaskStatus.pending },
      })
    }

    // In tests, we trigger processing immediately using the appropriate limiter
    if (process.env.NODE_ENV === 'test') {
      setTimeout(async () => {
        if (this.processingTasks.has(task.id)) return
        this.processingTasks.add(task.id)

        // 1. Immediately mark task as processing and set initial heartbeat in DB
        // atomically, only if the task is still pending.
        try {
          const affected = await prisma.workflowTask.updateMany({
            where: {
              id: task.id,
              status: WorkflowTaskStatus.pending,
            },
            data: {
              status: WorkflowTaskStatus.processing,
              heartbeat: new Date(),
            },
          })
          if (affected.count === 0) {
            this.processingTasks.delete(task.id)
            return
          }
        } catch (err) {
          console.error(
            `[LocalExecutor] Failed to mark task ${task.id} as processing in submit:`,
            err,
          )
          this.processingTasks.delete(task.id)
          return
        }

        // 2. Start heartbeat updater immediately
        const heartbeatInterval = setInterval(async () => {
          try {
            const { count } = await prisma.workflowTask.updateMany({
              where: { id: task.id },
              data: { heartbeat: new Date() },
            })
            if (count === 0) {
              clearInterval(heartbeatInterval)
              this.heartbeatIntervals.delete(task.id)
              logger.debug(
                { taskId: task.id },
                '[LocalExecutor] Stopped heartbeat for deleted or cancelled task',
              )
            }
          } catch (err) {
            console.error(`[LocalExecutor] Failed to update heartbeat for task ${task.id}:`, err)
          }
        }, 5000)
        this.heartbeatIntervals.set(task.id, heartbeatInterval)

        const abortController = new AbortController()
        registerLocalTaskAbortController(task.id, abortController)

        const limiter =
          task.type && task.type.startsWith('transcode')
            ? this.transcodeLimiter
            : this.generalLimiter

        limiter
          .run(async () => {
            try {
              if (abortController.signal.aborted) {
                logger.info(
                  { taskId: task.id },
                  '[LocalExecutor] Queued task was aborted before execution',
                )
                try {
                  await prisma.workflowTask.updateMany({
                    where: { id: task.id, status: WorkflowTaskStatus.processing },
                    data: {
                      status: WorkflowTaskStatus.failed,
                      output: { error: 'Workflow task was cancelled before execution' },
                    },
                  })
                } catch {
                  // Ignore if task was already deleted
                }
                return
              }
              await runInLocalTaskContext({ taskId: task.id, abortController }, async () => {
                await this.processTaskWrapper(task)
              })
            } finally {
              // 3. Clean up the heartbeat updater and processing set when the task finishes
              clearInterval(heartbeatInterval)
              this.heartbeatIntervals.delete(task.id)
              unregisterLocalTaskAbortController(task.id)
              this.processingTasks.delete(task.id)
            }
          })
          .catch((err) => {
            console.error(`[LocalExecutor] Failed to process task ${task.id}:`, err)
          })
      }, 0)
    }
    return task.id
  }

  async cancel(taskId: string): Promise<void> {
    const timer = this.heartbeatIntervals.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatIntervals.delete(taskId)
    }
    triggerLocalCancel(taskId)
    logger.info({ taskId }, '[LocalExecutor] Cancelled workflow task')
  }

  start(): void {
    if (this.interval) return
    this.interval = setInterval(() => this.tick(), 5000)
  }

  close(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    for (const timer of this.heartbeatIntervals.values()) {
      clearInterval(timer)
    }
    this.heartbeatIntervals.clear()
    for (const taskId of this.processingTasks) {
      triggerLocalCancel(taskId)
    }
  }

  // Returns the array of task promises so tests can await them to avoid early rollback.
  async tick(): Promise<Promise<void>[]> {
    const promises: Promise<void>[] = []
    try {
      const staleTime = new Date(Date.now() - 30 * 1000)

      // Find tasks that are:
      // 1. Pending (new tasks)
      // 2. Processing but stale (worker crashed, heartbeat > 30s ago)
      const tasks = await prisma.workflowTask.findMany({
        where: {
          OR: [
            { status: WorkflowTaskStatus.pending },
            {
              status: WorkflowTaskStatus.processing,
              heartbeat: { lt: staleTime },
            },
          ],
        },
        orderBy: { id: 'asc' },
        take: 50,
      })

      for (const task of tasks) {
        if (this.processingTasks.has(task.id)) continue
        this.processingTasks.add(task.id)

        // 1. Immediately mark task as processing and set initial heartbeat in DB
        // atomically, ensuring no two workers pick up the same task.
        try {
          const affected = await prisma.workflowTask.updateMany({
            where: {
              id: task.id,
              OR: [
                { status: WorkflowTaskStatus.pending },
                {
                  status: WorkflowTaskStatus.processing,
                  heartbeat: { lt: staleTime },
                },
              ],
            },
            data: {
              status: WorkflowTaskStatus.processing,
              heartbeat: new Date(),
            },
          })
          if (affected.count === 0) {
            this.processingTasks.delete(task.id)
            continue
          }
        } catch (err) {
          console.error(
            `[LocalExecutor] Failed to mark task ${task.id} as processing in tick:`,
            err,
          )
          this.processingTasks.delete(task.id)
          continue
        }

        // 2. Start heartbeat updater immediately to prevent other workers from considering it stale
        // even while the task is queued waiting for limiter capacity.
        const heartbeatInterval = setInterval(async () => {
          try {
            const { count } = await prisma.workflowTask.updateMany({
              where: { id: task.id },
              data: { heartbeat: new Date() },
            })
            if (count === 0) {
              clearInterval(heartbeatInterval)
              this.heartbeatIntervals.delete(task.id)
              logger.debug(
                { taskId: task.id },
                '[LocalExecutor] Stopped heartbeat for deleted or cancelled task',
              )
            }
          } catch (err) {
            console.error(`[LocalExecutor] Failed to update heartbeat for task ${task.id}:`, err)
          }
        }, 5000)
        this.heartbeatIntervals.set(task.id, heartbeatInterval)

        const abortController = new AbortController()
        registerLocalTaskAbortController(task.id, abortController)

        const limiter =
          task.type && task.type.startsWith('transcode')
            ? this.transcodeLimiter
            : this.generalLimiter

        const promise = limiter
          .run(async () => {
            try {
              if (abortController.signal.aborted) {
                logger.info(
                  { taskId: task.id },
                  '[LocalExecutor] Queued task was aborted before execution',
                )
                try {
                  await prisma.workflowTask.updateMany({
                    where: { id: task.id, status: WorkflowTaskStatus.processing },
                    data: {
                      status: WorkflowTaskStatus.failed,
                      output: { error: 'Workflow task was cancelled before execution' },
                    },
                  })
                } catch {
                  // Ignore if task was already deleted
                }
                return
              }
              await runInLocalTaskContext({ taskId: task.id, abortController }, async () => {
                await this.processTaskWrapper(task)
              })
            } finally {
              // 3. Clean up the heartbeat updater and processing set when the task finishes
              clearInterval(heartbeatInterval)
              this.heartbeatIntervals.delete(task.id)
              unregisterLocalTaskAbortController(task.id)
              this.processingTasks.delete(task.id)
            }
          })
          .catch((err) => {
            console.error(`[LocalExecutor] Failed to process task ${task.id}:`, err)
          })
        promises.push(promise)
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
    return promises
  }

  private async processTaskWrapper(task: WorkflowTask) {
    try {
      const fn = task.type ? workflowRegistry.get(task.type) : undefined
      if (fn) {
        await fn(task)
      } else {
        console.warn(`Unknown or unregistered task type: ${task.type}`)
      }
    } catch (err) {
      console.error(`Error in workflow ${task.type} for task ${task.id}:`, err)
      try {
        await prisma.workflowTask.updateMany({
          where: { id: task.id },
          data: {
            status: WorkflowTaskStatus.failed,
            output: { error: err instanceof Error ? err.message : String(err) },
          },
        })
      } catch (updateErr) {
        console.error(`Failed to set task ${task.id} to failed:`, updateErr)
      }
    }
  }
}
