import { prisma, registerWorkflowTrigger, WorkflowTask } from '@shumai/db'
import path from 'path'
import * as taskActivities from './activities/task'
import { Executor } from './executor'
import { LocalExecutor } from './local-executor'
import { TemporalExecutor } from './temporal-executor'

export class WorkflowService {
  private executor: Executor

  constructor() {
    const type = process.env.WORKFLOW_EXECUTOR || 'local'
    if (type === 'temporal') {
      this.executor = new TemporalExecutor(process.env.TEMPORAL_ADDRESS)
    } else {
      this.executor = new LocalExecutor()
    }
  }

  async submit(task: WorkflowTask): Promise<string> {
    return this.executor.submit(task)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = (updatedTask.output as any)?.error || 'Workflow task failed'
        throw new Error(error)
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error('Workflow task timed out')
  }

  start(): void {
    this.executor.start()
  }

  close(): void {
    this.executor.close()
  }

  // Starts Temporal workers for specific task queues
  async startWorkers(
    queue: string,
    options: { workflowBundle?: unknown; workflowsPath?: string } = {},
  ): Promise<void> {
    const type = process.env.WORKFLOW_EXECUTOR || 'local'
    if (type === 'temporal') {
      const { Worker, NativeConnection } = await import('@temporalio/worker')

      const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activities = (globalThis as any).__localActivities

      // For agent_queue and transcode_queue, use worker-specific unique queues
      const crypto = await import('crypto')
      const workerId = crypto.randomUUID()
      const workerSpecificQueue = `${queue}-${workerId}`

      console.log(`Starting Temporal workers for domain: ${queue}`)
      console.log(`  - Shared queue: ${queue}`)
      console.log(`  - Worker-specific queue: ${workerSpecificQueue}`)

      // Create a specific activities object for the shared worker that ONLY overrides the queue lookup
      const sharedActivities: Record<string, unknown> = {}
      if (queue === 'agent_queue') {
        sharedActivities.getAgentWorkerQueueActivity = async () => workerSpecificQueue
      } else if (queue === 'transcode_queue') {
        sharedActivities.getTranscodeWorkerQueueActivity = async () => workerSpecificQueue
      }

      const { workflowBundle, workflowsPath } = options

      const sharedWorker = await Worker.create({
        connection,
        // The workflowBundle is a pre-bundled set of workflows, its internal structure
        // is managed by the Temporal worker and doesn't need explicit typing here.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(workflowBundle ? { workflowBundle: workflowBundle as any } : {}),
        ...(workflowsPath ? { workflowsPath } : {}),
        activities: sharedActivities,
        taskQueue: queue,

        bundlerOptions: {
          webpackConfigHook: (config) => {
            config.resolve = config.resolve || {}
            config.resolve.alias = {
              ...config.resolve.alias,
              // Find the exact absolute path to the package directory
              '@temporalio/workflow': path.dirname(
                require.resolve('@temporalio/workflow/package.json'),
              ),
              '@shumai/workflow-core': require.resolve('./workflow-utils'),
            }
            return config
          },
        },
      })

      const specificWorker = await Worker.create({
        connection,
        // Register both domain-specific activities and shared task activities
        activities: { ...activities, ...taskActivities },
        taskQueue: workerSpecificQueue,
        bundlerOptions: {
          webpackConfigHook: (config) => {
            config.resolve = config.resolve || {}
            config.resolve.alias = {
              ...config.resolve.alias,
              // Find the exact absolute path to the package directory
              '@temporalio/workflow': path.dirname(
                require.resolve('@temporalio/workflow/package.json'),
              ),
              '@shumai/workflow-core': require.resolve('./workflow-utils'),
            }
            return config
          },
        },
      })

      await Promise.all([sharedWorker.run(), specificWorker.run()])
    } else {
      console.log(
        `Workflow executor is set to "${type}". Separate worker processes are only needed for "temporal" mode.`,
      )
    }
  }
}

export const workflowService = new WorkflowService()
registerWorkflowTrigger(async (task) => {
  await workflowService.submit(task)
})
