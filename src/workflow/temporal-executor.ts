import { Connection, Client } from '@temporalio/client'
import { WorkflowTask, WorkflowTaskType } from '@shumai/db'
import { Executor } from './executor'

export const TASK_QUEUE_DB = 'db_queue'

export class TemporalExecutor implements Executor {
  private client: Client | null = null
  private connection: Connection | null = null

  constructor(private address: string = 'localhost:7233') {}

  async submit(task: WorkflowTask): Promise<string> {
    const client = await this.getClient()
    const workflowId = `${task.type}-${task.id}`

    let workflowName: string
    switch (task.type) {
      case WorkflowTaskType.ai_embedding:
        workflowName = 'agentEmbeddingWorkflow'
        break
      case WorkflowTaskType.query_embedding_for_search:
        workflowName = 'queryEmbeddingForSearch'
        break
      case WorkflowTaskType.ai_metadata_autofill:
        workflowName = 'agentAutofillWorkflow'
        break
      case WorkflowTaskType.chat:
        workflowName = 'agentChatWorkflow'
        break
      case WorkflowTaskType.transcode:
        workflowName = 'transcodeWorkflow'
        break
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    const handle = await client.workflow.start(workflowName, {
      taskQueue: TASK_QUEUE_DB,
      workflowId,
      args: [task],
    })

    return handle.workflowId
  }

  start(): void {
    // Client doesn't need explicit start
  }

  close(): void {
    if (this.connection) {
      this.connection.close()
      this.connection = null
      this.client = null
    }
  }

  private async getClient(): Promise<Client> {
    if (this.client) return this.client
    this.connection = await Connection.connect({ address: this.address })
    this.client = new Client({ connection: this.connection })
    return this.client
  }
}
