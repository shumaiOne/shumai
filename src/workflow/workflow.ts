import { WorkflowTask } from '@/generated/prisma/client'
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

  start(): void {
    this.executor.start()
  }

  close(): void {
    this.executor.close()
  }

  // Starts Temporal workers for specific task queues
  async startWorkers(queue: string = 'db_queue'): Promise<void> {
    const type = process.env.WORKFLOW_EXECUTOR || 'local'
    if (type === 'temporal') {
      const { Worker, NativeConnection } = await import('@temporalio/worker')
      const { activities } = await import('./activities/index')

      const connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      })

      // @ts-ignore
      const { default: workflowBundle } = await import('./workflows:::workflow')

      if (queue === 'db_queue') {
        console.log(`Starting Temporal worker for queue: ${queue}`)
        const worker = await Worker.create({
          connection,
          workflowBundle,
          activities,
          taskQueue: queue,
        })
        await worker.run()
        return
      }

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

      const sharedWorker = await Worker.create({
        connection,
        workflowBundle,
        activities: sharedActivities,
        taskQueue: queue,
      })

      const specificWorker = await Worker.create({
        connection,
        // No workflows needed for the unique queue
        activities,
        taskQueue: workerSpecificQueue,
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
