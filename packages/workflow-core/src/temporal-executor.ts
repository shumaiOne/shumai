import { Connection, Client } from '@temporalio/client'
import { WorkflowTask, WorkflowTaskType } from '@shumai/db'
import { Executor } from './executor'
import { TaskQueueAgent, TaskQueueTranscode } from './workflow-utils'

export class TemporalExecutor implements Executor {
  private client: Client | null = null
  private connection: Connection | null = null

  constructor(private address: string = 'localhost:7233') {}

  async submit(task: WorkflowTask): Promise<string> {
    const client = await this.getClient()
    const workflowId = `${task.type}-${task.id}`

    let workflowName: string
    let taskQueue: string

    switch (task.type) {
      case WorkflowTaskType.ai_embedding:
        workflowName = 'agentEmbeddingWorkflow'
        taskQueue = TaskQueueAgent
        break
      case WorkflowTaskType.query_embedding_for_search:
        workflowName = 'queryEmbeddingForSearch'
        taskQueue = TaskQueueAgent
        break
      case WorkflowTaskType.ai_metadata_autofill:
        workflowName = 'agentAutofillWorkflow'
        taskQueue = TaskQueueAgent
        break
      case WorkflowTaskType.chat:
        workflowName = 'agentChatWorkflow'
        taskQueue = TaskQueueAgent
        break
      case WorkflowTaskType.transcode:
        workflowName = 'transcodeWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_video:
        workflowName = 'transcodeVideoWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_image:
        workflowName = 'transcodeImageWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_pdf:
        workflowName = 'transcodePdfWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_pdf_pages:
        workflowName = 'renderPdfPagesWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_screenshot:
        workflowName = 'takeVideoScreenshotsWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_image_annotation:
        workflowName = 'overlayImageAnnotationWorkflow'
        taskQueue = TaskQueueTranscode
        break
      case WorkflowTaskType.transcode_watermark:
        workflowName = 'transcodeWatermarkWorkflow'
        taskQueue = TaskQueueTranscode
        break
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }

    const handle = await client.workflow.start(workflowName, {
      taskQueue,
      workflowId,
      args: [task],
    })

    return handle.workflowId
  }

  async cancel(taskId: string): Promise<void> {
    const client = await this.getClient()
    const workflowId = `chat-${taskId}`
    const handle = client.workflow.getHandle(workflowId)
    await handle.cancel()
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
