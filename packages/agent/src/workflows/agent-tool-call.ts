import { ApplicationFailure } from '@temporalio/workflow'
import type { WorkflowTask } from '@shumai/db'
import { getActivities, executeActivity, TaskQueueAgent } from '@shumai/workflow-core'

export async function agentToolCall(task: WorkflowTask): Promise<void> {
  const { updateTaskStatusActivity, executeAgentToolActivity, getAgentWorkerQueueActivity } =
    getActivities()

  let agentWorkerQueue = ''

  try {
    // 0. Discover queue
    agentWorkerQueue = await executeActivity(TaskQueueAgent, getAgentWorkerQueueActivity)

    // Update status to processing
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
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

    // Execute the agent activity on specific queue
    const result = await executeActivity(agentWorkerQueue, executeAgentToolActivity, {
      taskId: task.id,
      toolName,
      args,
      userId,
    })

    // Update status to completed with output
    await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
      taskId: task.id,
      status: 'completed',
      output: result,
    })
  } catch (err) {
    console.error(`AgentToolCall failed for task ${task.id}:`, err)

    // Update status to failed
    if (agentWorkerQueue) {
      await executeActivity(agentWorkerQueue, updateTaskStatusActivity, {
        taskId: task.id,
        status: 'failed',
        output: { error: err instanceof Error ? err.message : String(err) },
      })
    }
    throw err
  }
}

export const agentToolCallWorkflow = agentToolCall
