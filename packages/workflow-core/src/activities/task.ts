import { prisma } from '@shumai/db'
import { WorkflowTaskStatus, AssetStatus, AssetType, Prisma } from '@shumai/db'

export async function getTranscodeWorkerQueueActivity(): Promise<string> {
  return 'transcode_queue'
}

export async function getAgentWorkerQueueActivity(): Promise<string> {
  return 'agent_queue'
}

export async function getAssetStatusActivity(params: {
  assetId: string
}): Promise<AssetStatus | null> {
  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: { status: true },
  })
  return asset?.status || null
}

export async function getAssetActivity(assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      storageKey: true,
      project: {
        include: {
          team: true,
        },
      },
    },
  })

  if (asset && asset.type === AssetType.version_stack) {
    const latestVersion = await prisma.asset.findFirst({
      where: { parentId: asset.id, isDeleted: false },
      orderBy: { sortIndex: 'asc' },
      include: {
        storageKey: true,
        project: {
          include: {
            team: true,
          },
        },
      },
    })

    if (latestVersion) {
      return {
        ...latestVersion,
        project: latestVersion.project ?? asset.project,
      }
    }
  }

  return asset
}

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
      output: params.output as Prisma.InputJsonValue,
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

export interface UpdateWorkflowTaskParams {
  taskId: string
  status?: WorkflowTaskStatus
  heartbeat?: boolean
  output?: unknown
  inputTokens?: number
  outputTokens?: number
  model?: string | null
}

export async function updateWorkflowTaskActivity(params: UpdateWorkflowTaskParams): Promise<void> {
  await prisma.workflowTask.update({
    where: { id: params.taskId },
    data: {
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.heartbeat ? { heartbeat: new Date() } : {}),
      ...(params.output !== undefined ? { output: params.output as Prisma.InputJsonValue } : {}),
      ...(params.inputTokens !== undefined ? { inputTokens: params.inputTokens } : {}),
      ...(params.outputTokens !== undefined ? { outputTokens: params.outputTokens } : {}),
      ...(params.model !== undefined ? { model: params.model } : {}),
    },
  })
}
