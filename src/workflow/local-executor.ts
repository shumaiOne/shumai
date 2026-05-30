import { prisma } from '@/db'
import { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@/generated/prisma/client'
import { Executor } from './executor'
import { agentEmbeddingMedia } from './workflows/agent-embedding'
import { queryEmbeddingForSearch } from './workflows/query-embedding-for-search'
import { agentAutofillMedia } from './workflows/agent-autofill'
import { agentChat } from './workflows/agent-chat'
import { transcodeMedia } from '@/transcode/workflows/transcode'
import { activities } from './activities/index'
import { logger } from '@/logger'

// Inject local dependencies into global scope for workflow-utils
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).__localActivities = activities
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).__localLogger = logger

export class ConcurrencyLimiter {
  private activeCount = 0
  private queue: (() => void)[] = []

  constructor(private readonly limit: number) {}

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

  // 1 concurrency for transcode, 5 for other workflows
  private transcodeLimiter = new ConcurrencyLimiter(1)
  private generalLimiter = new ConcurrencyLimiter(5)

  async submit(task: WorkflowTask): Promise<string> {
    if (task.status !== WorkflowTaskStatus.pending) {
      await prisma.workflowTask.update({
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
            await prisma.workflowTask.update({
              where: { id: task.id },
              data: { heartbeat: new Date() },
            })
          } catch (err) {
            console.error(`[LocalExecutor] Failed to update heartbeat for task ${task.id}:`, err)
          }
        }, 5000)

        const limiter =
          task.type === WorkflowTaskType.transcode ? this.transcodeLimiter : this.generalLimiter

        limiter
          .run(async () => {
            try {
              await this.processTaskWrapper(task)
            } finally {
              // 3. Clean up the heartbeat updater and processing set when the task finishes
              clearInterval(heartbeatInterval)
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

  start(): void {
    if (this.interval) return
    this.interval = setInterval(() => this.tick(), 5000)
  }

  close(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  // Returns the array of task promises so tests can await them to avoid early rollback.
  async tick(): Promise<Promise<void>[]> {
    const promises: Promise<void>[] = []
    try {
      const staleTime = new Date(Date.now() - 30 * 1000)
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
        take: 50,
      })

      for (const task of tasks) {
        if (this.processingTasks.has(task.id)) continue
        this.processingTasks.add(task.id)

        // 1. Immediately mark task as processing and set initial heartbeat in DB
        // to guarantee no other ticks/replicas can double-query it.
        // We use updateMany to atomically claim it only if it is still pending or stale.
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
          console.error(`[LocalExecutor] Failed to mark task ${task.id} as processing:`, err)
          this.processingTasks.delete(task.id)
          continue
        }

        // 2. Start heartbeat updater immediately so it updates heartbeat
        // even while the task is queued waiting for limiter capacity.
        const heartbeatInterval = setInterval(async () => {
          try {
            await prisma.workflowTask.update({
              where: { id: task.id },
              data: { heartbeat: new Date() },
            })
          } catch (err) {
            console.error(`[LocalExecutor] Failed to update heartbeat for task ${task.id}:`, err)
          }
        }, 5000)

        const limiter =
          task.type === WorkflowTaskType.transcode ? this.transcodeLimiter : this.generalLimiter

        const promise = limiter
          .run(async () => {
            try {
              await this.processTaskWrapper(task)
            } finally {
              // 3. Clean up the heartbeat updater and processing set when the task finishes
              clearInterval(heartbeatInterval)
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
      switch (task.type) {
        case WorkflowTaskType.ai_embedding:
          await agentEmbeddingMedia(task)
          break
        case WorkflowTaskType.query_embedding_for_search:
          await queryEmbeddingForSearch(task)
          break
        case WorkflowTaskType.ai_metadata_autofill:
          await agentAutofillMedia(task)
          break
        case WorkflowTaskType.chat:
          await agentChat(task)
          break
        case WorkflowTaskType.transcode:
          await transcodeMedia(task)
          break
        default:
          console.warn(`Unknown task type: ${task.type}`)
      }
    } catch (err) {
      console.error(`Error in workflow ${task.type} for task ${task.id}:`, err)
      try {
        await prisma.workflowTask.update({
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
