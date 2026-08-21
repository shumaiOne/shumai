import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { KanbanTaskStatus, KanbanTaskPriority } from '@shumai/db/enums'
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
        name: 'Kanban Core Team',
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
  describe('Goals', () => {
    it('creates, lists, updates, and deletes goals', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      const goal = await kanbanService.createGoal(
        team.id,
        {
          title: 'Q3 Launch Release',
          description: 'Ship all core kanban features',
        },
        owner.id,
        'owner',
      )

      expect(goal).toBeDefined()
      expect(goal.title).toBe('Q3 Launch Release')
      expect(goal.taskCount).toBe(0)

      // Create a task under this goal
      await kanbanService.createTask(
        team.id,
        {
          title: 'Design Wireframes',
          goalId: goal.id,
        },
        editor.id,
        'editor',
      )

      // Get goal progress
      const listedGoals = await kanbanService.listGoals(team.id)
      expect(listedGoals.length).toBe(1)
      expect(listedGoals[0].taskCount).toBe(1)

      // Update goal
      const updated = await kanbanService.updateGoal(
        goal.id,
        { title: 'Q3 Launch Release Updated' },
        'owner',
      )
      expect(updated.title).toBe('Q3 Launch Release Updated')

      // Delete goal
      await kanbanService.deleteGoal(goal.id, 'owner')
      const afterDelete = await kanbanService.listGoals(team.id)
      expect(afterDelete.length).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Tasks CRUD & Status
  // --------------------------------------------------------------------------
  describe('Tasks CRUD & Permissions', () => {
    it('allows owners and editors to create tasks and starts in TODO', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      // Owner can create Agent Task
      const agentTask = await kanbanService.createTask(
        team.id,
        {
          title: 'AI Task 1',
          isAgentTask: true,
        },
        owner.id,
        'owner',
      )
      expect(agentTask.isAgentTask).toBe(true)
      expect(agentTask.status).toBe(KanbanTaskStatus.TODO)

      // Editor can create Agent Task
      const editorAgentTask = await kanbanService.createTask(
        team.id,
        {
          title: 'Editor AI Task',
          isAgentTask: true,
        },
        editor.id,
        'editor',
      )
      expect(editorAgentTask.isAgentTask).toBe(true)
      expect(editorAgentTask.status).toBe(KanbanTaskStatus.TODO)

      // Editor can create Standard Task
      const manualTask = await kanbanService.createTask(
        team.id,
        {
          title: 'Manual Task 1',
          isAgentTask: false,
        },
        editor.id,
        'editor',
      )
      expect(manualTask.isAgentTask).toBe(false)
      expect(manualTask.status).toBe(KanbanTaskStatus.TODO)
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

    it('syncs parent dependencies via setDependencies and updateTask', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const task1 = await kanbanService.createTask(
        team.id,
        { title: 'Parent 1' },
        editor.id,
        'editor',
      )
      const task2 = await kanbanService.createTask(
        team.id,
        { title: 'Parent 2' },
        editor.id,
        'editor',
      )
      const task3 = await kanbanService.createTask(
        team.id,
        { title: 'Parent 3' },
        editor.id,
        'editor',
      )
      const child = await kanbanService.createTask(team.id, { title: 'Child' }, editor.id, 'editor')

      // Set initial parents [task1, task2]
      await kanbanService.setDependencies(child.id, [task1.id, task2.id], editor.id)
      let detail = await kanbanService.getTask(child.id)
      expect(detail.dependencies.map((d) => d.id).sort()).toEqual([task1.id, task2.id].sort())

      // Update parents to [task2, task3] via updateTask (removes task1, adds task3)
      await kanbanService.updateTask(
        child.id,
        { parentIds: [task2.id, task3.id] },
        editor.id,
        'editor',
      )
      detail = await kanbanService.getTask(child.id)
      expect(detail.dependencies.map((d) => d.id).sort()).toEqual([task2.id, task3.id].sort())

      // Clear parents
      await kanbanService.updateTask(child.id, { parentIds: [] }, editor.id, 'editor')
      detail = await kanbanService.getTask(child.id)
      expect(detail.dependencies.length).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Task Listing with Status Event
  // --------------------------------------------------------------------------
  describe('Task Listing and Status Event Details', () => {
    it('attaches latestStatusEvent and filters by isAgentTask, status, goal', async () => {
      const { team, owner, editor } = await setupTeamAndUsers()

      const goal = await kanbanService.createGoal(team.id, { title: 'Q3 Goal' }, owner.id, 'owner')

      const task1 = await kanbanService.createTask(
        team.id,
        {
          title: 'Manual 1',
          isAgentTask: false,
          goalId: goal.id,
          priority: KanbanTaskPriority.HIGH,
        },
        editor.id,
        'editor',
      )
      const task2 = await kanbanService.createTask(
        team.id,
        { title: 'Agent 1', isAgentTask: true },
        owner.id,
        'owner',
      )

      // Filter by isAgentTask: false
      const manualList = await kanbanService.listTasks(team.id, { isAgentTask: false })
      expect(manualList.data.length).toBe(1)
      expect(manualList.data[0].id).toBe(task1.id)
      expect(manualList.data[0].latestStatusEvent).toBeDefined()

      // Filter by goalId
      const goalList = await kanbanService.listTasks(team.id, { goalId: goal.id })
      expect(goalList.data.length).toBe(1)
      expect(goalList.data[0].id).toBe(task1.id)

      // Filter by isAgentTask: true
      const agentList = await kanbanService.listTasks(team.id, { isAgentTask: true })
      expect(agentList.data.length).toBe(1)
      expect(agentList.data[0].id).toBe(task2.id)
    })

    it('deletes tasks properly with permissions', async () => {
      const { team, editor, reviewer } = await setupTeamAndUsers()

      const task = await kanbanService.createTask(
        team.id,
        { title: 'Task to Delete', isAgentTask: false },
        editor.id,
        'editor',
      )

      // Reviewer (not creator, not owner, not reporter) cannot delete
      await expect(kanbanService.deleteTask(task.id, reviewer.id, 'reviewer')).rejects.toThrow()

      // Creator (editor) can delete
      const deleted = await kanbanService.deleteTask(task.id, editor.id, 'editor')
      expect(deleted.id).toBe(task.id)

      // Confirm deleted from db
      const fromDb = await prisma.kanbanTask.findUnique({ where: { id: task.id } })
      expect(fromDb).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // Unified Status Transitions & Permissions
  // --------------------------------------------------------------------------
  describe('Unified Status Transitions & Task Status Permissions', () => {
    it('allows tasks to transition between any states via updateTask', async () => {
      const { team, editor } = await setupTeamAndUsers()

      const task = await kanbanService.createTask(
        team.id,
        { title: 'Flexible Human Task', isAgentTask: false },
        editor.id,
        'editor',
      )
      expect(task.status).toBe(KanbanTaskStatus.TODO)

      // Direct transition: TODO -> IN_PROGRESS
      const inProgress = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.IN_PROGRESS },
        editor.id,
      )
      expect(inProgress.status).toBe(KanbanTaskStatus.IN_PROGRESS)
      expect(inProgress.startedAt).toBeDefined()

      // Direct transition: IN_PROGRESS -> BLOCKED
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
      const reopened = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.IN_PROGRESS },
        editor.id,
      )
      expect(reopened.status).toBe(KanbanTaskStatus.IN_PROGRESS)
      expect(reopened.completedAt).toBeNull()

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

    it('enforces status change permissions (only owner, reporter, or assignee can change status)', async () => {
      const { team, owner, editor, reviewer } = await setupTeamAndUsers()

      // Create another editor in team who is NOT reporter and NOT assignee
      const otherEditor = await prisma.user.create({
        data: { name: 'Other Editor', email: 'other-editor@example.com' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: otherEditor.id, role: 'editor', scope: 'team' },
      })

      // Create a task: reporter is editor, assignee is reviewer
      const task = await kanbanService.createTask(
        team.id,
        {
          title: 'Guarded Task',
          reporterId: editor.id,
          assigneeId: reviewer.id,
        },
        editor.id,
        'editor',
      )

      // Other editor tries to change status -> rejected with 403
      await expect(
        kanbanService.updateTask(
          task.id,
          { status: KanbanTaskStatus.IN_PROGRESS },
          otherEditor.id,
          'editor',
        ),
      ).rejects.toThrow(/Only team owners, task reporters, or assignees can change task status/)

      // Other editor CAN update non-status fields (e.g. description)
      const descUpdated = await kanbanService.updateTask(
        task.id,
        { description: 'Updated by other editor' },
        otherEditor.id,
        'editor',
      )
      expect(descUpdated.description).toBe('Updated by other editor')

      // Reporter (editor) CAN change status -> succeeds
      const reporterUpdated = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.IN_PROGRESS },
        editor.id,
        'editor',
      )
      expect(reporterUpdated.status).toBe(KanbanTaskStatus.IN_PROGRESS)

      // Assignee (reviewer) CAN change status -> succeeds
      const assigneeUpdated = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.IN_REVIEW },
        reviewer.id,
        'reviewer',
      )
      expect(assigneeUpdated.status).toBe(KanbanTaskStatus.IN_REVIEW)

      // Owner CAN change status -> succeeds
      const ownerUpdated = await kanbanService.updateTask(
        task.id,
        { status: KanbanTaskStatus.DONE },
        owner.id,
        'owner',
      )
      expect(ownerUpdated.status).toBe(KanbanTaskStatus.DONE)
    })
  })

  // --------------------------------------------------------------------------
  // Comments and Attachments
  // --------------------------------------------------------------------------
  describe('Comments and Attachments', () => {
    it('creates attachments, adds comment with attachments, and deletes comment', async () => {
      const { team, owner, editor, reviewer } = await setupTeamAndUsers()

      const task = await kanbanService.createTask(
        team.id,
        { title: 'Task with Attachments' },
        editor.id,
        'editor',
      )

      // Create attachment
      const att = await kanbanService.createAttachment(team.id, {
        fileName: 'design.png',
        size: 1024,
        contentType: 'image/png',
      })
      expect(att.id).toBeDefined()
      expect(att.uploadUrl).toBeDefined()
      expect(att.proxyType).toBe('image')

      // Add comment with attachment
      const comment = await kanbanService.addComment(task.id, editor.id, 'Here is the design', [
        {
          id: att.id,
          name: att.name,
          key: att.key,
          sizeByte: att.sizeByte,
          contentType: att.contentType,
          proxyType: att.proxyType,
        },
      ])
      expect(comment.id).toBeDefined()
      expect(comment.attachments.length).toBe(1)
      expect(comment.attachments[0].name).toBe('design.png')
      expect(comment.attachments[0].url).toBeDefined()

      // List comments
      const list = await kanbanService.listComments(task.id)
      expect(list.length).toBe(1)
      expect(list[0].attachments.length).toBe(1)

      // Non-author reviewer cannot delete comment
      await expect(
        kanbanService.deleteComment(task.id, comment.id, reviewer.id, 'reviewer'),
      ).rejects.toThrow(/Not authorized/)

      // Team owner can delete comment
      await kanbanService.deleteComment(task.id, comment.id, owner.id, 'owner')
      const afterDelete = await kanbanService.listComments(task.id)
      expect(afterDelete.length).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Task Ordering & Fractional Indexing
  // --------------------------------------------------------------------------
  describe('Task Ordering & Fractional Indexing', () => {
    it('appends newly created tasks to the bottom of the column', async () => {
      const { team, owner } = await setupTeamAndUsers()

      const task1 = await kanbanService.createTask(team.id, { title: 'Task 1' }, owner.id, 'owner')
      const task2 = await kanbanService.createTask(team.id, { title: 'Task 2' }, owner.id, 'owner')
      const task3 = await kanbanService.createTask(team.id, { title: 'Task 3' }, owner.id, 'owner')

      expect(task1.sortIndex).toBeDefined()
      expect(task2.sortIndex).toBeDefined()
      expect(task3.sortIndex).toBeDefined()
      expect(task1.sortIndex! < task2.sortIndex!).toBe(true)
      expect(task2.sortIndex! < task3.sortIndex!).toBe(true)

      const list = await kanbanService.listTasks(team.id, { status: KanbanTaskStatus.TODO })
      expect(list.data.map((t) => t.id)).toEqual([task1.id, task2.id, task3.id])
    })

    it('reorders tasks within the same column using beforeIndex and afterIndex', async () => {
      const { team, owner } = await setupTeamAndUsers()

      const taskA = await kanbanService.createTask(team.id, { title: 'Task A' }, owner.id, 'owner')
      const taskB = await kanbanService.createTask(team.id, { title: 'Task B' }, owner.id, 'owner')
      const taskC = await kanbanService.createTask(team.id, { title: 'Task C' }, owner.id, 'owner')

      // Move task C before task A
      const updatedC = await kanbanService.updateTask(
        taskC.id,
        { beforeIndex: taskA.sortIndex! },
        owner.id,
        'owner',
      )
      expect(updatedC.sortIndex! < taskA.sortIndex!).toBe(true)

      let list = await kanbanService.listTasks(team.id, { status: KanbanTaskStatus.TODO })
      expect(list.data.map((t) => t.id)).toEqual([taskC.id, taskA.id, taskB.id])

      // Move task C after task A (between A and B)
      const reorderedTaskC = await kanbanService.updateTask(
        taskC.id,
        { afterIndex: taskA.sortIndex! },
        owner.id,
        'owner',
      )
      expect(reorderedTaskC.sortIndex! > taskA.sortIndex!).toBe(true)
      expect(reorderedTaskC.sortIndex! < taskB.sortIndex!).toBe(true)

      list = await kanbanService.listTasks(team.id, { status: KanbanTaskStatus.TODO })
      expect(list.data.map((t) => t.id)).toEqual([taskA.id, taskC.id, taskB.id])
    })

    it('moves tasks across columns with custom position', async () => {
      const { team, owner } = await setupTeamAndUsers()

      const task1 = await kanbanService.createTask(team.id, { title: 'Task 1' }, owner.id, 'owner')
      const task2 = await kanbanService.createTask(team.id, { title: 'Task 2' }, owner.id, 'owner')

      // Start task1 so it's in IN_PROGRESS
      const inProgressTask1 = await kanbanService.updateTask(
        task1.id,
        { status: KanbanTaskStatus.IN_PROGRESS },
        owner.id,
        'owner',
      )

      // Now move task2 to IN_PROGRESS before task1
      const updatedTask2 = await kanbanService.updateTask(
        task2.id,
        {
          status: KanbanTaskStatus.IN_PROGRESS,
          beforeIndex: inProgressTask1.sortIndex!,
        },
        owner.id,
        'owner',
      )

      expect(updatedTask2.status).toBe(KanbanTaskStatus.IN_PROGRESS)
      expect(updatedTask2.sortIndex! < inProgressTask1.sortIndex!).toBe(true)

      const inProgressList = await kanbanService.listTasks(team.id, {
        status: KanbanTaskStatus.IN_PROGRESS,
      })
      expect(inProgressList.data.map((t) => t.id)).toEqual([task2.id, task1.id])
    })

    it('moves tasks across columns without explicit position placing at bottom', async () => {
      const { team, owner } = await setupTeamAndUsers()

      const task1 = await kanbanService.createTask(team.id, { title: 'Task 1' }, owner.id, 'owner')
      const task2 = await kanbanService.createTask(team.id, { title: 'Task 2' }, owner.id, 'owner')

      // Move task1 to DONE
      const doneTask1 = await kanbanService.updateTask(
        task1.id,
        { status: KanbanTaskStatus.DONE },
        owner.id,
        'owner',
      )

      // Move task2 to DONE without position
      const updatedTask2 = await kanbanService.updateTask(
        task2.id,
        { status: KanbanTaskStatus.DONE },
        owner.id,
        'owner',
      )

      expect(updatedTask2.status).toBe(KanbanTaskStatus.DONE)
      expect(updatedTask2.sortIndex! > doneTask1.sortIndex!).toBe(true)

      const doneList = await kanbanService.listTasks(team.id, { status: KanbanTaskStatus.DONE })
      expect(doneList.data.map((t) => t.id)).toEqual([task1.id, task2.id])
    })
  })
})
