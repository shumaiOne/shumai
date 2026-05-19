import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import uploadRoute from './upload'
import { authMiddleware } from '@/api/middleware/auth'
import { uploadService } from '@/services/upload/upload'
import type { CreateUploadTaskResponse, TaskInfo } from '@/dtos/upload'
import type { PaginatedData } from '@/services/pagination'

vi.mock('@/api/middleware/auth', () => ({
  // We use any here because mocking Hono context and middleware
  // with full type safety is overly complex for these unit tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: async (c: any, next: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.set('user', { id: 'user1', name: 'Test User' } as any)
    await next()
  },
}))

vi.mock('@/services/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: {
    Read: 'Read',
    Edit: 'Edit',
    Admin: 'Admin',
  },
}))

vi.mock('@/services/notification/notification', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Upload API', () => {
  const app = new Hono().use('*', authMiddleware).route('/', uploadRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /teams/:teamId/upload/tasks', async () => {
    // We mock the return value as it is only used for checking the call
    vi.spyOn(uploadService, 'listUploadTasks').mockResolvedValue({
      data: [],
      pageInfo: {},
    } as unknown as PaginatedData<TaskInfo[]>)

    const res = await app.request('/teams/team1/upload/tasks', {
      headers: { Authorization: 'Bearer test' },
    })

    expect(res.status).toBe(200)
    expect(uploadService.listUploadTasks).toHaveBeenCalled()
  })

  it('POST /teams/:teamId/upload/tasks', async () => {
    // We mock the return value as it is only used for checking the call
    vi.spyOn(uploadService, 'createUploadTask').mockResolvedValue({
      taskId: 'task1',
      presignedUrls: [],
    } as unknown as CreateUploadTaskResponse)

    const res = await app.request('/teams/team1/upload/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({
        parentId: 'parent1',
        files: [],
      }),
    })

    expect(res.status).toBe(200)
    expect(uploadService.createUploadTask).toHaveBeenCalled()
  })

  it('PATCH /teams/:teamId/upload/tasks/:taskId', async () => {
    vi.spyOn(uploadService, 'confirmFileUpload').mockResolvedValue(undefined)

    const res = await app.request('/teams/team1/upload/tasks/task1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({
        fileId: 'file1',
      }),
    })

    expect(res.status).toBe(200)
    expect(uploadService.confirmFileUpload).toHaveBeenCalledWith('user1', 'task1', {
      fileId: 'file1',
    })
  })
})
