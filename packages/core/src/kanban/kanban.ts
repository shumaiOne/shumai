import { prisma, type TeamMemberRole, type Prisma } from '@shumai/db'
import {
  KanbanTaskStatus,
  KanbanTaskType,
  KanbanTaskPriority,
  KanbanTaskRunStatus,
  KanbanTaskEventType,
} from '@shumai/db/enums'
import { HTTPException } from 'hono/http-exception'
import { paginateQuery } from '../pagination'
import { kanbanDispatcher } from './kanban-dispatcher'
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
    // Permission: Only owner can create agentic tasks
    if (req.type === KanbanTaskType.AGENTIC && callerRole !== 'owner') {
      throw new HTTPException(403, { message: 'Only team owners can create agentic tasks' })
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

    return this.toTaskInfo(task, {
      latestStatusEvent: {
        id: 'init',
        type: KanbanTaskEventType.CREATED,
        actor: {
          id: task.creator.id,
          name: task.creator.name,
          image: task.creator.image ?? undefined,
        },
        createdAt: task.createdAt,
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

    const baseInfo = this.toTaskInfo(task, {
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
      comments: task.comments.map((c) => ({
        id: c.id,
        taskId: c.taskId,
        author: {
          id: c.author.id,
          name: c.author.name,
          image: c.author.image ?? undefined,
        },
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      events: task.events.map((e) => ({
        id: e.id,
        taskId: e.taskId,
        actor: e.actor
          ? {
              id: e.actor.id,
              name: e.actor.name,
              image: e.actor.image ?? undefined,
            }
          : null,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        data: (e.data as Record<string, unknown>) ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
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
      include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
    })
    if (!existing) {
      throw new HTTPException(404, { message: 'Task not found' })
    }

    // Permission: Only owner can update agentic tasks or promote to agentic
    const isAgentic =
      existing.type === KanbanTaskType.AGENTIC || req.type === KanbanTaskType.AGENTIC
    if (isAgentic && callerRole !== 'owner') {
      throw new HTTPException(403, { message: 'Only team owners can update agentic tasks' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.kanbanTask.update({
        where: { id: taskId },
        data: {
          ...(req.title !== undefined && { title: req.title }),
          ...(req.description !== undefined && { description: req.description }),
          ...(req.type !== undefined && { type: req.type }),
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
        },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

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

    // If startDate changed and task is in TODO, re-check ready state
    if (req.startDate !== undefined && updated.status === KanbanTaskStatus.TODO) {
      await this.recomputeReady(taskId)
    }

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)

    return this.toTaskInfo(updated, {
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
          orderBy: { id: 'desc' },
          skip,
          take,
        })

        return await Promise.all(
          tasks.map(async (t) => {
            const latestStatusEvent = await this.resolveLatestStatusEvent(t.id, t.status)
            return this.toTaskInfo(t, {
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

  async startManualTask(taskId: string, actorId: string): Promise<KanbanTaskInfo> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
    })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })
    if (task.type !== KanbanTaskType.MANUAL) {
      throw new HTTPException(400, {
        message: 'Only MANUAL tasks can be started via startManualTask',
      })
    }
    if (task.status !== KanbanTaskStatus.READY) {
      throw new HTTPException(400, {
        message: `Task cannot be started from '${task.status}' status (must be READY)`,
      })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.kanbanTask.update({
        where: { id: taskId },
        data: {
          status: KanbanTaskStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.STATUS_CHANGED,
          fromStatus: KanbanTaskStatus.READY,
          toStatus: KanbanTaskStatus.IN_PROGRESS,
        },
      })

      return t
    })

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async completeManualTask(taskId: string, actorId: string): Promise<KanbanTaskInfo> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
    })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })
    if (task.type !== KanbanTaskType.MANUAL) {
      throw new HTTPException(400, {
        message: 'Only MANUAL tasks can be completed via completeManualTask',
      })
    }
    if (task.status !== KanbanTaskStatus.IN_PROGRESS) {
      throw new HTTPException(400, {
        message: `Task cannot be completed from '${task.status}' status (must be IN_PROGRESS)`,
      })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.kanbanTask.update({
        where: { id: taskId },
        data: {
          status: KanbanTaskStatus.DONE,
          completedAt: new Date(),
        },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.STATUS_CHANGED,
          fromStatus: KanbanTaskStatus.IN_PROGRESS,
          toStatus: KanbanTaskStatus.DONE,
        },
      })

      return t
    })

    // Recompute readiness for all child tasks
    await this.recomputeChildrenReadiness(taskId)

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async approveTask(
    taskId: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
    })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })
    if (task.status !== KanbanTaskStatus.IN_REVIEW) {
      throw new HTTPException(400, {
        message: `Task cannot be approved from '${task.status}' status (must be IN_REVIEW)`,
      })
    }

    // Permission: caller must be reporter OR owner OR editor
    const isReporter = task.reporterId === actorId
    const isOwnerOrEditor = callerRole === 'owner' || callerRole === 'editor'
    if (!isReporter && !isOwnerOrEditor) {
      throw new HTTPException(403, { message: 'Permission denied to approve this task' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.kanbanTask.update({
        where: { id: taskId },
        data: {
          status: KanbanTaskStatus.DONE,
          completedAt: new Date(),
        },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      if (task.latestRunId) {
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
          type: KanbanTaskEventType.STATUS_CHANGED,
          fromStatus: KanbanTaskStatus.IN_REVIEW,
          toStatus: KanbanTaskStatus.DONE,
          data: { summary: 'Approved by reviewer' },
        },
      })

      return t
    })

    await this.recomputeChildrenReadiness(taskId)

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async requestChanges(
    taskId: string,
    reason: string,
    actorId: string,
    callerRole?: TeamMemberRole | null,
  ): Promise<KanbanTaskInfo> {
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
    if (task.status !== KanbanTaskStatus.IN_REVIEW) {
      throw new HTTPException(400, {
        message: `Changes cannot be requested from '${task.status}' status (must be IN_REVIEW)`,
      })
    }

    const isReporter = task.reporterId === actorId
    const isOwnerOrEditor = callerRole === 'owner' || callerRole === 'editor'
    if (!isReporter && !isOwnerOrEditor) {
      throw new HTTPException(403, { message: 'Permission denied to request changes on this task' })
    }

    // Determine if next status should be READY or TODO based on parent dependencies & startDate
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

      // Add reviewer comment
      await tx.kanbanTaskComment.create({
        data: {
          taskId,
          authorId: actorId,
          body: `[Changes Requested] ${reason}`,
        },
      })

      // Log CHANGES_REQUESTED event
      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.CHANGES_REQUESTED,
          fromStatus: KanbanTaskStatus.IN_REVIEW,
          toStatus: nextStatus,
          data: { reason },
        },
      })

      return t
    })

    if (nextStatus === KanbanTaskStatus.READY && task.type === KanbanTaskType.AGENTIC) {
      kanbanDispatcher.nudge(task.id)
    }

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async unblockTask(taskId: string, actorId: string): Promise<KanbanTaskInfo> {
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
    if (task.status !== KanbanTaskStatus.BLOCKED) {
      throw new HTTPException(400, {
        message: `Task cannot be unblocked from '${task.status}' status (must be BLOCKED)`,
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

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.UNBLOCKED,
          fromStatus: KanbanTaskStatus.BLOCKED,
          toStatus: nextStatus,
        },
      })

      return t
    })

    if (nextStatus === KanbanTaskStatus.READY && task.type === KanbanTaskType.AGENTIC) {
      kanbanDispatcher.nudge(task.id)
    }

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
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
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async reopenTask(taskId: string, actorId: string): Promise<KanbanTaskInfo> {
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
    if (task.status !== KanbanTaskStatus.DONE) {
      throw new HTTPException(400, {
        message: `Task cannot be reopened from '${task.status}' status (must be DONE)`,
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
        data: {
          status: nextStatus,
          completedAt: null,
        },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.STATUS_CHANGED,
          fromStatus: KanbanTaskStatus.DONE,
          toStatus: nextStatus,
        },
      })

      // Invalidate descendants recursively
      await this.invalidateDescendants(taskId, actorId, tx)

      return t
    })

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
  }

  async cancelTask(taskId: string, actorId: string): Promise<KanbanTaskInfo> {
    const task = await prisma.kanbanTask.findUnique({
      where: { id: taskId },
      include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
    })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })
    if (task.status === KanbanTaskStatus.CANCELLED) {
      const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, task.status)
      const counts = await this.getTaskCounts(taskId)
      return this.toTaskInfo(task, { latestStatusEvent, ...counts })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.kanbanTask.update({
        where: { id: taskId },
        data: { status: KanbanTaskStatus.CANCELLED },
        include: { creator: true, reporter: true, assignee: true, goal: true, latestRun: true },
      })

      if (task.latestRunId) {
        await tx.kanbanTaskRun.update({
          where: { id: task.latestRunId },
          data: {
            status: KanbanTaskRunStatus.CANCELLED,
            endedAt: new Date(),
          },
        })
      }

      await tx.kanbanTaskEvent.create({
        data: {
          taskId,
          actorId,
          type: KanbanTaskEventType.CANCELLED,
          fromStatus: task.status,
          toStatus: KanbanTaskStatus.CANCELLED,
        },
      })

      // Recursively cancel all downstream children
      await this.cancelDescendants(taskId, actorId, tx)

      return t
    })

    const latestStatusEvent = await this.resolveLatestStatusEvent(taskId, updated.status)
    const counts = await this.getTaskCounts(taskId)
    return this.toTaskInfo(updated, { latestStatusEvent, ...counts })
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
  // Comments & Events
  // --------------------------------------------------------------------------

  async addComment(taskId: string, authorId: string, body: string): Promise<KanbanCommentInfo> {
    const task = await prisma.kanbanTask.findUnique({ where: { id: taskId } })
    if (!task) throw new HTTPException(404, { message: 'Task not found' })

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.kanbanTaskComment.create({
        data: { taskId, authorId, body },
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

    return {
      id: comment.id,
      taskId: comment.taskId,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        image: comment.author.image ?? undefined,
      },
      body: comment.body,
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

    return comments.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      author: {
        id: c.author.id,
        name: c.author.name,
        image: c.author.image ?? undefined,
      },
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  async listEvents(taskId: string): Promise<KanbanEventInfo[]> {
    const events = await prisma.kanbanTaskEvent.findMany({
      where: { taskId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
    })

    return events.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      actor: e.actor
        ? {
            id: e.actor.id,
            name: e.actor.name,
            image: e.actor.image ?? undefined,
          }
        : null,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      data: (e.data as Record<string, unknown>) ?? null,
      createdAt: e.createdAt.toISOString(),
    }))
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
            image: event.actor.image ?? undefined,
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

  private toTaskInfo(
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
  ): KanbanTaskInfo {
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
      creator: {
        id: task.creator.id,
        name: task.creator.name,
        image: task.creator.image ?? undefined,
      },
      reporter: task.reporter
        ? {
            id: task.reporter.id,
            name: task.reporter.name,
            image: task.reporter.image ?? undefined,
          }
        : null,
      assignee: task.assignee
        ? {
            id: task.assignee.id,
            name: task.assignee.name,
            image: task.assignee.image ?? undefined,
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
