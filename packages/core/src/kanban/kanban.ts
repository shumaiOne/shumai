import { prisma, type TeamMemberRole, type Prisma, AssetType } from '@shumai/db'
import { KanbanTaskStatus, KanbanTaskPriority, KanbanTaskEventType } from '@shumai/db/enums'
import { HTTPException } from 'hono/http-exception'
import { ulid } from 'ulid'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { paginateQuery } from '../pagination'
import { getAvatarUrl } from '../user/avatar'
import { s3Service } from '../s3/s3'
import { getProxyType } from '../utils/mime'
import { sanitizeFilename } from '../utils/filename'
import { assetService } from '../asset/asset'
import type {
  CreateKanbanGoalRequest,
  UpdateKanbanGoalRequest,
  ListKanbanGoalsRequest,
  CreateKanbanTaskRequest,
  UpdateKanbanTaskRequest,
  ListKanbanTasksRequest,
  KanbanTaskInfo,
  KanbanTaskDetail,
  KanbanTaskAssetInfo,
  KanbanStatusEventInfo,
  KanbanCommentInfo,
  KanbanAttachmentInfo,
  KanbanAttachmentPayload,
  PostKanbanAttachmentResponse,
  KanbanEventInfo,
  KanbanGoalInfo,
} from '@shumai/dtos'
import { UNASSIGNED_GOAL_ID } from '@shumai/dtos'

type TaskEventWithActor = Prisma.KanbanTaskEventGetPayload<{ include: { actor: true } }>

function dependencyEventParentId(event: TaskEventWithActor): string | undefined {
  if (
    event.type === KanbanTaskEventType.DEPENDENCY_ADDED ||
    event.type === KanbanTaskEventType.DEPENDENCY_REMOVED
  ) {
    const parentId = event.data?.parentId
    if (typeof parentId === 'string') return parentId
  }
}

function taskRelationCountSelect(
  taskFilter: Prisma.KanbanTaskWhereInput | undefined,
): Prisma.KanbanTaskCountOutputTypeSelect {
  return {
    comments: true,
    assets: true,
    dependencies: taskFilter ? { where: { parent: taskFilter } } : true,
    dependents: taskFilter ? { where: { child: taskFilter } } : true,
  }
}

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

function isSafeKeySegment(segment: string): boolean {
  // eslint-disable-next-line no-control-regex
  return segment !== '' && segment !== '.' && segment !== '..' && !/[\\\x00-\x1f\x7f]/.test(segment)
}

/**
 * Parses a comment attachment key issued by `createAttachment`:
 * `kanban/attachments/<teamId>/<uploaderId>/<ulid>/<file name>`.
 */
function parseAttachmentKey(key: string): { teamId: string; uploaderId: string } | null {
  const parts = key.split('/')
  if (
    parts.length !== 6 ||
    parts[0] !== 'kanban' ||
    parts[1] !== 'attachments' ||
    !isSafeKeySegment(parts[2]) ||
    !isSafeKeySegment(parts[3]) ||
    !ULID_PATTERN.test(parts[4]) ||
    !isSafeKeySegment(parts[5])
  ) {
    return null
  }
  return { teamId: parts[2], uploaderId: parts[3] }
}

/** Keys of comment attachments stored before keys carried the team and uploader. */
function isLegacyAttachmentKey(key: string): boolean {
  const parts = key.split('/')
  return (
    parts.length === 4 &&
    parts[0] === 'kanban' &&
    parts[1] === 'attachments' &&
    ULID_PATTERN.test(parts[2]) &&
    isSafeKeySegment(parts[3])
  )
}

/** Whether a stored attachment key may be signed for a comment on a task in `teamId`. */
function isReadableAttachmentKey(key: string, teamId: string): boolean {
  return parseAttachmentKey(key)?.teamId === teamId || isLegacyAttachmentKey(key)
}

export class KanbanService {
  // --------------------------------------------------------------------------
  // Goal CRUD
  // --------------------------------------------------------------------------

  async createGoal(
    teamId: string,
    req: CreateKanbanGoalRequest,
    creatorId?: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanGoalInfo> {
    if (callerRole !== 'owner') {
      throw new HTTPException(403, { message: 'Only team owners can create goals' })
    }

    const goal = await prisma.kanbanGoal.create({
      data: {
        teamId,
        title: req.title,
        description: req.description,
        creatorId,
      },
    })

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      teamId: goal.teamId,
      creatorId: goal.creatorId,
      taskCount: 0,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    }
  }

  async getGoal(goalId: string): Promise<KanbanGoalInfo> {
    const goal = await prisma.kanbanGoal.findUnique({
      where: { id: goalId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })
    if (!goal) {
      throw new HTTPException(404, { message: 'Goal not found' })
    }

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      teamId: goal.teamId,
      creatorId: goal.creatorId,
      taskCount: goal._count.tasks,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    }
  }

