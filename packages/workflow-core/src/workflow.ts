import { prisma, registerWorkflowCancel, registerWorkflowTrigger, WorkflowTask } from '@shumai/db'
import { DbosExecutor, getRegisteredWorkflows } from './dbos-executor'

export class WorkflowService {
  private executor: DbosExecutor

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
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const updatedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })

      if (!updatedTask) {
        throw new Error(`WorkflowTask ${task.id} not found`)
      }

      if (updatedTask.status === 'completed') {
        return updatedTask
      }

      if (updatedTask.status === 'failed') {
        const output = updatedTask.output as Record<string, unknown> | null
        const error = typeof output?.error === 'string' ? output.error : 'Workflow task failed'
        throw new Error(error)
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    throw new Error('Workflow task timed out')
  }

  start(listenQueues?: string[]): void {
    if (listenQueues) {
      this.executor.setListenQueues(listenQueues)
    }
    this.executor.start()
  }

  close(): void {
    this.executor.close()
  }

  async ensureLaunched(): Promise<void> {
    await this.executor.ensureLaunched()
  }

  async shutdownWorkers(): Promise<void> {
    await this.executor.shutdown()
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
