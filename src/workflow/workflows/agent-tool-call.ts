import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { getActivities, executeActivity, TaskQueueDb } from '../workflow-utils'

export async function agentToolCall(task: WorkflowTask): Promise<void> {
  const { updateTaskStatusActivity, executeAgentToolActivity } = getActivities()

  try {
    // Update status to processing
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'processing',
    })

    const payload = task.payload
    if (!payload || !payload.agentToolCall) {
      throw ApplicationFailure.create({
        message: 'Task payload or agentToolCall is missing',
        nonRetryable: true,
      })
    }

    const { toolName, args, userId } = payload.agentToolCall

    // Execute the database activity on db_queue
    const result = await executeActivity(TaskQueueDb, executeAgentToolActivity, {
      taskId: task.id,
      toolName,
      args,
      userId,
    })

    // Update status to completed with output
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
      output: result,
    })
  } catch (err) {
    console.error(`AgentToolCall failed for task ${task.id}:`, err)

    // Update status to failed
    await executeActivity(TaskQueueDb, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'failed',
      output: { error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}

export const agentToolCallWorkflow = agentToolCall