  async updateGoal(
    goalId: string,
    req: UpdateKanbanGoalRequest,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanGoalInfo> {
    if (callerRole !== 'owner') {
      throw new HTTPException(403, { message: 'Only team owners can update goals' })
    }

    if (goalId === UNASSIGNED_GOAL_ID) {
      throw new HTTPException(400, { message: 'Cannot edit or delete the unassigned goal' })
    }

    const existing = await prisma.kanbanGoal.findUnique({ where: { id: goalId } })
    if (!existing) {
      throw new HTTPException(404, { message: 'Goal not found' })
    }

    const goal = await prisma.kanbanGoal.update({
      where: { id: goalId },
      data: {
        ...(req.title !== undefined && { title: req.title }),
        ...(req.description !== undefined && { description: req.description }),
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      teamId: goal.teamId,
      creatorId: goal.creatorId,
      taskCount: goal._count.tasks,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    }
  }

  async deleteGoal(goalId: string, callerRole?: TeamMemberRole | null): Promise<void> {
    if (callerRole !== 'owner') {
      throw new HTTPException(403, { message: 'Only team owners can delete goals' })
    }

    if (goalId === UNASSIGNED_GOAL_ID) {
      throw new HTTPException(400, { message: 'Cannot edit or delete the unassigned goal' })
    }

    const existing = await prisma.kanbanGoal.findUnique({ where: { id: goalId } })
    if (!existing) {
      throw new HTTPException(404, { message: 'Goal not found' })
    }

    await prisma.kanbanGoal.delete({ where: { id: goalId } })
  }

  async listGoals(
    teamId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _req?: ListKanbanGoalsRequest,
  ): Promise<KanbanGoalInfo[]> {
    const [goals, unassignedCount] = await Promise.all([
      prisma.kanbanGoal.findMany({
        where: { teamId },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { id: 'desc' },
      }),
      prisma.kanbanTask.count({
        where: { teamId, goalId: null },
      }),
    ])

    const unassignedGoal: KanbanGoalInfo = {
      id: UNASSIGNED_GOAL_ID,
      title: 'Unassigned',
      description: null,
      teamId,
      creatorId: null,
      taskCount: unassignedCount,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }

    const goalInfos = goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      teamId: g.teamId,
      creatorId: g.creatorId,
      taskCount: g._count.tasks,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }))

    return [unassignedGoal, ...goalInfos]
  }

  // --------------------------------------------------------------------------
  // Task CRUD & Queries
  // --------------------------------------------------------------------------

  async createTask(
    teamId: string,
    req: CreateKanbanTaskRequest,
    creatorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    if (callerRole !== 'owner' && callerRole !== 'editor') {
      throw new HTTPException(403, { message: 'Only team owners and editors can create tasks' })
    }

    const parentIds = req.parentIds ? [...new Set(req.parentIds)] : []
    if (parentIds.length > 0) {
      const parents = await prisma.kanbanTask.findMany({
        where: { id: { in: parentIds }, teamId },
      })
      if (parents.length !== parentIds.length) {
        throw new HTTPException(400, { message: 'One or more parent tasks were not found' })
      }
    }

    const assetIds = req.assetIds ? [...new Set(req.assetIds)] : []

    const initialStatus: KanbanTaskStatus = KanbanTaskStatus.TODO

    const task = await prisma.$transaction(async (tx) => {
      const lastTask = await tx.kanbanTask.findFirst({
        where: { teamId, status: initialStatus, sortIndex: { not: null } },
        orderBy: { sortIndex: 'desc' },
      })
      const sortIndex = generateKeyBetween(lastTask?.sortIndex || null, null)

      const effectiveReporterId = req.reporterId || creatorId

      const created = await tx.kanbanTask.create({
        data: {
          teamId,
          title: req.title,
          description: req.description,
          isAgentTask: req.isAgentTask ?? false,
          status: initialStatus,
          priority: req.priority ?? KanbanTaskPriority.MEDIUM,
          startDate: req.startDate ? new Date(req.startDate) : null,
          dueDate: req.dueDate ? new Date(req.dueDate) : null,
          goalId: req.goalId,
          projectId: req.projectId,
          reporterId: effectiveReporterId,
          assigneeId: req.assigneeId,
          targetFolderId: req.targetFolderId,
          creatorId,
          sortIndex,
        },
        include: {
          creator: true,
          reporter: true,
          assignee: true,
          goal: true,
        },
      })

      // Link parents
      if (parentIds.length > 0) {
        await tx.kanbanTaskLink.createMany({
          data: parentIds.map((parentId) => ({
            parentId,
            childId: created.id,
          })),
        })
      }

      // Link assets
      if (assetIds.length > 0) {
        await tx.kanbanTaskAsset.createMany({
          data: assetIds.map((assetId) => ({
            taskId: created.id,
            assetId,
          })),
          skipDuplicates: true,
        })
      }

      // Log creation event
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: created.id,
          actorId: creatorId,
          type: KanbanTaskEventType.CREATED,
          toStatus: initialStatus,
          data: {
            parentCount: parentIds.length,
            assetCount: assetIds.length,
          },
        },
      })

