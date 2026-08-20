import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import {
  KanbanTaskType,
  KanbanTaskStatus,
  KanbanTaskPriority,
  KanbanTaskRunStatus,
} from '@shumai/db/enums'
import { kanbanService } from './kanban'

describe('KanbanService', () => {
  setupTestDbHooks()

  async function setupTeamAndUsers() {
    const owner = await prisma.user.create({
      data: { name: 'Team Owner', email: 'owner@example.com' },
    })
    const editor = await prisma.user.create({
      data: { name: 'Team Editor', email: 'editor@example.com' },
    })
    const reviewer = await prisma.user.create({
      data: { name: 'Team Reviewer', email: 'reviewer@example.com' },
    })

    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        settings: {
          transcode: { videoStrategy: 'best_match' },
        },
      },
    })

    await prisma.teamMember.createMany({
      data: [
        { teamId: team.id, userId: owner.id, role: 'owner', scope: 'team' },
        { teamId: team.id, userId: editor.id, role: 'editor', scope: 'team' },
        { teamId: team.id, userId: reviewer.id, role: 'reviewer', scope: 'team' },
      ],
    })

    return { team, owner, editor, reviewer }
  }

  // --------------------------------------------------------------------------
  // Goals
  // --------------------------------------------------------------------------
  describe('Goals CRUD and Permissions', () => {
    it('allows owner to create, update, delete goals and counts tasks', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      // Owner can create goal
      const goal = await kanbanService.createGoal(
        team.id,
        { title: 'Launch v1', description: 'Initial product release' },
        owner.id,
        'owner',
      )
      expect(goal.id).toBeDefined()
      expect(goal.title).toBe('Launch v1')
      expect(goal.taskCount).toBe(0)

      // Editor cannot create goal (throws 403)
      await expect(
        kanbanService.createGoal(team.id, { title: 'Editor Goal' }, editor.id, 'editor'),
      ).rejects.toThrow()

      // Create a task associated with this goal
      await kanbanService.createTask(
        team.id,
        { title: 'Task in Goal', goalId: goal.id },
        owner.id,
        'owner',
      )

      // Get goal reflects taskCount
      const fetched = await kanbanService.getGoal(goal.id)
      expect(fetched.taskCount).toBe(1)

      // List goals
      const list = await kanbanService.listGoals(team.id)
      expect(list.length).toBe(1)
      expect(list[0].taskCount).toBe(1)

      // Owner updates goal
      const updated = await kanbanService.updateGoal(
        goal.id,
        { title: 'Launch v1.1', description: 'Updated description' },
        'owner',
      )
      expect(updated.title).toBe('Launch v1.1')

      // Editor cannot update goal
      await expect(kanbanService.updateGoal(goal.id, { title: 'Hack' }, 'editor')).rejects.toThrow()

      // Owner deletes goal
      await kanbanService.deleteGoal(goal.id, 'owner')
      await expect(kanbanService.getGoal(goal.id)).rejects.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // Tasks Creation & Cost Protection
  // --------------------------------------------------------------------------
  describe('Task Creation & Permissions', () => {
    it('restricts AGENTIC task creation to owner', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      // Owner can create AGENTIC task
      const agentTask = await kanbanService.createTask(
        team.id,
        {
          title: 'AI Task 1',
          type: KanbanTaskType.AGENTIC,
        },
        owner.id,
        'owner',
      )
      expect(agentTask.type).toBe(KanbanTaskType.AGENTIC)
      expect(agentTask.status).toBe(KanbanTaskStatus.READY)

      // Editor cannot create AGENTIC task (throws 403)
      await expect(
        kanbanService.createTask(
          team.id,
          {
            title: 'Unauthorized AI Task',
            type: KanbanTaskType.AGENTIC,
          },
          editor.id,
          'editor',
        ),
      ).rejects.toThrow()

      // Editor can create MANUAL task
      const manualTask = await kanbanService.createTask(
        team.id,
        {
          title: 'Manual Task 1',
          type: KanbanTaskType.MANUAL,
        },
        editor.id,
        'editor',
      )
      expect(manualTask.type).toBe(KanbanTaskType.MANUAL)
      expect(manualTask.status).toBe(KanbanTaskStatus.READY)
    })

    it('sets initial status to TODO if parents exist and are not DONE or startDate in future', async () => {
      const { team, owner } = await setupTeamAndUsers()

      const parentTask = await kanbanService.createTask(
        team.id,
        { title: 'Parent Task' },
        owner.id,
        'owner',
      )
      expect(parentTask.status).toBe(KanbanTaskStatus.READY)

      // Child with unfinished parent starts as TODO
      const childTask = await kanbanService.createTask(
        team.id,
        {
          title: 'Child Task',
          parentIds: [parentTask.id],
        },
        owner.id,
        'owner',
      )
      expect(childTask.status).toBe(KanbanTaskStatus.TODO)

      // Task with future startDate starts as TODO
      const futureDate = new Date(Date.now() + 86400000)
      const futureTask = await kanbanService.createTask(
        team.id,
        {
          title: 'Future Task',
          startDate: futureDate,
        },
        owner.id,
        'owner',
      )
      expect(futureTask.status).toBe(KanbanTaskStatus.TODO)
    })
  })

  // --------------------------------------------------------------------------
  // Manual Task Lifecycle
  // --------------------------------------------------------------------------
  describe('Manual Task Lifecycle & Child Readiness', () => {
    it('transitions READY -> IN_PROGRESS -> DONE and unlocks child tasks', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const taskA = await kanbanService.createTask(
        team.id,
        { title: 'Task A' },
        editor.id,
        'editor',
      )
      const taskB = await kanbanService.createTask(
        team.id,
        { title: 'Task B', parentIds: [taskA.id] },
        editor.id,
        'editor',
      )

      expect(taskA.status).toBe(KanbanTaskStatus.READY)
      expect(taskB.status).toBe(KanbanTaskStatus.TODO)

      // Start Task A
      const startedA = await kanbanService.startManualTask(taskA.id, editor.id)
      expect(startedA.status).toBe(KanbanTaskStatus.IN_PROGRESS)
      expect(startedA.startedAt).toBeDefined()

      // Complete Task A
      const completedA = await kanbanService.completeManualTask(taskA.id, editor.id)
      expect(completedA.status).toBe(KanbanTaskStatus.DONE)
      expect(completedA.completedAt).toBeDefined()

      // Task B should automatically become READY
      const refreshedB = await kanbanService.getTask(taskB.id)
      expect(refreshedB.status).toBe(KanbanTaskStatus.READY)
    })
  })

  // --------------------------------------------------------------------------
  // Review & Rework Lifecycle
  // --------------------------------------------------------------------------
  describe('Review & Rework Lifecycle', () => {
    it('allows designated editor reporter to approve or request changes on an AGENTIC task', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      // Owner creates AGENTIC task and assigns Editor as reporter
      const agentTask = await kanbanService.createTask(
        team.id,
        {
          title: 'Agent Review Task',
          type: KanbanTaskType.AGENTIC,
          reporterId: editor.id,
        },
        owner.id,
        'owner',
      )

      // Simulate an active run in IN_REVIEW
      const run = await prisma.kanbanTaskRun.create({
        data: {
          taskId: agentTask.id,
          status: KanbanTaskRunStatus.REVIEW_REQUESTED,
          attempt: 1,
          claimToken: 'token-1',
          summary: 'Finished first pass',
        },
      })
      await prisma.kanbanTask.update({
        where: { id: agentTask.id },
        data: {
          status: KanbanTaskStatus.IN_REVIEW,
          latestRunId: run.id,
        },
      })

      // Editor (as reporter) requests changes
      const afterChanges = await kanbanService.requestChanges(
        agentTask.id,
        'Please fix the headers',
        editor.id,
        'editor',
      )
      expect(afterChanges.status).toBe(KanbanTaskStatus.READY)

      // Check comments and events
      const comments = await kanbanService.listComments(agentTask.id)
      expect(comments.length).toBe(1)
      expect(comments[0].body).toContain('Please fix the headers')

      // Put back in IN_REVIEW
      await prisma.kanbanTask.update({
        where: { id: agentTask.id },
        data: { status: KanbanTaskStatus.IN_REVIEW },
      })

      // Editor approves task
      const approved = await kanbanService.approveTask(agentTask.id, editor.id, 'editor')
      expect(approved.status).toBe(KanbanTaskStatus.DONE)
      expect(approved.completedAt).toBeDefined()

      const finishedRun = await prisma.kanbanTaskRun.findUnique({ where: { id: run.id } })
      expect(finishedRun?.status).toBe(KanbanTaskRunStatus.COMPLETED)
    })
  })

  // --------------------------------------------------------------------------
  // Unblock, Reclaim & Cancel
  // --------------------------------------------------------------------------
  describe('Unblock, Reclaim, and Cancel', () => {
    it('unblocks blocked task to READY if parents are satisfied', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const task = await kanbanService.createTask(
        team.id,
        { title: 'Blockable Task' },
        editor.id,
        'editor',
      )

      await prisma.kanbanTask.update({
        where: { id: task.id },
        data: { status: KanbanTaskStatus.BLOCKED },
      })

      const unblocked = await kanbanService.unblockTask(task.id, editor.id)
      expect(unblocked.status).toBe(KanbanTaskStatus.READY)
    })

    it('cancels task and all downstream descendants', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const taskA = await kanbanService.createTask(
        team.id,
        { title: 'Parent' },
        editor.id,
        'editor',
      )
      const taskB = await kanbanService.createTask(
        team.id,
        { title: 'Child', parentIds: [taskA.id] },
        editor.id,
        'editor',
      )
      const taskC = await kanbanService.createTask(
        team.id,
        { title: 'Grandchild', parentIds: [taskB.id] },
        editor.id,
        'editor',
      )

      // Cancel parent taskA
      const cancelledA = await kanbanService.cancelTask(taskA.id, editor.id)
      expect(cancelledA.status).toBe(KanbanTaskStatus.CANCELLED)

      const refreshedB = await kanbanService.getTask(taskB.id)
      const refreshedC = await kanbanService.getTask(taskC.id)
      expect(refreshedB.status).toBe(KanbanTaskStatus.CANCELLED)
      expect(refreshedC.status).toBe(KanbanTaskStatus.CANCELLED)
    })
  })

  // --------------------------------------------------------------------------
  // Reopen & Descendant Invalidation
  // --------------------------------------------------------------------------
  describe('Reopen Task & Descendant Invalidation', () => {
    it('demotes all downstream children from DONE/READY back to TODO when ancestor is reopened', async () => {
      const { team, editor } = await setupTeamAndUsers()

      // Create chain: A -> B -> C
      const taskA = await kanbanService.createTask(team.id, { title: 'A' }, editor.id, 'editor')
      const taskB = await kanbanService.createTask(
        team.id,
        { title: 'B', parentIds: [taskA.id] },
        editor.id,
        'editor',
      )
      const taskC = await kanbanService.createTask(
        team.id,
        { title: 'C', parentIds: [taskB.id] },
        editor.id,
        'editor',
      )

      // Complete A
      await kanbanService.startManualTask(taskA.id, editor.id)
      await kanbanService.completeManualTask(taskA.id, editor.id)

      // Complete B
      await kanbanService.startManualTask(taskB.id, editor.id)
      await kanbanService.completeManualTask(taskB.id, editor.id)

      // C is now READY
      const readyC = await kanbanService.getTask(taskC.id)
      expect(readyC.status).toBe(KanbanTaskStatus.READY)

      // Reopen A
      const reopenedA = await kanbanService.reopenTask(taskA.id, editor.id)
      expect(reopenedA.status).toBe(KanbanTaskStatus.READY)
      expect(reopenedA.completedAt).toBeNull()

      // B and C must both be demoted back to TODO
      const refreshedB = await kanbanService.getTask(taskB.id)
      const refreshedC = await kanbanService.getTask(taskC.id)
      expect(refreshedB.status).toBe(KanbanTaskStatus.TODO)
      expect(refreshedB.completedAt).toBeNull()
      expect(refreshedC.status).toBe(KanbanTaskStatus.TODO)

      // Verify audit comments were injected
      const commentsB = await kanbanService.listComments(taskB.id)
      expect(commentsB.some((c) => c.body.includes('Invalidated: ancestor'))).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // DAG Cycles & Dependencies
  // --------------------------------------------------------------------------
  describe('DAG Cycle Detection', () => {
    it('prevents self dependency and circular dependency chains', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const taskA = await kanbanService.createTask(team.id, { title: 'A' }, editor.id, 'editor')
      const taskB = await kanbanService.createTask(team.id, { title: 'B' }, editor.id, 'editor')
      const taskC = await kanbanService.createTask(team.id, { title: 'C' }, editor.id, 'editor')

      // Self dependency
      await expect(kanbanService.addDependency(taskA.id, taskA.id, editor.id)).rejects.toThrow()

      // Chain: A -> B -> C
      await kanbanService.addDependency(taskA.id, taskB.id, editor.id)
      await kanbanService.addDependency(taskB.id, taskC.id, editor.id)

      // Attempt cycle: C -> A (would create A -> B -> C -> A)
      await expect(kanbanService.addDependency(taskC.id, taskA.id, editor.id)).rejects.toThrow(
        /Circular dependency detected/,
      )

      // Remove dependency B -> C
      await kanbanService.removeDependency(taskB.id, taskC.id, editor.id)

      // Now C -> A is allowed since chain is broken
      await kanbanService.addDependency(taskC.id, taskA.id, editor.id)
    })
  })

  // --------------------------------------------------------------------------
  // Task Listing with Status Event
  // --------------------------------------------------------------------------
  describe('Task Listing and Status Event Details', () => {
    it('attaches latestStatusEvent and filters by type, status, goal', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      const goal = await kanbanService.createGoal(team.id, { title: 'Q3 Goal' }, owner.id, 'owner')

      const task1 = await kanbanService.createTask(
        team.id,
        {
          title: 'Manual 1',
          type: KanbanTaskType.MANUAL,
          goalId: goal.id,
          priority: KanbanTaskPriority.HIGH,
        },
        editor.id,
        'editor',
      )
      const task2 = await kanbanService.createTask(
        team.id,
        { title: 'Agent 1', type: KanbanTaskType.AGENTIC },
        owner.id,
        'owner',
      )

      // Filter by MANUAL
      const manualList = await kanbanService.listTasks(team.id, { type: KanbanTaskType.MANUAL })
      expect(manualList.data.length).toBe(1)
      expect(manualList.data[0].id).toBe(task1.id)
      expect(manualList.data[0].latestStatusEvent).toBeDefined()

      // Filter by goalId
      const goalList = await kanbanService.listTasks(team.id, { goalId: goal.id })
      expect(goalList.data.length).toBe(1)
      expect(goalList.data[0].id).toBe(task1.id)

      // Filter by AGENTIC
      const agentList = await kanbanService.listTasks(team.id, { type: KanbanTaskType.AGENTIC })
      expect(agentList.data.length).toBe(1)
      expect(agentList.data[0].id).toBe(task2.id)
    })
  })

  // --------------------------------------------------------------------------
  // Unified Status Transitions & Unconstrained Human Tasks
  // --------------------------------------------------------------------------
  describe('Unified Status Transitions & Unconstrained Human Tasks', () => {
    it('allows human tasks to transition between any states via updateTask', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const task = await kanbanService.createTask(
        team.id,
        { title: 'Flexible Human Task', type: KanbanTaskType.MANUAL },
        editor.id,
        'editor',
      )
      expect(task.status).toBe(KanbanTaskStatus.READY)

      // Direct transition: READY -> BLOCKED
      const blocked = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.BLOCKED, reason: 'Waiting for design' },
        editor.id,
      )
      expect(blocked.status).toBe(KanbanTaskStatus.BLOCKED)

      // Direct transition: BLOCKED -> DONE
      const done = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.DONE },
        editor.id,
      )
      expect(done.status).toBe(KanbanTaskStatus.DONE)
      expect(done.completedAt).toBeDefined()

      // Direct transition: DONE -> IN_PROGRESS (re-open directly into progress)
      const inProgress = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.IN_PROGRESS },
        editor.id,
      )
      expect(inProgress.status).toBe(KanbanTaskStatus.IN_PROGRESS)
      expect(inProgress.completedAt).toBeNull()

      // Direct transition: IN_PROGRESS -> IN_REVIEW
      const inReview = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.IN_REVIEW },
        editor.id,
      )
      expect(inReview.status).toBe(KanbanTaskStatus.IN_REVIEW)

      // Direct transition: IN_REVIEW -> TODO
      const todo = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.TODO },
        editor.id,
      )
      expect(todo.status).toBe(KanbanTaskStatus.TODO)
    })

    it('enforces agentic task boundaries (rejects direct transition to IN_PROGRESS)', async () => {
      const { team, owner } = await setupTeamAndUsers()

      const agentTask = await kanbanService.createTask(
        team.id,
        { title: 'Agent Task', type: KanbanTaskType.AGENTIC },
        owner.id,
        'owner',
      )

      await expect(
        kanbanService.updateTask(
          agentTask.id,
          { status: KanbanTaskStatus.IN_PROGRESS },
          owner.id,
          'owner',
        ),
      ).rejects.toThrow(/Agentic tasks are claimed automatically/)
    })
  })
})
