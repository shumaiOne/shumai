import { prisma, type TeamMemberRole, type Prisma } from '@shumai/db'
import {
  KanbanTaskStatus,
  KanbanTaskType,
  KanbanTaskPriority,
  KanbanTaskRunStatus,
  KanbanTaskEventType,
} from '@shumai/db/enums'
import { HTTPException } from 'hono/http-exception'
import { ulid } from 'ulid'
import { generateKeyBetween } from 'jittered-fractional-indexing'
import { paginateQuery } from '../pagination'
import { kanbanDispatcher } from './kanban-dispatcher'
import { getAvatarUrl } from '../user/avatar'
import { s3Service } from '../s3/s3'
import { getProxyType } from '../utils/mime'
import type {
  CreateKanbanGoalRequest,
  UpdateKanbanGoalRequest,
  ListKanbanGoalsRequest,
  CreateKanbanTaskRequest,
  UpdateKanbanTaskRequest,
  ListKanbanTasksRequest,
  KanbanTaskInfo,
  KanbanTaskDetail,
  KanbanStatusEventInfo,
  KanbanCommentInfo,
  KanbanAttachmentInfo,
  KanbanAttachmentPayload,
  PostKanbanAttachmentResponse,
  KanbanEventInfo,
  KanbanGoalInfo,
} from '@shumai/dtos'

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
    const goals = await prisma.kanbanGoal.findMany({
      where: { teamId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { id: 'desc' },
    })

    return goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      teamId: g.teamId,
      creatorId: g.creatorId,
      taskCount: g._count.tasks,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }))
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
    const now = new Date()

    // Determine initial status based on parents and startDate
    let initialStatus: KanbanTaskStatus = KanbanTaskStatus.READY
    const startDateObj = req.startDate ? new Date(req.startDate) : null

    if (startDateObj && startDateObj > now) {
      initialStatus = KanbanTaskStatus.TODO
    } else if (parentIds.length > 0) {
      const parents = await prisma.kanbanTask.findMany({
        where: { id: { in: parentIds }, teamId },
      })
      if (parents.length !== parentIds.length) {
        throw new HTTPException(400, { message: 'One or more parent tasks were not found' })
      }
      const allParentsDone = parents.every((p) => p.status === KanbanTaskStatus.DONE)
      if (!allParentsDone) {
        initialStatus = KanbanTaskStatus.TODO
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      const lastTask = await tx.kanbanTask.findFirst({
        where: { teamId, status: initialStatus },
        orderBy: { sortIndex: 'desc' },
      })
      const sortIndex = generateKeyBetween(lastTask?.sortIndex || null, null)

      const created = await tx.kanbanTask.create({
        data: {
          teamId,
          title: req.title,
          description: req.description,
          type: req.type ?? KanbanTaskType.MANUAL,
          status: initialStatus,
          priority: req.priority ?? KanbanTaskPriority.MEDIUM,
          startDate: req.startDate ? new Date(req.startDate) : null,
          dueDate: req.dueDate ? new Date(req.dueDate) : null,
          goalId: req.goalId,
          projectId: req.projectId,
          reporterId: req.reporterId,
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
          latestRun: true,
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

      // Log creation event
      await tx.kanbanTaskEvent.create({
        data: {
          taskId: created.id,
          actorId: creatorId,
          type: KanbanTaskEventType.CREATED,
          toStatus: initialStatus,
          data: {
            parentCount: parentIds.length,
          },
        },
      })

      return created
    })

    if (initialStatus === KanbanTaskStatus.READY && task.type === KanbanTaskType.AGENTIC) {
      kanbanDispatcher.nudge(task.id)
    }

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
    })
  }

  async getTask(taskId: string): Promise<KanbanTaskDetail> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        creator: true,
        reporter: true,
        assignee: true,
        goal: true,
        latestRun: true,
        dependencies: {
          include: { parent: true },
        },
        dependents: {
          include: { child: true },
        },
        runs: {
          orderBy: { attempt: 'desc' },
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

    // Resolve latest event matching current status
    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, task.status)

    const baseInfo = await this.toTaskInfo(task, {
      latestStatusEvent,
      dependencyCount: task.dependencies.length,
      dependentCount: task.dependents.length,
      commentCount: task.comments.length,
    })

    return {
      ...baseInfo,
      dependencies: task.dependencies.map((d) => ({
        id: d.parent.id,
        title: d.parent.title,
        type: d.parent.type,
        status: d.parent.status,
        priority: d.parent.priority,
      })),
      dependents: task.dependents.map((d) => ({
        id: d.child.id,
        title: d.child.title,
        type: d.child.type,
        status: d.child.status,
        priority: d.child.priority,
      })),
      runs: task.runs.map((r) => ({
        id: r.id,
        status: r.status,
        attempt: r.attempt,
        summary: r.summary,
        claimToken: r.claimToken,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
      })),
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
          attachments: await this.resolveCommentAttachments(c.attachments),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      ),
      events: await Promise.all(
        task.events.map(async (e) => ({
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
          data: (e.data as Record<string, unknown>) ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
      ),
    }
  }

  async updateTask(
    taskId: string,
    req: UpdateKanbanTaskRequest,
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
        latestRun: true,
        dependencies: { include: { parent: true } },
      },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    const isOwner = callerRole === 'owner'
    const isEditor = callerRole === 'editor'
    const isReporter = existing.reporterId === actorId || existing.creatorId === actorId
    const isAssignee = existing.assigneeId === actorId

    // Status change permission check: only owner, reporter, or assignee can change task status
    if (req.status !== undefined && req.status !== existing.status) {
      if (!isOwner && !isReporter && !isAssignee) {
        throw new HTTPException(403, {
          message: 'Only team owners, task reporters, or assignees can change task status',
        })
      }
    }

    // General edit permission check for other fields: must be owner, editor, reporter, or assignee
    if (!isOwner && !isEditor && !isReporter && !isAssignee) {
      throw new HTTPException(403, { message: 'Permission denied' })
    }

    // Status transition calculation if status changed
    let targetStatus: KanbanTaskStatus | undefined = req.status
    let completedAtUpdate: Date | null | undefined = undefined
    let startedAtUpdate: Date | null | undefined = undefined
    let shouldRecomputeChildren = false
    let shouldInvalidateDescendants = false
    let shouldCancelDescendants = false
    let statusEventType: KanbanTaskEventType = KanbanTaskEventType.STATUS_CHANGED
    let statusEventData: Record<string, unknown> | undefined = undefined

    if (req.status !== undefined && req.status !== existing.status) {
      const parentLinks = existing.dependencies
      const allParentsDone = parentLinks.every((d) => d.parent.status === KanbanTaskStatus.DONE)
      const effectiveStartDate =
        req.startDate !== undefined
          ? req.startDate
            ? new Date(req.startDate)
            : null
          : existing.startDate
      const now = new Date()
      const startDateSatisfied = !effectiveStartDate || effectiveStartDate <= now

      switch (req.status) {
        case KanbanTaskStatus.DONE: {
          completedAtUpdate = new Date()
          shouldRecomputeChildren = true
          statusEventType = KanbanTaskEventType.STATUS_CHANGED
          if (existing.status === KanbanTaskStatus.IN_REVIEW) {
            statusEventData = { summary: 'Approved by reviewer' }
          }
          break
        }
        case KanbanTaskStatus.IN_PROGRESS: {
          if (existing.status === KanbanTaskStatus.DONE) {
            completedAtUpdate = null
            shouldInvalidateDescendants = true
          }
          startedAtUpdate = existing.startedAt ?? new Date()
          statusEventType = KanbanTaskEventType.STATUS_CHANGED
          break
        }
        case KanbanTaskStatus.IN_REVIEW: {
          if (existing.status === KanbanTaskStatus.DONE) {
            completedAtUpdate = null
            shouldInvalidateDescendants = true
          }
          statusEventType = KanbanTaskEventType.STATUS_CHANGED
          break
        }
        case KanbanTaskStatus.BLOCKED: {
          if (existing.status === KanbanTaskStatus.DONE) {
            completedAtUpdate = null
            shouldInvalidateDescendants = true
          }
          statusEventType = KanbanTaskEventType.BLOCKED
          statusEventData = req.reason ? { reason: req.reason } : undefined
          break
        }
        case KanbanTaskStatus.CANCELLED: {
          if (existing.status === KanbanTaskStatus.DONE) {
            completedAtUpdate = null
          }
          shouldCancelDescendants = true
          statusEventType = KanbanTaskEventType.CANCELLED
          break
        }
        case KanbanTaskStatus.TODO:
        case KanbanTaskStatus.READY: {
          if (existing.status === KanbanTaskStatus.DONE) {
            completedAtUpdate = null
            shouldInvalidateDescendants = true
          }
          if (existing.status === KanbanTaskStatus.BLOCKED) {
            statusEventType = KanbanTaskEventType.UNBLOCKED
          } else if (existing.status === KanbanTaskStatus.IN_REVIEW && req.reason) {
            statusEventType = KanbanTaskEventType.CHANGES_REQUESTED
            statusEventData = { reason: req.reason }
          } else {
            statusEventType = KanbanTaskEventType.STATUS_CHANGED
          }
          if (req.status === KanbanTaskStatus.READY && (!allParentsDone || !startDateSatisfied)) {
            targetStatus = KanbanTaskStatus.TODO
          }
          break
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const finalStatus = targetStatus ?? existing.status
      let newSortIndex: string | undefined = undefined

      if (req.beforeIndex !== undefined) {
        const prevTask = await tx.kanbanTask.findFirst({
          where: {
            teamId: existing.teamId,
            status: finalStatus,
            sortIndex: { lt: req.beforeIndex },
            id: { not: taskId },
          },
          orderBy: { sortIndex: 'desc' },
        })
        newSortIndex = generateKeyBetween(prevTask?.sortIndex || null, req.beforeIndex)
      } else if (req.afterIndex !== undefined) {
        const nextTask = await tx.kanbanTask.findFirst({
          where: {
            teamId: existing.teamId,
            status: finalStatus,
            sortIndex: { gt: req.afterIndex },
            id: { not: taskId },
          },
          orderBy: { sortIndex: 'asc' },
        })
        newSortIndex = generateKeyBetween(req.afterIndex, nextTask?.sortIndex || null)
      } else if (req.status !== undefined && req.status !== existing.status) {
        const lastTask = await tx.kanbanTask.findFirst({
          where: {
            teamId: existing.teamId,
            status: finalStatus,
            id: { not: taskId },
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
          ...(req.type !== undefined && { type: req.type }),
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
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      if (req.status !== undefined && req.status !== existing.status) {
        if (statusEventType === KanbanTaskEventType.CHANGES_REQUESTED && req.reason) {
          await tx.kanbanTaskComment.create({
            data: {
              taskId,
              authorId: actorId,
              body: `[Changes Requested] ${req.reason}`,
            },
          })
        }

        if (targetStatus === KanbanTaskStatus.CANCELLED && task.latestRunId) {
          await tx.kanbanTaskRun.update({
            where: { id: task.latestRunId },
            data: {
              status: KanbanTaskRunStatus.CANCELLED,
              endedAt: new Date(),
            },
          })
        }

        if (targetStatus === KanbanTaskStatus.DONE && task.latestRunId) {
          await tx.kanbanTaskRun.update({
            where: { id: task.latestRunId },
            data: {
              status: KanbanTaskRunStatus.COMPLETED,
              endedAt: new Date(),
            },
          })
        }

        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: statusEventType,
            fromStatus: existing.status,
            toStatus: targetStatus!,
            data: statusEventData,
          },
        })

        if (shouldCancelDescendants) {
          await this.cancelDescendants(taskId, actorId, tx)
        }
        if (shouldInvalidateDescendants) {
          await this.invalidateDescendants(taskId, actorId, tx)
        }
      }

      // Log specific events if critical fields changed
      if (req.priority && req.priority !== existing.priority) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: KanbanTaskEventType.PRIORITY_CHANGED,
            data: { from: existing.priority, to: req.priority },
          },
        })
      }
      if (req.goalId !== undefined && req.goalId !== existing.goalId) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: KanbanTaskEventType.GOAL_CHANGED,
            data: { from: existing.goalId, to: req.goalId },
          },
        })
      }
      if (req.assigneeId !== undefined && req.assigneeId !== existing.assigneeId) {
        await tx.kanbanTaskEvent.create({
          data: {
            taskId,
            actorId,
            type: req.assigneeId ? KanbanTaskEventType.ASSIGNED : KanbanTaskEventType.UNASSIGNED,
            data: { from: existing.assigneeId, to: req.assigneeId },
          },
        })
      }

      return task
    })

    if (shouldRecomputeChildren) {
      await this.recomputeChildrenReadiness(taskId)
    }

    // If startDate changed and task is in TODO, re-check ready state
    if (req.startDate !== undefined && updated.status === KanbanTaskStatus.TODO) {
      await this.recomputeReady(taskId)
    }

    if (
      (updated.status === KanbanTaskStatus.READY ||
        updated.status === KanbanTaskStatus.IN_PROGRESS) &&
      updated.type === KanbanTaskType.AGENTIC
    ) {
      kanbanDispatcher.nudge(taskId)
    }

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)

    return await this.toTaskInfo(updated, {
      latestStatusEvent,
      ...counts,
    })
  }

  async listTasks(
    teamId: string,
    params: ListKanbanTasksRequest,
  ): Promise<{ data: KanbanTaskInfo[]; pageInfo: { total?: number; cursor?: string } }> {
    const where = {
      teamId,
      ...(params.status && { status: params.status }),
      ...(params.type && { type: params.type }),
      ...(params.goalId && { goalId: params.goalId }),
      ...(params.projectId && { projectId: params.projectId }),
      ...(params.priority && { priority: params.priority }),
      ...(params.assigneeId && { assigneeId: params.assigneeId }),
      ...(params.reporterId && { reporterId: params.reporterId }),
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
            latestRun: true,
            _count: {
              select: {
                comments: true,
                dependencies: true,
                dependents: true,
              },
            },
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
            })
          }),
        )
      },
      () => prisma.kanbanTask.count({ where }),
      params,
    )
  }

  // --------------------------------------------------------------------------
  // State Machine Transitions
  // --------------------------------------------------------------------------

  async startManualTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(
      taskId,
      { status: KanbanTaskStatus.IN_PROGRESS },
      actorId,
      callerRole,
    )
  }

  async completeManualTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(taskId, { status: KanbanTaskStatus.DONE }, actorId, callerRole)
  }

  async approveTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(taskId, { status: KanbanTaskStatus.DONE }, actorId, callerRole)
  }

  async requestChanges(
    taskId: string,
    reason: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(
      taskId,
      { status: KanbanTaskStatus.TODO, reason },
      actorId,
      callerRole,
    )
  }

  async unblockTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(taskId, { status: KanbanTaskStatus.READY }, actorId, callerRole)
  }

  async reclaimTask(taskId: string, actorId?: string): Promise<KanbanTaskInfo> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: {
        creator: true,
        reporter: true,
        assignee: true,
        goal: true,
        latestRun: true,
        dependencies: { include: { parent: true } },
      },
    })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })
    if (task.status !== KanbanTaskStatus.IN_PROGRESS) {
      throw new HTTPException(400, {
        message: `Task cannot be reclaimed from '${task.status}' status (must be IN_PROGRESS)`,
      })
    }

    const now = new Date()
    const allParentsDone = task.dependencies.every((d) => d.parent.status === KanbanTaskStatus.DONE)
    const startDateSatisfied = !task.startDate || task.startDate <= now
    const nextStatus =
      allParentsDone && startDateSatisfied ? KanbanTaskStatus.READY : KanbanTaskStatus.TODO

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.kanbanTask.update({
        where: { id: taskId },
        data: { status: nextStatus },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      if (task.latestRunId) {
        await tx.kanbanTaskRun.update({
          where: { id: task.latestRunId },
          data: {
            status: KanbanTaskRunStatus.RECLAIMED,
            endedAt: new Date(),
          },
        })
      }

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.RECLAIMED,
          fromStatus: KanbanTaskStatus.IN_PROGRESS,
          toStatus: nextStatus,
        },
      })

      return t
    })

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return await this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async reopenTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(taskId, { status: KanbanTaskStatus.READY }, actorId, callerRole)
  }

  async cancelTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    return await this.updateTask(
      taskId,
      { status: KanbanTaskStatus.CANCELLED },
      actorId,
      callerRole,
    )
  }

  // --------------------------------------------------------------------------
  // DAG Dependency Management & Cycles
  // --------------------------------------------------------------------------

  async addDependency(parentId: string, childId: string, actorId?: string): Promise<void> {
    if (parentId === childId) {
      throw new HTTPException(400, { message: 'Task cannot depend on itself' })
    }

    const [parent, child] = await Promise.all([
      prisma.kanbanTask.findUnique({ where: { id: parentId } }),
      prisma.kanbanTask.findUnique({ where: { id: childId } }),
    ])
    if (!parent || !child) {
      throw new HTTPException(404, { message: 'Parent or child task not found' })
    }
    if (parent.teamId !== child.teamId) {
      throw new HTTPException(400, {
        message: 'Parent and child tasks must belong to the same team',
      })
    }

    // Check if link already exists
    const existing = await prisma.kanbanTaskLink.findUnique({
      // Prisma compound unique constraint key requires snake_case property name
      // eslint-disable-next-line @typescript-eslint/naming-convention
      where: { parentId_childId: { parentId, childId } },
    })
    if (existing) return

    // Cycle detection: check if a path already exists from childId to parentId
    const wouldCreateCycle = await this.pathExists(childId, parentId)
    if (wouldCreateCycle) {
      throw new HTTPException(400, {
        message: 'Circular dependency detected: adding this dependency would create a cycle',
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.kanbanTaskLink.create({
        data: { parentId, childId },
      })

      await tx.kanbanTaskEvent.create({
        data: {
          taskId: childId,
          actorId,
          type: KanbanTaskEventType.DEPENDENCY_ADDED,
          data: { parentId },
        },
      })

      // If child is READY and parent is not DONE, demote child to TODO
      if (child.status === KanbanTaskStatus.READY && parent.status !== KanbanTaskStatus.DONE) {
        await tx.kanbanTask.update({
          where: { id: childId },
          data: { status: KanbanTaskStatus.TODO },
        })

        await tx.kanbanTaskEvent.create({
          data: {
            taskId: childId,
            actorId,
            type: KanbanTaskEventType.STATUS_CHANGED,
            fromStatus: KanbanTaskStatus.READY,
            toStatus: KanbanTaskStatus.TODO,
            data: { reason: `Prerequisite parent task ${parentId} is not DONE` },
          },
        })
      }
    })
  }

  async removeDependency(parentId: string, childId: string, actorId?: string): Promise<void> {
    const link = await prisma.kanbanTaskLink.findUnique({
      // Prisma compound unique constraint key requires snake_case property name
      // eslint-disable-next-line @typescript-eslint/naming-convention
      where: { parentId_childId: { parentId, childId } },
    })
    if (!link) return

    await prisma.$transaction(async (tx) => {
      await tx.kanbanTaskLink.delete({
        // Prisma compound unique constraint key requires snake_case property name
        // eslint-disable-next-line @typescript-eslint/naming-convention
        where: { parentId_childId: { parentId, childId } },
      })

      await tx.kanbanTaskEvent.create({
        data: {
          taskId: childId,
          actorId,
          type: KanbanTaskEventType.DEPENDENCY_REMOVED,
          data: { parentId },
        },
      })
    })

    // Re-evaluate child readiness
    await this.recomputeReady(childId)
  }

  // --------------------------------------------------------------------------
  // Readiness Recomputation & Invalidation Helpers
  // --------------------------------------------------------------------------

  async recomputeReady(taskId?: string): Promise<void> {
    const now = new Date()

    if (taskId) {
      const task = await prisma.kanbanTask.findUnique({
        where: { id: taskId },
        include: { dependencies: { include: { parent: true } } },
      })
      if (!task || task.status !== KanbanTaskStatus.TODO) return

      const allParentsDone = task.dependencies.every(
        (d) => d.parent.status === KanbanTaskStatus.DONE,
      )
      const startDateSatisfied = !task.startDate || task.startDate <= now

      if (allParentsDone && startDateSatisfied) {
        await prisma.$transaction(async (tx) => {
          await tx.kanbanTask.update({
            where: { id: taskId },
            data: { status: KanbanTaskStatus.READY },
          })

          await tx.kanbanTaskEvent.create({
            data: {
              taskId,
              type: KanbanTaskEventType.STATUS_CHANGED,
              fromStatus: KanbanTaskStatus.TODO,
              toStatus: KanbanTaskStatus.READY,
              data: { reason: 'All prerequisites and start date requirements satisfied' },
            },
          })
        })

        if (task.type === KanbanTaskType.AGENTIC) {
          kanbanDispatcher.nudge(taskId)
        }
      }
      return
    }

    // Recompute all TODO tasks
    const todoTasks = await prisma.kanbanTask.findMany({
      where: { status: KanbanTaskStatus.TODO },
      include: { dependencies: { include: { parent: true } } },
    })

    for (const task of todoTasks) {
      const allParentsDone = task.dependencies.every(
        (d) => d.parent.status === KanbanTaskStatus.DONE,
      )
      const startDateSatisfied = !task.startDate || task.startDate <= now

      if (allParentsDone && startDateSatisfied) {
        await prisma.$transaction(async (tx) => {
          await tx.kanbanTask.update({
            where: { id: task.id },
            data: { status: KanbanTaskStatus.READY },
          })

          await tx.kanbanTaskEvent.create({
            data: {
              taskId: task.id,
              type: KanbanTaskEventType.STATUS_CHANGED,
              fromStatus: KanbanTaskStatus.TODO,
              toStatus: KanbanTaskStatus.READY,
            },
          })
        })

        if (task.type === KanbanTaskType.AGENTIC) {
          kanbanDispatcher.nudge(task.id)
        }
      }
    }
  }

  private async recomputeChildrenReadiness(parentTaskId: string): Promise<void> {
    const childLinks = await prisma.kanbanTaskLink.findMany({
      where: { parentId: parentTaskId },
    })
    for (const link of childLinks) {
      await this.recomputeReady(link.childId)
    }
  }

  private async invalidateDescendants(
    ancestorTaskId: string,
    actorId: string,
    db: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma,
  ): Promise<void> {
    const descendantIds = await this.getDownstreamDescendants(ancestorTaskId)

    for (const childId of descendantIds) {
      const child = await db.kanbanTask.findUnique({
        where: { id: childId },
        include: { latestRun: true },
      })
      if (!child) continue

      if (
        child.status === KanbanTaskStatus.READY ||
        child.status === KanbanTaskStatus.IN_PROGRESS ||
        child.status === KanbanTaskStatus.IN_REVIEW ||
        child.status === KanbanTaskStatus.DONE
      ) {
        const prevStatus = child.status

        await db.kanbanTask.update({
          where: { id: childId },
          data: {
            status: KanbanTaskStatus.TODO,
            completedAt: null,
          },
        })

        if (
          child.latestRun &&
          (child.latestRun.status === KanbanTaskRunStatus.RUNNING ||
            child.latestRun.status === KanbanTaskRunStatus.REVIEW_REQUESTED)
        ) {
          await db.kanbanTaskRun.update({
            where: { id: child.latestRun.id },
            data: {
              status: KanbanTaskRunStatus.RECLAIMED,
              endedAt: new Date(),
            },
          })
        }

        await db.kanbanTaskComment.create({
          data: {
            taskId: childId,
            authorId: actorId,
            body: `Invalidated: ancestor ${ancestorTaskId} was reopened; retracted from '${prevStatus}' to 'TODO' (will resume once ancestor completes).`,
          },
        })

        await db.kanbanTaskEvent.create({
          data: {
            taskId: childId,
            actorId,
            type: KanbanTaskEventType.ANCESTOR_REOPENED,
            fromStatus: prevStatus,
            toStatus: KanbanTaskStatus.TODO,
            data: { ancestorTaskId },
          },
        })
      }
    }
  }

  private async cancelDescendants(
    ancestorTaskId: string,
    actorId: string,
    db: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma,
  ): Promise<void> {
    const descendantIds = await this.getDownstreamDescendants(ancestorTaskId)

    for (const childId of descendantIds) {
      const child = await db.kanbanTask.findUnique({
        where: { id: childId },
        include: { latestRun: true },
      })
      if (!child || child.status === KanbanTaskStatus.CANCELLED) continue

      const prevStatus = child.status
      await db.kanbanTask.update({
        where: { id: childId },
        data: { status: KanbanTaskStatus.CANCELLED },
      })

      if (
        child.latestRun &&
        (child.latestRun.status === KanbanTaskRunStatus.RUNNING ||
          child.latestRun.status === KanbanTaskRunStatus.REVIEW_REQUESTED)
      ) {
        await db.kanbanTaskRun.update({
          where: { id: child.latestRun.id },
          data: {
            status: KanbanTaskRunStatus.CANCELLED,
            endedAt: new Date(),
          },
        })
      }

      await db.kanbanTaskEvent.create({
        data: {
          taskId: childId,
          actorId,
          type: KanbanTaskEventType.CANCELLED,
          fromStatus: prevStatus,
          toStatus: KanbanTaskStatus.CANCELLED,
          data: { reason: `Cancelled due to parent task ${ancestorTaskId} cancellation` },
        },
      })
    }
  }

  private async getDownstreamDescendants(startTaskId: string): Promise<string[]> {
    const visited = new Set<string>()
    const queue = [startTaskId]

    while (queue.length > 0) {
      const current = queue.shift()!
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

    return Array.from(visited)
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
    req: { fileName: string; size: number; contentType?: string },
  ): Promise<PostKanbanAttachmentResponse> {
    const key = `kanban/attachments/${ulid()}/${req.fileName}`
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

    const resolvedAttachments = await this.resolveCommentAttachments(comment.attachments)

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
        attachments: await this.resolveCommentAttachments(c.attachments),
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
    attachments?: PrismaJson.KanbanCommentAttachmentList | null,
  ): Promise<KanbanAttachmentInfo[]> {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return []
    }

    const bucket = process.env.S3_BUCKET || 'shumai'
    return await Promise.all(
      attachments.map(async (att) => {
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

  async listEvents(taskId: string): Promise<KanbanEventInfo[]> {
    const events = await prisma.kanbanTaskEvent.findMany({
      where: { taskId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    })

    return await Promise.all(
      events.map(async (e) => ({
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
        data: (e.data as Record<string, unknown>) ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    )
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

  private async getTaskCounts(taskId: string): Promise<{
    commentCount: number
    dependencyCount: number
    dependentCount: number
  }> {
    const [commentCount, dependencyCount, dependentCount] = await Promise.all([
      prisma.kanbanTaskComment.count({ where: { taskId } }),
      prisma.kanbanTaskLink.count({ where: { childId: taskId } }),
      prisma.kanbanTaskLink.count({ where: { parentId: taskId } }),
    ])
    return { commentCount, dependencyCount, dependentCount }
  }

  private async toTaskInfo(
    task: Prisma.KanbanTaskGetPayload<{
      include: {
        creator: true
        reporter?: true
        assignee?: true
        goal?: true
        latestRun?: true
      }
    }>,
    extra: {
      latestStatusEvent?: KanbanStatusEventInfo | null
      commentCount?: number
      dependencyCount?: number
      dependentCount?: number
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
      type: task.type,
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
      latestRun: task.latestRun
        ? {
            id: task.latestRun.id,
            status: task.latestRun.status,
            attempt: task.latestRun.attempt,
            summary: task.latestRun.summary,
            claimToken: task.latestRun.claimToken,
            startedAt: task.latestRun.startedAt.toISOString(),
            endedAt: task.latestRun.endedAt ? task.latestRun.endedAt.toISOString() : null,
          }
        : null,
      latestStatusEvent: extra.latestStatusEvent ?? null,
      commentCount: extra.commentCount ?? 0,
      dependencyCount: extra.dependencyCount ?? 0,
      dependentCount: extra.dependentCount ?? 0,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }
  }
}

export const kanbanService = new KanbanService()
