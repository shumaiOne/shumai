import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import chatRoute from './chat'
import { chatService } from '@shumai/core/src/chat/chat'
import { authzService } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/workflow-core', () => ({
  workflowService: {
    cancel: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/chat/chat', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shumai/core/src/chat/chat')>()
  return {
    ...original,
    chatService: {
      listSessions: vi.fn(),
      listMessages: vi.fn(),
      deleteSession: vi.fn(),
      startOrContinueChat: vi.fn(),
    },
  }
})
vi.mock('@shumai/core/src/authz/authz')
vi.mock('@shumai/db', () => ({
  prisma: {
    agentSessionEntry: {
      findMany: vi.fn(),
    },
    workflowTask: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma, type WorkflowTask } from '@shumai/db'

describe('Chat API', () => {
  const app = new Hono<{ Variables: { user: { id: string; name: string } } }>()
    .use('*', async (c, next) => {
      c.set('user', { id: 'user1', name: 'Test User' })
      await next()
    })
    .route('/', chatRoute)

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(authzService.hasPermission).mockResolvedValue(undefined)
  })

  describe('GET /teams/:teamId/chat/sessions', () => {
    it('returns list of sessions', async () => {
      const mockSessions = {
        data: [
          {
            id: 'session1',
            agentId: 'default',
            userId: 'user1',
            assetId: 'asset1',
            userCommentId: 'comment1',
            createdAt: '2026-07-07T10:00:00Z',
            updatedAt: '2026-07-07T10:00:00Z',
          },
        ],
        pageInfo: { total: 1 },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(chatService.listSessions).mockResolvedValue(mockSessions as any)

      const res = await app.request('/teams/team1/chat/sessions?first=10')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe('session1')
      expect(chatService.listSessions).toHaveBeenCalledWith('user1', 'team1', expect.any(Object))
    })
  })

  describe('GET /teams/:teamId/chat/sessions/:sessionId/messages', () => {
    it('returns list of messages', async () => {
      const mockMessages = [
        {
          id: 'msg1',
          role: 'user',
          content: 'hello',
          timestamp: '2026-07-07T10:00:00Z',
          entry: {},
        },
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(chatService.listMessages).mockResolvedValue(mockMessages as any)

      const res = await app.request('/teams/team1/chat/sessions/session1/messages')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].content).toBe('hello')
      expect(chatService.listMessages).toHaveBeenCalledWith('user1', 'team1', 'session1')
    })
  })

  describe('DELETE /teams/:teamId/chat/sessions/:sessionId', () => {
    it('deletes a session', async () => {
      vi.mocked(chatService.deleteSession).mockResolvedValue(undefined)

      const res = await app.request('/teams/team1/chat/sessions/session1', {
        method: 'DELETE',
      })
      expect(res.status).toBe(204)
      expect(chatService.deleteSession).toHaveBeenCalledWith('user1', 'team1', 'session1')
    })
  })

  describe('POST /teams/:teamId/chat', () => {
    it('starts or continues chat and returns stream', async () => {
      vi.mocked(chatService.startOrContinueChat).mockResolvedValue({
        sessionId: 'session1',
        taskId: 'task1',
      })

      const mockEntries = [
        {
          id: 'entry1',
          sessionId: 'session1',
          entry: {
            type: 'message',
            message: {
              role: 'user',
              content: [{ type: 'text', text: 'hi' }],
            },
          },
        },
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.agentSessionEntry.findMany).mockResolvedValue(mockEntries as any)

      const mockTask = {
        id: 'task1',
        status: 'completed',
        output: {},
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.workflowTask.findUnique).mockResolvedValue(mockTask as any)

      const res = await app.request('/teams/team1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent1',
          textPrompt: 'hi',
        }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')

      const text = await res.text()
      expect(text).toContain('data:')
      expect(text).toContain('entry1')
      expect(chatService.startOrContinueChat).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user1' }),
        'team1',
        expect.any(Object),
      )
    })

    it('sends ping keep-alive SSE events when there are no new messages', async () => {
      vi.mocked(chatService.startOrContinueChat).mockResolvedValue({
        sessionId: 'session1',
        taskId: 'task1',
      })

      // No new entries initially
      // Mock returns a simple array instead of full PrismaPromise, so we bypass type safety.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.agentSessionEntry.findMany).mockResolvedValue([] as any)

      const mockTask = {
        id: 'task1',
        status: 'completed',
        output: {},
      }
      // Mock returns a simple task object instead of PrismaPromise, so we bypass type safety.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.workflowTask.findUnique).mockResolvedValue(mockTask as any)

      const res = await app.request('/teams/team1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent1',
          textPrompt: 'hi',
        }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')

      const text = await res.text()
      expect(text).toContain('data:')
      expect(text).toContain('{"type":"ping"}')
    })
  })

  describe('POST /teams/:teamId/chat/sessions/:sessionId/abort', () => {
    it('aborts an active chat session and updates task status', async () => {
      const mockActiveTask = {
        id: 'task1',
        status: 'processing',
        type: 'chat',
        sessionId: 'session1',
        payload: {
          agent: {
            sessionId: 'session1',
          },
        },
      }
      vi.mocked(prisma.workflowTask.findFirst).mockResolvedValue(
        mockActiveTask as unknown as WorkflowTask,
      )
      vi.mocked(prisma.workflowTask.update).mockResolvedValue({} as unknown as WorkflowTask)

      const { workflowService } = await import('@shumai/workflow-core')

      const res = await app.request('/teams/team1/chat/sessions/session1/abort', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ success: true })

      expect(workflowService.cancel).toHaveBeenCalledWith('task1')
      expect(prisma.workflowTask.update).toHaveBeenCalledWith({
        where: { id: 'task1' },
        data: {
          status: 'failed',
          output: { error: 'aborted' },
        },
      })
    })

    it('returns 404 if no active task is found for the session', async () => {
      vi.mocked(prisma.workflowTask.findFirst).mockResolvedValue(null)

      const res = await app.request('/teams/team1/chat/sessions/session1/abort', {
        method: 'POST',
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('No active execution found for this session')
    })
  })
})
