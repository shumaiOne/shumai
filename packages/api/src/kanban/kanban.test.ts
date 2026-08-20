import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono, type Context, type Next } from 'hono'
import { kanbanService } from '@shumai/core/src/kanban/kanban'
import { kanbanContextService } from '@shumai/core/src/kanban/kanban-context'
import {
  authzService,
  Permission,
  ResourceType,
  resolveEffectiveRole,
} from '@shumai/core/src/authz/authz'
import { KanbanTaskType, KanbanTaskStatus, KanbanTaskPriority } from '@shumai/db/enums'
import kanbanRoute from './index'

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  resolveEffectiveRole: vi.fn().mockResolvedValue('owner'),
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
  ResourceType: {
    Team: 'team',
    Project: 'project',
    KanbanGoal: 'kanbanGoal',
    KanbanTask: 'kanbanTask',
  },
}))

describe('Kanban API Routes', () => {
  const teamId = 'team-1'
  const taskId = 'task-1'
  const goalId = 'goal-1'

  const authMiddleware = async (c: Context, next: Next) => {
    c.set('user', { id: 'user-1', name: 'Test User' })
    await next()
  }

  const app = new Hono().use('*', authMiddleware).route('/', kanbanRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
    vi.mocked(resolveEffectiveRole).mockResolvedValue('owner')
  })

  // --------------------------------------------------------------------------
  // Goals Endpoints
  // --------------------------------------------------------------------------
  describe('Goals Endpoints', () => {
    it('POST /teams/:teamId/kanban/goals', async () => {
      const mockCreate = vi.spyOn(kanbanService, 'createGoal').mockResolvedValue({
        id: goalId,
        title: 'New Goal',
        description: 'Goal desc',
        teamId,
        creatorId: 'user-1',
        taskCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Goal', description: 'Goal desc' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe(goalId)
      expect(mockCreate).toHaveBeenCalledWith(teamId, expect.any(Object), 'user-1', 'owner')
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: expect.any(Object),
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })
    })

    it('GET /teams/:teamId/kanban/goals', async () => {
      const mockList = vi.spyOn(kanbanService, 'listGoals').mockResolvedValue([
        {
          id: goalId,
          title: 'Goal 1',
          teamId,
          creatorId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])

      const res = await app.request(`/teams/${teamId}/kanban/goals`)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data).toHaveLength(1)
      expect(mockList).toHaveBeenCalledWith(teamId, expect.any(Object))
    })

    it('GET /teams/:teamId/kanban/goals/:goalId', async () => {
      const mockGet = vi.spyOn(kanbanService, 'getGoal').mockResolvedValue({
        id: goalId,
        title: 'Goal 1',
        teamId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/goals/${goalId}`)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe(goalId)
      expect(mockGet).toHaveBeenCalledWith(goalId)
    })

    it('PATCH /teams/:teamId/kanban/goals/:goalId', async () => {
      const mockUpdate = vi.spyOn(kanbanService, 'updateGoal').mockResolvedValue({
        id: goalId,
        title: 'Updated Goal',
        teamId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Goal' }),
      })

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(goalId, { title: 'Updated Goal' }, 'owner')
    })

    it('DELETE /teams/:teamId/kanban/goals/:goalId', async () => {
      const mockDelete = vi.spyOn(kanbanService, 'deleteGoal').mockResolvedValue(undefined)

      const res = await app.request(`/teams/${teamId}/kanban/goals/${goalId}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      expect(mockDelete).toHaveBeenCalledWith(goalId, 'owner')
    })
  })

  // --------------------------------------------------------------------------
  // Tasks Endpoints
  // --------------------------------------------------------------------------
  describe('Tasks Endpoints', () => {
    it('POST /teams/:teamId/kanban/tasks', async () => {
      const mockCreate = vi.spyOn(kanbanService, 'createTask').mockResolvedValue({
        id: taskId,
        title: 'New Task',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User 1' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Task', type: 'MANUAL' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe(taskId)
      expect(mockCreate).toHaveBeenCalledWith(teamId, expect.any(Object), 'user-1', 'owner')
    })

    it('GET /teams/:teamId/kanban/tasks (with type and goal filters)', async () => {
      const mockList = vi.spyOn(kanbanService, 'listTasks').mockResolvedValue({
        data: [
          {
            id: taskId,
            title: 'Task 1',
            type: KanbanTaskType.MANUAL,
            status: KanbanTaskStatus.READY,
            priority: KanbanTaskPriority.MEDIUM,
            teamId,
            creator: { id: 'user-1', name: 'User 1' },
            commentCount: 0,
            dependencyCount: 0,
            dependentCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pageInfo: { total: 1 },
      })

      const res = await app.request(
        `/teams/${teamId}/kanban/tasks?type=MANUAL&status=READY&goalId=goal-1`,
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data).toHaveLength(1)
      expect(mockList).toHaveBeenCalledWith(
        teamId,
        expect.objectContaining({
          type: 'MANUAL',
          status: 'READY',
          goalId: 'goal-1',
        }),
      )
    })

    it('GET /teams/:teamId/kanban/tasks/:taskId', async () => {
      const mockGet = vi.spyOn(kanbanService, 'getTask').mockResolvedValue({
        id: taskId,
        title: 'Task 1',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User 1' },
        dependencies: [],
        dependents: [],
        runs: [],
        comments: [],
        events: [],
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}`)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe(taskId)
      expect(mockGet).toHaveBeenCalledWith(taskId)
    })

    it('PATCH /teams/:teamId/kanban/tasks/:taskId', async () => {
      const mockUpdate = vi.spyOn(kanbanService, 'updateTask').mockResolvedValue({
        id: taskId,
        title: 'Updated Task Title',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.HIGH,
        teamId,
        creator: { id: 'user-1', name: 'User 1' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'HIGH', status: 'DONE', reason: 'All done' }),
      })

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        taskId,
        { priority: 'HIGH', status: 'DONE', reason: 'All done' },
        'user-1',
        'owner',
      )
    })

    it('PATCH /teams/:teamId/kanban/tasks/:taskId with beforeIndex and afterIndex', async () => {
      const mockUpdate = vi.spyOn(kanbanService, 'updateTask').mockResolvedValue({
        id: taskId,
        title: 'Task 1',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.MEDIUM,
        sortIndex: 'a0V',
        teamId,
        creator: { id: 'user-1', name: 'User 1' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY', beforeIndex: 'a1', afterIndex: 'a0' }),
      })

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        taskId,
        { status: 'READY', beforeIndex: 'a1', afterIndex: 'a0' },
        'user-1',
        'owner',
      )
    })
  })

  // --------------------------------------------------------------------------
  // Lifecycle Actions
  // --------------------------------------------------------------------------
  describe('Task Lifecycle Actions', () => {
    it('POST /teams/:teamId/kanban/tasks/:taskId/start', async () => {
      const mockStart = vi.spyOn(kanbanService, 'startManualTask').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.IN_PROGRESS,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/start`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(mockStart).toHaveBeenCalledWith(taskId, 'user-1')
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/complete', async () => {
      const mockComplete = vi.spyOn(kanbanService, 'completeManualTask').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.DONE,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(mockComplete).toHaveBeenCalledWith(taskId, 'user-1')
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/approve', async () => {
      const mockApprove = vi.spyOn(kanbanService, 'approveTask').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.AGENTIC,
        status: KanbanTaskStatus.DONE,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/approve`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(mockApprove).toHaveBeenCalledWith(taskId, 'user-1', 'owner')
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/request-changes', async () => {
      const mockRequest = vi.spyOn(kanbanService, 'requestChanges').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.AGENTIC,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Needs better styling' }),
      })

      expect(res.status).toBe(200)
      expect(mockRequest).toHaveBeenCalledWith(taskId, 'Needs better styling', 'user-1', 'owner')
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/unblock', async () => {
      const mockUnblock = vi.spyOn(kanbanService, 'unblockTask').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.AGENTIC,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/unblock`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(mockUnblock).toHaveBeenCalledWith(taskId, 'user-1')
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/reopen', async () => {
      const mockReopen = vi.spyOn(kanbanService, 'reopenTask').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.READY,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/reopen`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(mockReopen).toHaveBeenCalledWith(taskId, 'user-1')
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/cancel', async () => {
      const mockCancel = vi.spyOn(kanbanService, 'cancelTask').mockResolvedValue({
        id: taskId,
        title: 'Task',
        type: KanbanTaskType.MANUAL,
        status: KanbanTaskStatus.CANCELLED,
        priority: KanbanTaskPriority.MEDIUM,
        teamId,
        creator: { id: 'user-1', name: 'User' },
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/cancel`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(mockCancel).toHaveBeenCalledWith(taskId, 'user-1')
    })

    it('GET /teams/:teamId/kanban/tasks/:taskId/context', async () => {
      const mockContext = vi
        .spyOn(kanbanContextService, 'buildAgentContext')
        .mockResolvedValue('# Kanban Task Briefing')

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/context`)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.context).toBe('# Kanban Task Briefing')
      expect(mockContext).toHaveBeenCalledWith(taskId)
    })
  })

  // --------------------------------------------------------------------------
  // Links / Dependencies
  // --------------------------------------------------------------------------
  describe('Dependencies Endpoints', () => {
    it('POST & DELETE /teams/:teamId/kanban/tasks/:taskId/dependencies', async () => {
      const mockAdd = vi.spyOn(kanbanService, 'addDependency').mockResolvedValue(undefined)
      const mockRemove = vi.spyOn(kanbanService, 'removeDependency').mockResolvedValue(undefined)

      // Add
      const addRes = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: 'parent-1' }),
      })
      expect(addRes.status).toBe(200)
      expect(mockAdd).toHaveBeenCalledWith('parent-1', taskId, 'user-1')

      // Remove
      const delRes = await app.request(
        `/teams/${teamId}/kanban/tasks/${taskId}/dependencies/parent-1`,
        {
          method: 'DELETE',
        },
      )
      expect(delRes.status).toBe(200)
      expect(mockRemove).toHaveBeenCalledWith('parent-1', taskId, 'user-1')
    })
  })

  // --------------------------------------------------------------------------
  // Comments, Attachments & Events
  // --------------------------------------------------------------------------
  describe('Comments, Attachments and Events Endpoints', () => {
    it('POST /teams/:teamId/kanban/attachments', async () => {
      const mockAttachment = vi.spyOn(kanbanService, 'createAttachment').mockResolvedValue({
        id: 'att-1',
        name: 'test.png',
        key: 'kanban/attachments/test.png',
        sizeByte: 1024,
        uploadUrl: 'http://s3/upload',
        proxyType: 'image',
      })

      const res = await app.request(`/teams/${teamId}/kanban/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'test.png', size: 1024, contentType: 'image/png' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe('att-1')
      expect(mockAttachment).toHaveBeenCalledWith(teamId, {
        fileName: 'test.png',
        size: 1024,
        contentType: 'image/png',
      })
    })

    it('POST /teams/:teamId/kanban/tasks/:taskId/comments', async () => {
      const mockAdd = vi.spyOn(kanbanService, 'addComment').mockResolvedValue({
        id: 'c-1',
        taskId,
        author: { id: 'user-1', name: 'User 1' },
        body: 'Here is a note',
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Here is a note',
          attachments: [
            {
              id: 'att-1',
              name: 'test.png',
              key: 'key-1',
              sizeByte: 1024,
              proxyType: 'image',
            },
          ],
        }),
      })

      expect(res.status).toBe(200)
      expect(mockAdd).toHaveBeenCalledWith(taskId, 'user-1', 'Here is a note', [
        {
          id: 'att-1',
          name: 'test.png',
          key: 'key-1',
          sizeByte: 1024,
          proxyType: 'image',
        },
      ])
    })

    it('DELETE /teams/:teamId/kanban/tasks/:taskId/comments/:commentId', async () => {
      const mockDelete = vi.spyOn(kanbanService, 'deleteComment').mockResolvedValue()

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/comments/c-1`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith(taskId, 'c-1', 'user-1', 'owner')
    })

    it('GET /teams/:teamId/kanban/tasks/:taskId/comments', async () => {
      const mockList = vi.spyOn(kanbanService, 'listComments').mockResolvedValue([
        {
          id: 'c-1',
          taskId,
          author: { id: 'user-1', name: 'User 1' },
          body: 'Note',
          attachments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/comments`)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data).toHaveLength(1)
      expect(mockList).toHaveBeenCalledWith(taskId)
    })

    it('GET /teams/:teamId/kanban/tasks/:taskId/events', async () => {
      const mockEvents = vi.spyOn(kanbanService, 'listEvents').mockResolvedValue([
        {
          id: 'e-1',
          taskId,
          actor: { id: 'user-1', name: 'User 1' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: 'CREATED' as any,
          createdAt: new Date().toISOString(),
        },
      ])

      const res = await app.request(`/teams/${teamId}/kanban/tasks/${taskId}/events`)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data).toHaveLength(1)
      expect(mockEvents).toHaveBeenCalledWith(taskId)
    })
  })
})
