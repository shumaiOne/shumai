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

export class LocalExecutor implements Executor {
  private interval: Timer | null = null
  private processingTasks = new Set<string>()

  async submit(task: WorkflowTask): Promise<string> {
    if (task.status !== WorkflowTaskStatus.pending) {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: WorkflowTaskStatus.pending },
      })
    }

    // In tests, we trigger processing immediately
    if (process.env.NODE_ENV === 'test') {
      setTimeout(() => {
        this.processTaskWrapper(task).catch((err) => {
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

  private async tick() {
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
        this.processTaskWrapper(task).catch((err) => {
          console.error(`[LocalExecutor] Failed to process task ${task.id}:`, err)
        })
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }

  private async processTaskWrapper(task: WorkflowTask) {
    if (this.processingTasks.has(task.id)) return
    this.processingTasks.add(task.id)

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
    } finally {
      this.processingTasks.delete(task.id)
    }
  }
}
