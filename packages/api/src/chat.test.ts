import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import chatRoute from './chat'
import { chatService } from '@shumai/core/src/chat/chat'
import { authzService } from '@shumai/core/src/authz/authz'
import type { ChatMessage } from '@shumai/dtos'

vi.mock('@shumai/core/src/chat/chat', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shumai/core/src/chat/chat')>()
  return {
    ...original,
    chatService: {
      listSessions: vi.fn(),
      listMessages: vi.fn(),
      deleteSession: vi.fn(),
      startOrContinueChat: vi.fn(),
      getNewSessionMessages: vi.fn(),
      getChatWorkflowStatus: vi.fn(),
      abortSession: vi.fn(),
    },
  }
})
vi.mock('@shumai/core/src/authz/authz')

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

      vi.mocked(chatService.getNewSessionMessages)
        .mockResolvedValueOnce({
          messages: [
            {
              id: 'entry1',
              role: 'user',
              content: 'hi',
            } as unknown as ChatMessage,
          ],
          lastEntryId: 'entry1',
        })
        .mockResolvedValue({
          messages: [],
          lastEntryId: 'entry1',
        })

      vi.mocked(chatService.getChatWorkflowStatus).mockResolvedValue({
        status: 'completed',
        output: {},
      })

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

      vi.mocked(chatService.getNewSessionMessages).mockResolvedValue({
        messages: [],
        lastEntryId: null,
      })

      vi.mocked(chatService.getChatWorkflowStatus).mockResolvedValue({
        status: 'completed',
        output: {},
      })

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
      vi.mocked(chatService.abortSession).mockResolvedValue(undefined)

      const res = await app.request('/teams/team1/chat/sessions/session1/abort', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ success: true })

      expect(chatService.abortSession).toHaveBeenCalledWith('user1', 'session1')
    })

    it('returns 404 if no active task is found for the session', async () => {
      vi.mocked(chatService.abortSession).mockRejectedValue(
        new Error('No active execution found for this session'),
      )

      const res = await app.request('/teams/team1/chat/sessions/session1/abort', {
        method: 'POST',
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('No active execution found for this session')
    })
  })
})
