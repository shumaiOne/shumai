import {
  prisma,
  cancelWorkflowTask,
  WorkflowTaskStatus,
  type WorkflowTaskType,
  type Prisma,
} from '@shumai/db'
import type { WorkflowTaskItem, ListWorkflowTasksResponse } from '@shumai/dtos'
import { paginateQuery } from '@shumai/core/src/pagination'
import { logger } from '@shumai/core/src/logger'
import { HTTPException } from 'hono/http-exception'

export interface ListWorkflowTasksParams {
  teamId: string
  status?: WorkflowTaskStatus[]
  types?: WorkflowTaskType[]
  first?: number
  after?: string
}

export interface StopWorkflowTaskParams {
  teamId: string
  taskId: string
}

export interface GetBatchWorkflowTaskStatusParams {
  teamId: string
  taskIds: string[]
}

function mapToWorkflowTaskItem(task: {
  id: string
  uid: string
  teamId: string | null
  projectId: string | null
  assetId: string
  type: WorkflowTaskType | null
  status: WorkflowTaskStatus | null
  payload: unknown
  output: unknown
  heartbeat: Date | null
  inputTokens: number
  outputTokens: number
  model: string | null
  sessionId: string | null
  createdAt: Date
  updatedAt: Date
}): WorkflowTaskItem {
  return {
    id: task.id,
    uid: task.uid,
    teamId: task.teamId,
    projectId: task.projectId,
    assetId: task.assetId,
    type: task.type,
    status: task.status,
    payload: task.payload,
    output: task.output,
    heartbeat: task.heartbeat ? task.heartbeat.toISOString() : null,
    inputTokens: task.inputTokens,
    outputTokens: task.outputTokens,
    model: task.model,
    sessionId: task.sessionId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export class WorkflowTaskService {
  async listWorkflowTasks(params: ListWorkflowTasksParams): Promise<ListWorkflowTasksResponse> {
    const teamProjects = await prisma.project.findMany({
      where: { teamId: params.teamId },
      select: { id: true },
    })
    const projectIds = teamProjects.map((p) => p.id)

    const where: Prisma.WorkflowTaskWhereInput = {
      OR: [
        { teamId: params.teamId },
        ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
      ],
    }

    if (params.status && params.status.length > 0) {
      where.status = { in: params.status }
    }

    if (params.types && params.types.length > 0) {
      where.type = { in: params.types }
    }

    const result = await paginateQuery(
      (skip, take) =>
        prisma.workflowTask.findMany({
          where,
          orderBy: { id: 'desc' },
          skip,
          take,
        }),
      () => prisma.workflowTask.count({ where }),
      { first: params.first, after: params.after },
    )

    return {
      nodes: result.data.map(mapToWorkflowTaskItem),
      pageInfo: {
        hasNextPage: !!result.pageInfo.cursor,
        endCursor: result.pageInfo.cursor || null,
      },
      total: result.pageInfo.total ?? 0,
    }
  }

  async getBatchWorkflowTaskStatus(
    params: GetBatchWorkflowTaskStatusParams,
  ): Promise<{ tasks: WorkflowTaskItem[] }> {
    if (!params.taskIds || params.taskIds.length === 0) {
      return { tasks: [] }
    }

    const teamProjects = await prisma.project.findMany({
      where: { teamId: params.teamId },
      select: { id: true },
    })
    const projectIds = teamProjects.map((p) => p.id)

    const tasks = await prisma.workflowTask.findMany({
      where: {
        id: { in: params.taskIds },
        OR: [
          { teamId: params.teamId },
          ...(projectIds.length > 0 ? [{ projectId: { in: projectIds } }] : []),
        ],
      },
      orderBy: { id: 'desc' },
    })

    return { tasks: tasks.map(mapToWorkflowTaskItem) }
  }

  async stopWorkflowTask(
    params: StopWorkflowTaskParams,
  ): Promise<{ success: boolean; task: WorkflowTaskItem }> {
    const task = await prisma.workflowTask.findUnique({
      where: { id: params.taskId },
    })

    if (!task) {
      throw new HTTPException(404, { message: 'Workflow task not found' })
    }

    // Verify task belongs to this team (either directly or via project)
    let belongsToTeam = task.teamId === params.teamId
    if (!belongsToTeam && task.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: task.projectId },
        select: { teamId: true },
      })
      if (project?.teamId === params.teamId) {
        belongsToTeam = true
      }
    }

    if (!belongsToTeam) {
      throw new HTTPException(403, { message: 'Permission denied: Task does not belong to team' })
    }

    if (
      task.status !== WorkflowTaskStatus.pending &&
      task.status !== WorkflowTaskStatus.processing
    ) {
      throw new HTTPException(400, {
        message: `Only pending or processing tasks can be stopped. Current status: ${task.status}`,
      })
    }

    // Notify workflow engine (DBOS) to cancel workflow execution
    try {
      await cancelWorkflowTask(task.id)
    } catch (err) {
      logger.warn(
        { taskId: task.id, err },
        'Failed to trigger cancelWorkflowTask in engine, proceeding with DB update',
      )
    }

    const prevOutput =
      typeof task.output === 'object' && task.output !== null
        ? (task.output as Record<string, unknown>)
        : {}
    const updated = await prisma.workflowTask.update({
      where: { id: task.id },
      data: {
        status: WorkflowTaskStatus.failed,
        output: {
          ...prevOutput,
          error: 'Task was stopped by user',
        },
      },
    })

    logger.info({ taskId: task.id, teamId: params.teamId }, 'Workflow task stopped by user')

    return {
      success: true,
      task: mapToWorkflowTaskItem(updated),
    }
  }
}

export const workflowTaskService = new WorkflowTaskService()
