import type { WorkflowTask } from '@shumai/db'
import { getActivities, executeActivity, TaskQueueAgent } from '@shumai/workflow-core'

export async function queryEmbeddingForSearch(task: WorkflowTask): Promise<void> {
  const { generateTextEmbeddingActivity, updateWorkflowTaskActivity, getAgentWorkerQueueActivity } =
    getActivities()

  let agentWorkerQueue = ''

  const payload = task.payload as PrismaJson.WorkflowTaskPayload | null
  const text = payload?.queryEmbeddingForSearch?.text

  if (!text) {
    throw new Error('Missing text in query_embedding_for_search task payload')
  }

  try {
    // 0. Discover queue
    agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    // 1. Mark as processing
    await executeActivity(agentWorkerQueue, updateWorkflowTaskActivity, {
      taskId: task.id,
      status: 'processing',
      heartbeat: true,
    })

    // 2. Generate embedding
    const result = await executeActivity(agentWorkerQueue, generateTextEmbeddingActivity, {
      text,
      teamId: task.teamId!,
    })

    // 3. Save output and complete
    await executeActivity(agentWorkerQueue, updateWorkflowTaskActivity, {
      taskId: task.id,
      status: 'completed',
      output: { embedding: result.embedding },
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      model: result.usage.model,
    })
  } catch (err) {
    console.error(`queryEmbeddingForSearch failed for task ${task.id}:`, err)
    if (agentWorkerQueue) {
      await executeActivity(agentWorkerQueue, updateWorkflowTaskActivity, {
        taskId: task.id,
        status: 'failed',
        output: {
          error: err instanceof Error ? err.message : String(err),
        },
      })
    }
    throw err
  }
}
