import { prisma } from '@/db'
import { WorkflowTaskStatus, AssetStatus } from '@/generated/prisma/client'

export interface UpdateTaskStatusParams {
  taskId: string
  status: WorkflowTaskStatus
  output?: unknown
}

export async function updateTaskStatusActivity(params: UpdateTaskStatusParams): Promise<void> {
  await prisma.workflowTask.update({
    where: { id: params.taskId },
    data: {
      status: params.status,
      output: params.output,
    },
  })
}

export interface UpdateAssetStatusParams {
  assetId: string
  status: AssetStatus
}

export async function updateAssetStatusActivity(params: UpdateAssetStatusParams): Promise<void> {
  await prisma.asset.update({
    where: { id: params.assetId },
    data: { status: params.status },
  })
}

export interface UpdateTaskUsageParams {
  taskId: string
  inputTokens: number
  outputTokens: number
  model: string
}

export async function updateTaskUsageActivity(params: UpdateTaskUsageParams): Promise<void> {
  await prisma.workflowTask.update({
    where: { id: params.taskId },
    data: {
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      model: params.model,
    },
  })
}

export async function getTranscodeWorkerQueueActivity(): Promise<string> {
  return 'transcode_queue'
}

export async function getAgentWorkerQueueActivity(): Promise<string> {
  return 'agent_queue'
}