      return created
    })

    const creatorImage = await getAvatarUrl(task.creator.image)
    return await this.toTaskInfo(task, {
      latestStatusEvent: {
        id: 'init',
        type: KanbanTaskEventType.CREATED,
        actor: {
          id: task.creator.id,
          name: task.creator.name,
          image: creatorImage,
        },
        createdAt: task.createdAt.toISOString(),
      },
      dependencyCount: parentIds.length,
      dependentCount: 0,
      commentCount: 0,
      assetCount: assetIds.length,
    })
  }

  async getTask(taskId: string, viewerId?: string): Promise<KanbanTaskDetail> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        creator: true,
        reporter: true,
        assignee: true,
        goal: true,
        dependencies: {
          include: { parent: true },
        },
        dependents: {
          include: { child: true },
        },
        assets: {
          include: {
            asset: {
              include: {
                creator: true,
                storageKey: true,
                project: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          include: { actor: true },
        },
      },
    })

    if (!task) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    const readableIds = await this.readableRelatedTaskIds(task.teamId, viewerId, [
      ...task.dependencies.map((link) => link.parentId),
      ...task.dependents.map((link) => link.childId),
      ...task.events.map(dependencyEventParentId).filter((id) => id !== undefined),
    ])
    const dependencies = task.dependencies.filter(
      (link) => !readableIds || readableIds.has(link.parentId),
    )
    const dependents = task.dependents.filter(
      (link) => !readableIds || readableIds.has(link.childId),
    )
    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, task.status)
    const resolvedAssets = await this.resolveTaskAssetInfos(task.assets)

    const baseInfo = await this.toTaskInfo(task, {
      latestStatusEvent,
      dependencyCount: dependencies.length,
      dependentCount: dependents.length,
      commentCount: task.comments.length,
      assetCount: task.assets.length,
    })

    return {
      ...baseInfo,
      dependencies: dependencies.map((d) => ({
        id: d.parent.id,
        title: d.parent.title,
        isAgentTask: d.parent.isAgentTask,
        status: d.parent.status,
        priority: d.parent.priority,
      })),
      dependents: dependents.map((d) => ({
        id: d.child.id,
        title: d.child.title,
        isAgentTask: d.child.isAgentTask,
        status: d.child.status,
        priority: d.child.priority,
      })),
      assets: resolvedAssets,
      comments: await Promise.all(
        task.comments.map(async (c) => ({
          id: c.id,
          taskId: c.taskId,
          author: {
            id: c.author.id,
            name: c.author.name,
            image: await getAvatarUrl(c.author.image),
          },
          body: c.body,
          attachments: await this.resolveCommentAttachments(c.attachments, task.teamId),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      ),
      events: await this.resolveTaskEvents(task.events, readableIds),
    }
  }

  async updateTask(
    taskId: string,
    req: UpdateKanbanTaskRequest,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    const isOwner = callerRole === 'owner'
    const isEditor = callerRole === 'editor'

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.kanbanTask.findUnique({
        where: { id: taskId },
        include: {
          creator: true,
          reporter: true,
          assignee: true,
          goal: true,
        },
      })
      if (!current) {
        throw new HTTPException(404, { message: 'Task not found' })
      }

      // CAS status validation: ensure task status has not changed concurrently
      if (req.fromStatus !== undefined && current.status !== req.fromStatus) {
        throw new HTTPException(409, {
          message: 'Task status has been modified by another user. Please refresh.',
        })
      }

      const isReporter = current.reporterId === actorId || current.creatorId === actorId
      const isAssignee = current.assigneeId === actorId

      // Status change permission check: owner, editor, reporter, or assignee can change task status
      if (req.status !== undefined && req.status !== current.status) {
        if (!isOwner && !isEditor && !isReporter && !isAssignee) {
          throw new HTTPException(403, {
            message:
              'Only team owners, editors, task reporters, or assignees can change task status',
          })
        }
      }

      // General edit permission check for other fields: must be owner, editor, reporter, or assignee
      if (!isOwner && !isEditor && !isReporter && !isAssignee) {
        throw new HTTPException(403, { message: 'Permission denied' })
      }

      // Status transition calculation if status changed
      const targetStatus: KanbanTaskStatus | undefined = req.status
      let completedAtUpdate: Date | null | undefined = undefined
      let startedAtUpdate: Date | null | undefined = undefined
      let statusEventType: KanbanTaskEventType = KanbanTaskEventType.STATUS_CHANGED
      let statusEventData: Record<string, unknown> | undefined = undefined

      if (req.status !== undefined && req.status !== current.status) {
        switch (req.status) {
          case KanbanTaskStatus.DONE: {
            completedAtUpdate = new Date()
            statusEventType = KanbanTaskEventType.STATUS_CHANGED
            if (current.status === KanbanTaskStatus.IN_REVIEW) {
              statusEventData = { summary: 'Approved by reviewer' }
            }
            break
          }
          case KanbanTaskStatus.IN_PROGRESS: {
            if (current.status === KanbanTaskStatus.DONE) {
              completedAtUpdate = null
            }
            startedAtUpdate = current.startedAt ?? new Date()
            statusEventType = KanbanTaskEventType.STATUS_CHANGED
            break
          }
          case KanbanTaskStatus.IN_REVIEW: {
            if (current.status === KanbanTaskStatus.DONE) {
              completedAtUpdate = null
            }
            statusEventType = KanbanTaskEventType.STATUS_CHANGED
            break
          }
          case KanbanTaskStatus.BLOCKED: {
            if (current.status === KanbanTaskStatus.DONE) {
              completedAtUpdate = null
            }
            statusEventType = KanbanTaskEventType.BLOCKED
            statusEventData = req.reason ? { reason: req.reason } : undefined
            break
          }
          case KanbanTaskStatus.TODO:
          case KanbanTaskStatus.READY: {
            if (current.status === KanbanTaskStatus.DONE) {
              completedAtUpdate = null
            }
            if (current.status === KanbanTaskStatus.BLOCKED) {
              statusEventType = KanbanTaskEventType.UNBLOCKED
            } else if (current.status === KanbanTaskStatus.IN_REVIEW && req.reason) {
              statusEventType = KanbanTaskEventType.CHANGES_REQUESTED
              statusEventData = { reason: req.reason }
            } else {
              statusEventType = KanbanTaskEventType.STATUS_CHANGED
            }
            break
          }
        }
      }

      const finalStatus = targetStatus ?? current.status
      let newSortIndex: string | undefined = undefined

      if (req.beforeIndex !== undefined) {
        const prevTask = await tx.kanbanTask.findFirst({
          where: {
            teamId: current.teamId,
            status: finalStatus,
            sortIndex: { lt: req.beforeIndex, not: null },
            id: { not: taskId },
          },
          orderBy: { sortIndex: 'desc' },
        })
        newSortIndex = generateKeyBetween(prevTask?.sortIndex || null, req.beforeIndex)
      } else if (req.afterIndex !== undefined) {
        const nextTask = await tx.kanbanTask.findFirst({
          where: {
            teamId: current.teamId,
            status: finalStatus,
            sortIndex: { gt: req.afterIndex, not: null },
            id: { not: taskId },
          },
          orderBy: { sortIndex: 'asc' },
        })
        newSortIndex = generateKeyBetween(req.afterIndex, nextTask?.sortIndex || null)
      } else if (req.status !== undefined && req.status !== current.status) {
        const lastTask = await tx.kanbanTask.findFirst({
          where: {
            teamId: current.teamId,
            status: finalStatus,
            id: { not: taskId },
            sortIndex: { not: null },
          },
          orderBy: { sortIndex: 'desc' },
        })
        newSortIndex = generateKeyBetween(lastTask?.sortIndex || null, null)
      }

      const task = await tx.kanbanTask.update({
        where: { id: taskId },
        data: {
          ...(req.title !== undefined && { title: req.title }),
          ...(req.description !== undefined && { description: req.description }),
          ...(targetStatus !== undefined && { status: targetStatus }),
          ...(completedAtUpdate !== undefined && { completedAt: completedAtUpdate }),
          ...(startedAtUpdate !== undefined && { startedAt: startedAtUpdate }),
          ...(req.priority !== undefined && { priority: req.priority }),
          ...(req.startDate !== undefined && {
            startDate: req.startDate ? new Date(req.startDate) : null,
          }),
          ...(req.dueDate !== undefined && {
            dueDate: req.dueDate ? new Date(req.dueDate) : null,
          }),
          ...(req.goalId !== undefined && { goalId: req.goalId }),
          ...(req.projectId !== undefined && { projectId: req.projectId }),
          ...(req.reporterId !== undefined && { reporterId: req.reporterId }),
          ...(req.assigneeId !== undefined && { assigneeId: req.assigneeId }),
          ...(req.targetFolderId !== undefined && { targetFolderId: req.targetFolderId }),
          ...(newSortIndex !== undefined && { sortIndex: newSortIndex }),
        },
        include: { creator: true, reporter: true, assignee: true, goal: true },
      })

      if (req.status !== undefined && req.status !== current.status) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: statusEventType,
            fromStatus: current.status,
            toStatus: targetStatus!,
            data: statusEventData ?? (req.reason ? { reason: req.reason } : undefined),
          },
        })
      }

      // Log specific events if critical fields changed
      if (req.priority !== undefined && req.priority !== current.priority) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: KanbanTaskEventType.PRIORITY_CHANGED,
            data: { from: current.priority, to: req.priority },
          },
        })
      }
      if (req.goalId !== undefined && req.goalId !== current.goalId) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: KanbanTaskEventType.GOAL_CHANGED,
            data: { from: current.goalId, to: req.goalId },
          },
        })
      }
      if (req.assigneeId !== undefined && req.assigneeId !== current.assigneeId) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: req.assigneeId ? KanbanTaskEventType.ASSIGNED : KanbanTaskEventType.UNASSIGNED,
            data: { from: current.assigneeId, to: req.assigneeId },
          },
        })
      }

      if (req.assetIds !== undefined) {
        const distinctAssetIds = [...new Set(req.assetIds)]
        await tx.kanbanTaskAsset.deleteMany({
          where: {
            taskId,
            assetId: { notIn: distinctAssetIds },
          },
        })
        if (distinctAssetIds.length > 0) {
          await tx.kanbanTaskAsset.createMany({
            data: distinctAssetIds.map((assetId) => ({
              taskId,
              assetId,
            })),
            skipDuplicates: true,
          })
        }
      }

      return task
    })

    if (req.parentIds !== undefined) {
      await this.setDependencies(taskId, req.parentIds, actorId)
    }

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const taskFilter = await this.readableTaskFilter(updated.teamId, actorId)
    const counts = await this.getTaskCounts(taskId, taskFilter)

    return await this.toTaskInfo(updated, {
      latestStatusEvent,
      ...counts,
    })
  }

  async deleteTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    const existing = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        creator: true,
        reporter: true,
        assignee: true,
        goal: true,
      },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    const isOwner = callerRole === 'owner'
    const isCreator = existing.creatorId === actorId
    const isReporter = existing.reporterId === actorId

    if (!isOwner && !isCreator && !isReporter) {
      throw new HTTPException(403, {
        message: 'Only team owners, task creators, or reporters can delete tasks',
      })
    }

    const taskInfo = await this.toTaskInfo(existing, {})

    await prisma.kanbanTask.delete({
      where: { id: taskId },
    })

    return taskInfo
  }

  /**
   * Limits kanban tasks to those a user may read. Team-scoped members see every
   * task in the team; project-scoped members see tasks in the projects they
   * belong to and tasks they created, report, or are assigned to.
   */
  private async readableTaskFilter(
    teamId: string,
    userId: string | undefined,
  ): Promise<Prisma.KanbanTaskWhereInput | undefined> {
    if (!userId) return
    const member = await prisma.teamMember.findUnique({
      where: { teamIdUserId: { teamId, userId } },
    })
    if (!member) return { id: { in: [] } }
    if (member.scope === 'team') return
    return {
      teamId,
      OR: [
        { project: { members: { some: { teamMemberId: member.id } } } },
        { creatorId: userId },
        { reporterId: userId },
        { assigneeId: userId },
      ],
    }
  }

  private async readableRelatedTaskIds(
    teamId: string,
    viewerId: string | undefined,
    relatedIds: string[],
  ): Promise<Set<string> | undefined> {
    if (relatedIds.length === 0) return
    const filter = await this.readableTaskFilter(teamId, viewerId)
    if (!filter) return

    const tasks = await prisma.kanbanTask.findMany({
      where: { id: { in: [...new Set(relatedIds)] }, AND: [filter] },
      select: { id: true },
    })
    return new Set(tasks.map((task) => task.id))
  }

  async listTasks(
    teamId: string,
    params: ListKanbanTasksRequest,
    viewerId?: string,
  ): Promise<{ data: KanbanTaskInfo[]; pageInfo: { total?: number; cursor?: string } }> {
    const taskFilter = await this.readableTaskFilter(teamId, viewerId)
    const where: Prisma.KanbanTaskWhereInput = {
      teamId,
      ...(params.status && { status: params.status }),
      ...(params.isAgentTask !== undefined && { isAgentTask: params.isAgentTask }),
      ...(params.goalId === UNASSIGNED_GOAL_ID
        ? { goalId: null }
        : params.goalId
          ? { goalId: params.goalId }
          : {}),
      ...(params.projectId && { projectId: params.projectId }),
      ...(params.priority && { priority: params.priority }),
      ...(params.assigneeId && { assigneeId: params.assigneeId }),
      ...(params.reporterId && { reporterId: params.reporterId }),
      ...(taskFilter && { AND: [taskFilter] }),
    }

    return await paginateQuery(
      async (skip, take) => {
        const tasks = await prisma.kanbanTask.findMany({
          where,
          include: {
            creator: true,
            reporter: true,
            assignee: true,
            goal: true,
            _count: { select: taskRelationCountSelect(taskFilter) },
          },
          orderBy: [{ sortIndex: 'asc' }, { id: 'asc' }],
          skip,
          take,
        })

        return await Promise.all(
          tasks.map(async (t) => {
            const latestStatusEvent = await this.resolveLatestStatusEvent(t.id, t.status)
            return await this.toTaskInfo(t, {
              latestStatusEvent,
              commentCount: t._count.comments,
              dependencyCount: t._count.dependencies,
              dependentCount: t._count.dependents,
              assetCount: t._count.assets,
            })
          }),
        )
      },
      () => prisma.kanbanTask.count({ where }),
      params,
    )
  }

  // --------------------------------------------------------------------------
  // DAG Dependency Management & Cycles
  // --------------------------------------------------------------------------

  async setDependencies(taskId: string, parentIds: string[], actorId?: string): Promise<void> {
    const distinctParentIds = [...new Set(parentIds)]
    if (distinctParentIds.includes(taskId)) {
      throw new HTTPException(400, { message: 'Task cannot depend on itself' })
    }

    const task = await prisma.kanbanTask.findUnique({ where: { id: taskId } })
    if (!task) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    if (distinctParentIds.length > 0) {
      const parents = await prisma.kanbanTask.findMany({
        where: { id: { in: distinctParentIds }, teamId: task.teamId },
      })
      if (parents.length !== distinctParentIds.length) {
        throw new HTTPException(400, { message: 'One or more parent tasks were not found' })
      }
    }

    const currentLinks = await prisma.kanbanTaskLink.findMany({
      where: { childId: taskId },
    })
    const currentParentIds = new Set(currentLinks.map((l) => l.parentId))
    const toAdd = distinctParentIds.filter((p) => !currentParentIds.has(p))
    const toRemove = [...currentParentIds].filter((p) => !distinctParentIds.includes(p))

    for (const parentId of toAdd) {
      const wouldCreateCycle = await this.pathExists(taskId, parentId)
      if (wouldCreateCycle) {
        throw new HTTPException(400, {
          message: 'Circular dependency detected: adding this dependency would create a cycle',
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.kanbanTaskLink.deleteMany({
          where: { childId: taskId, parentId: { in: toRemove } },
        })
        for (const parentId of toRemove) {
          await tx.kanbanTaskEvent.create({
            data: {
              taskId,
              actorId,
              type: KanbanTaskEventType.DEPENDENCY_REMOVED,
              data: { parentId },
            },
          })
        }
      }

      if (toAdd.length > 0) {
        await tx.kanbanTaskLink.createMany({
          data: toAdd.map((parentId) => ({ parentId, childId: taskId })),
        })
        for (const parentId of toAdd) {
          await tx.kanbanTaskEvent.create({
            data: {
              taskId,
              actorId,
              type: KanbanTaskEventType.DEPENDENCY_ADDED,
              data: { parentId },
            },
          })
        }
      }
    })
  }

  private async pathExists(fromId: string, toId: string): Promise<boolean> {
    if (fromId === toId) return true
    const visited = new Set<string>()
    const queue = [fromId]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === toId) return true

      const links = await prisma.kanbanTaskLink.findMany({
        where: { parentId: current },
        select: { childId: true },
      })
      for (const link of links) {
        if (!visited.has(link.childId)) {
          visited.add(link.childId)
          queue.push(link.childId)
        }
      }
    }

    return false
  }

  // --------------------------------------------------------------------------
  // Attachments & Comments
  // --------------------------------------------------------------------------

  async createAttachment(
    teamId: string,
    uploaderId: string,
    req: { fileName: string; size: number; contentType?: string },
  ): Promise<PostKanbanAttachmentResponse> {
    const key = `kanban/attachments/${teamId}/${uploaderId}/${ulid()}/${sanitizeFilename(req.fileName)}`
    const uploadUrl = await s3Service.presign(process.env.S3_BUCKET || 'shumai', key, 'PUT')
    const proxyType = getProxyType(req.contentType, req.fileName)

    return {
      id: ulid(),
      name: req.fileName,
      key,
      sizeByte: req.size,
      contentType: req.contentType,
      uploadUrl,
      proxyType,
    }
  }

  async addComment(
    taskId: string,
    authorId: string,
    body: string,
    attachments?: KanbanAttachmentPayload[],
  ): Promise<KanbanCommentInfo> {
    const task = await prisma.kanbanTask.findUnique({ where: { id: taskId } })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })

    // Attachments are uploaded through createAttachment. Only keys it issued to the
    // comment author for this task's team may be stored and signed later.
    const isOwnUpload = (key: string) => {
      const parsed = parseAttachmentKey(key)
      return parsed?.teamId === task.teamId && parsed.uploaderId === authorId
    }
    if (attachments?.some((att) => !isOwnUpload(att.key))) {
      throw new HTTPException(400, { message: 'Invalid attachment' })
    }

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.kanbanTaskComment.create({
        data: {
          taskId,
          authorId,
          body,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        },
        include: { author: true },
      })

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId: authorId,
          type: KanbanTaskEventType.COMMENTED,
        },
      })

      return c
    })

    const resolvedAttachments = await this.resolveCommentAttachments(
      comment.attachments,
      task.teamId,
    )

    return {
      id: comment.id,
      taskId: comment.taskId,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        image: await getAvatarUrl(comment.author.image),
      },
      body: comment.body,
      attachments: resolvedAttachments,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    }
  }

  async listComments(taskId: string): Promise<KanbanCommentInfo[]> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { teamId: true },
    })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })

    const comments = await prisma.kanbanTaskComment.findMany({
      where: { taskId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    })

    return await Promise.all(
      comments.map(async (c) => ({
        id: c.id,
        taskId: c.taskId,
        author: {
          id: c.author.id,
          name: c.author.name,
          image: await getAvatarUrl(c.author.image),
        },
        body: c.body,
        attachments: await this.resolveCommentAttachments(c.attachments, task.teamId),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    )
  }

  async deleteComment(
    taskId: string,
    commentId: string,
    userId: string,
    userRole?: TeamMemberRole | null,
  ): Promise<void> {
    const comment = await prisma.kanbanTaskComment.findUnique({
      where: { id: commentId, taskId },
    })
    if (!comment) {
      throw new HTTPException(404, { message: 'Comment not found' })
    }

    if (comment.authorId !== userId && userRole !== 'owner') {
      throw new HTTPException(403, { message: 'Not authorized to delete this comment' })
    }

    await prisma.kanbanTaskComment.delete({
      where: { id: commentId },
    })
  }

  private async resolveCommentAttachments(
    attachments: PrismaJson.KanbanCommentAttachmentList | null | undefined,
    teamId: string,
  ): Promise<KanbanAttachmentInfo[]> {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return []
    }

    const bucket = process.env.S3_BUCKET || 'shumai'
    return await Promise.all(
      attachments
        .filter((att) => typeof att.key === 'string' && isReadableAttachmentKey(att.key, teamId))
        .map(async (att) => {
          const url = await s3Service.presign(bucket, att.key, 'GET')
          return {
            id: att.id,
            name: att.name,
            sizeByte: att.sizeByte,
            contentType: att.contentType,
            url,
            proxyType: att.proxyType,
          }
        }),
    )
  }

  async listEvents(taskId: string, viewerId?: string): Promise<KanbanEventInfo[]> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: {
        teamId: true,
        events: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!task) return []
    const readableIds = await this.readableRelatedTaskIds(
      task.teamId,
      viewerId,
      task.events.map(dependencyEventParentId).filter((id) => id !== undefined),
    )
    return await this.resolveTaskEvents(task.events, readableIds)
  }

  private async resolveTaskEvents(
    events: TaskEventWithActor[],
    readableIds: Set<string> | undefined,
  ): Promise<KanbanEventInfo[]> {
    const visibleEvents = events.filter((event) => {
      const parentId = dependencyEventParentId(event)
      return !readableIds || parentId === undefined || readableIds.has(parentId)
    })

    return await Promise.all(
      visibleEvents.map(async (e) => ({
        id: e.id,
        taskId: e.taskId,
        actor: e.actor
          ? {
              id: e.actor.id,
              name: e.actor.name,
              image: await getAvatarUrl(e.actor.image),
            }
          : null,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        data: e.data ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    )
  }

  // --------------------------------------------------------------------------
  // Asset Association Management
  // --------------------------------------------------------------------------

  async linkAsset(teamId: string, taskId: string, assetId: string): Promise<void> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
    })
    if (!task || task.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    })
    if (!asset) {
      throw new HTTPException(404, { message: 'Asset not found' })
    }

    await prisma.kanbanTaskAsset.upsert({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        taskId_assetId: {
          taskId,
          assetId,
        },
      },
      create: {
        taskId,
        assetId,
      },
      update: {},
    })
  }

  async linkAssets(teamId: string, taskId: string, assetIds: string[]): Promise<void> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
    })
    if (!task || task.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    const distinctAssetIds = [...new Set(assetIds)]
    if (distinctAssetIds.length === 0) return

    await prisma.kanbanTaskAsset.createMany({
      data: distinctAssetIds.map((assetId) => ({
        taskId,
        assetId,
      })),
      skipDuplicates: true,
    })
  }

  async unlinkAsset(teamId: string, taskId: string, assetId: string): Promise<void> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
    })
    if (!task || task.teamId !== teamId) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    await prisma.kanbanTaskAsset.deleteMany({
      where: { taskId, assetId },
    })
  }

  async listTaskAssets(taskId: string): Promise<KanbanTaskAssetInfo[]> {
    const links = await prisma.kanbanTaskAsset.findMany({
      where: { taskId },
      include: {
        asset: {
          include: {
            creator: true,
            storageKey: true,
            project: true,
          },
        },
      },
    })

    return await this.resolveTaskAssetInfos(links)
  }

  async listTasksForAsset(
    teamId: string,
    assetId: string,
    viewerId?: string,
  ): Promise<KanbanTaskInfo[]> {
    const taskFilter = await this.readableTaskFilter(teamId, viewerId)
    const links = await prisma.kanbanTaskAsset.findMany({
      where: {
        assetId,
        task: { teamId, ...taskFilter },
      },
      include: {
        task: {
          include: {
            creator: true,
            reporter: true,
            assignee: true,
            goal: true,
            _count: { select: taskRelationCountSelect(taskFilter) },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return await Promise.all(
      links.map(async (l) => {
        const t = l.task
        const latestStatusEvent = await this.resolveLatestStatusEvent(t.id, t.status)
        return await this.toTaskInfo(t, {
          latestStatusEvent,
          commentCount: t._count.comments,
          dependencyCount: t._count.dependencies,
          dependentCount: t._count.dependents,
          assetCount: t._count.assets,
        })
      }),
    )
  }

  async getAssetTaskCount(assetId: string): Promise<number> {
    return await prisma.kanbanTaskAsset.count({ where: { assetId } })
  }

  // --------------------------------------------------------------------------
  // Private Utilities
  // --------------------------------------------------------------------------

  private async resolveLatestStatusEvent(
    taskId: string,
    status: KanbanTaskStatus,
  ): Promise<KanbanStatusEventInfo | null> {
    const event = await prisma.kanbanTaskEvent.findFirst({
      where: { taskId, toStatus: status },
      orderBy: { createdAt: 'desc' },
      include: { actor: true },
    })
    if (!event) return null

    const payload = (event.data as Record<string, unknown>) || {}

    return {
      id: event.id,
      type: event.type,
      actor: event.actor
        ? {
            id: event.actor.id,
            name: event.actor.name,
            image: await getAvatarUrl(event.actor.image),
          }
        : null,
      summary: typeof payload.summary === 'string' ? payload.summary : undefined,
      blockReason: typeof payload.blockReason === 'string' ? payload.blockReason : undefined,
      blockKind: typeof payload.blockKind === 'string' ? payload.blockKind : undefined,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      createdAt: event.createdAt.toISOString(),
    }
  }

  private async getTaskCounts(
    taskId: string,
    taskFilter?: Prisma.KanbanTaskWhereInput,
  ): Promise<{
    commentCount: number
    dependencyCount: number
    dependentCount: number
    assetCount: number
  }> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      select: { _count: { select: taskRelationCountSelect(taskFilter) } },
    })
    return {
      commentCount: task?._count.comments ?? 0,
      dependencyCount: task?._count.dependencies ?? 0,
      dependentCount: task?._count.dependents ?? 0,
      assetCount: task?._count.assets ?? 0,
    }
  }

  private async resolveTaskAssetInfos(
    assetLinks: Array<{
      asset: Prisma.AssetGetPayload<{
        include: {
          creator: true
          storageKey: true
          project: true
        }
      }>
    }>,
  ): Promise<KanbanTaskAssetInfo[]> {
    if (!assetLinks || assetLinks.length === 0) return []

    const stackIds = new Set<string>()
    for (const { asset } of assetLinks) {
      if (asset.type === AssetType.version_stack) {
        stackIds.add(asset.id)
      }
    }

    const latestVersionsMap = new Map<
      string,
      Prisma.AssetGetPayload<{
        include: {
          creator: true
          storageKey: true
        }
      }>
    >()

    if (stackIds.size > 0) {
      const allVersions = await prisma.asset.findMany({
        where: { parentId: { in: Array.from(stackIds) }, isDeleted: false },
        include: {
          creator: true,
          storageKey: true,
        },
        orderBy: { sortIndex: 'asc' },
      })
      for (const v of allVersions) {
        if (!latestVersionsMap.has(v.parentId!)) {
          latestVersionsMap.set(v.parentId!, v)
        }
      }
    }

    return await Promise.all(
      assetLinks.map(async ({ asset }) => {
        const latestVersion =
          asset.type === AssetType.version_stack ? latestVersionsMap.get(asset.id) : null
        const target = latestVersion || asset

        const targetCreator = target.creator || asset.creator
        const creatorImage = targetCreator ? await getAvatarUrl(targetCreator.image) : undefined

        const preview = await assetService.toPreviewInfo(target)
        const proxyType =
          preview?.proxyType ||
          (target.media as PrismaJson.MediaInfo | null)?.proxyType ||
          getProxyType(target.mediaType, target.name)
        const thumbnailUrl = preview?.thumbnailUrl ?? null

        let path = '/'
        try {
          const rows = await prisma.$queryRaw<{ id: string; name: string; type: string }[]>`
            WITH RECURSIVE ancestor AS (
              SELECT id, parent_id, name, type::text FROM assets WHERE id = ${asset.id}
              UNION ALL
              SELECT a.id, a.parent_id, a.name, a.type::text FROM assets a
              INNER JOIN ancestor d ON d.parent_id = a.id
            )
            SELECT id, name, type FROM ancestor;
          `
          const ancestorNames = rows
            .filter((r) => r.id !== asset.id && r.type !== 'root' && r.type !== 'version_stack')
            .map((r) => r.name)
            .filter(Boolean)

          if (asset.project?.name) {
            path = `/${[asset.project.name, ...ancestorNames.reverse()].join('/')}`
          } else if (ancestorNames.length > 0) {
            path = `/${ancestorNames.reverse().join('/')}`
          }
        } catch {
          path = asset.project?.name ? `/${asset.project.name}` : '/'
        }

        return {
          id: asset.id,
          name:
            asset.type === AssetType.version_stack ? latestVersion?.name || asset.name : asset.name,
          type: asset.type,
          proxyType,
          thumbnailUrl,
          path,
          creator: targetCreator
            ? {
                id: targetCreator.id,
                name: targetCreator.name,
                image: creatorImage,
              }
            : null,
          sizeByte: Number(target.sizeByte || 0),
          fileCount: asset.fileCount,
          projectId: asset.projectId ?? null,
          createdAt: asset.createdAt.toISOString(),
        }
      }),
    )
  }

  private async toTaskInfo(
    task: Prisma.KanbanTaskGetPayload<{
      include: {
        creator: true
        reporter?: true
        assignee?: true
        goal?: true
      }
    }>,
    extra: {
      latestStatusEvent?: KanbanStatusEventInfo | null
      commentCount?: number
      dependencyCount?: number
      dependentCount?: number
      assetCount?: number
    },
  ): Promise<KanbanTaskInfo> {
    const [creatorImage, reporterImage, assigneeImage] = await Promise.all([
      getAvatarUrl(task.creator.image),
      task.reporter ? getAvatarUrl(task.reporter.image) : Promise.resolve(undefined),
      task.assignee ? getAvatarUrl(task.assignee.image) : Promise.resolve(undefined),
    ])

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      isAgentTask: task.isAgentTask,
      status: task.status,
      priority: task.priority,
      startDate: task.startDate ? task.startDate.toISOString() : null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      startedAt: task.startedAt ? task.startedAt.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      teamId: task.teamId,
      projectId: task.projectId ?? null,
      sortIndex: task.sortIndex ?? null,
      creator: {
        id: task.creator.id,
        name: task.creator.name,
        image: creatorImage,
      },
      reporter: task.reporter
        ? {
            id: task.reporter.id,
            name: task.reporter.name,
            image: reporterImage,
          }
        : null,
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            name: task.assignee.name,
            image: assigneeImage,
          }
        : null,
      goal: task.goal ? { id: task.goal.id, title: task.goal.title } : null,
      targetFolderId: task.targetFolderId ?? null,
      latestStatusEvent: extra.latestStatusEvent ?? null,
      commentCount: extra.commentCount ?? 0,
      dependencyCount: extra.dependencyCount ?? 0,
      dependentCount: extra.dependentCount ?? 0,
      assetCount: extra.assetCount ?? 0,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }
  }
}

export const kanbanService = new KanbanService()
