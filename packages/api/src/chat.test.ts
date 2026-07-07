import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import chatRoute from './chat'
import { chatService } from '@shumai/core/src/chat/chat'
import { authzService } from '@shumai/core/src/authz/authz'

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
    },
  },
}))

import { prisma } from '@shumai/db'

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

  describe('GET /chat/sessions', () => {
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

      const res = await app.request('/chat/sessions?first=10')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe('session1')
    })
  })

  describe('GET /chat/sessions/:sessionId/messages', () => {
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

      const res = await app.request('/chat/sessions/session1/messages')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].content).toBe('hello')
    })
  })

  describe('DELETE /chat/sessions/:sessionId', () => {
    it('deletes a session', async () => {
      vi.mocked(chatService.deleteSession).mockResolvedValue(undefined)

      const res = await app.request('/chat/sessions/session1', {
        method: 'DELETE',
      })
      expect(res.status).toBe(204)
      expect(chatService.deleteSession).toHaveBeenCalledWith('user1', 'session1')
    })
  })

  describe('POST /chat', () => {
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

      const res = await app.request('/chat', {
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
    })
  })
})
