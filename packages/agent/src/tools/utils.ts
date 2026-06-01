import { prisma } from '@shumai/db'
import { workflowService } from '@shumai/workflow-core'
import { WorkflowTaskType, WorkflowTaskStatus } from '@shumai/db'

export async function executeAgentToolWorkflow(params: {
  toolName: string
  args: Record<string, unknown>
  userId: string
  assetId: string
}): Promise<unknown> {
  const task = await prisma.workflowTask.create({
    data: {
      type: WorkflowTaskType.agent_tool_call,
      status: WorkflowTaskStatus.pending,
      assetId: params.assetId,
      payload: {
        projectId: 'none',
        agentToolCall: {
          toolName: params.toolName,
          args: params.args,
          userId: params.userId,
        },
      },
    },
  })

  const completedTask = await workflowService.executeWait(task)
  if (completedTask.status === WorkflowTaskStatus.failed) {
    const output = completedTask.output as Record<string, unknown> | null
    const errorMsg = (output?.error as string) || 'Workflow task failed'
    throw new Error(errorMsg)
  }

  return completedTask.output
}
