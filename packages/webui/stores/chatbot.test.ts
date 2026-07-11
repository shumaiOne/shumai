import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChatbotStore } from './chatbot'
import { client } from '@/ui/api/client'
import type { ChatMessage } from '@shumai/dtos'

vi.mock('@/ui/api/client', () => {
  return {
    client: {
      api: {
        chat: {
          $post: vi.fn(),
          sessions: {
            $get: vi.fn(),
            $delete: vi.fn(),
            messages: {
              $get: vi.fn(),
            },
          },
        },
      },
    },
  }
})

describe('useChatbotStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useChatbotStore.setState({
      isHistoryMode: false,
      isChatbotOpen: false,
      currentSessionId: null,
      chatAssets: [],
      messages: [],
      historySessions: [],
      isStreaming: false,
    })
  })

  it('should add, remove and clear assets in context', () => {
    const store = useChatbotStore.getState()
    expect(store.chatAssets).toHaveLength(0)

    store.addAssets([
      { id: '1', name: 'File A', type: 'file' },
      { id: '2', name: 'Folder B', type: 'folder' },
    ])
    expect(useChatbotStore.getState().chatAssets).toHaveLength(2)

    useChatbotStore.getState().removeAsset('1')
    expect(useChatbotStore.getState().chatAssets).toHaveLength(1)
    expect(useChatbotStore.getState().chatAssets[0].id).toBe('2')

    useChatbotStore.getState().clearAssets()
    expect(useChatbotStore.getState().chatAssets).toHaveLength(0)
  })

  it('should reset currentSessionId and messages on startNewSession', () => {
    useChatbotStore.setState({
      currentSessionId: 'sess-abc',
      messages: [{ id: 'msg-1', role: 'user', content: 'test' } as unknown as ChatMessage],
      chatAssets: [{ id: 'asset-1', name: 'Asset', type: 'file' }],
    })

    useChatbotStore.getState().startNewSession()
    const state = useChatbotStore.getState()
    expect(state.currentSessionId).toBeNull()
    expect(state.messages).toHaveLength(0)
    expect(state.chatAssets).toHaveLength(0)
  })

  it('should handle incoming SSE stream and replace optimistic message in a new session', async () => {
    const mockEvents = [
      'data: {"type":"session","sessionId":"sess-123"}\n\n',
      'data: {"type":"entry","entry":{"id":"user-msg-ulid","role":"user","content":[{"type":"text","text":"hello"}],"timestamp":123}}\n\n',
      'data: {"type":"entry","entry":{"id":"assistant-msg-ulid","role":"assistant","content":[{"type":"text","text":"hi user"}],"timestamp":124}}\n\n',
      'data: {"type":"done","status":"completed"}\n\n',
    ]

    let eventIdx = 0
    const mockReader = {
      read: vi.fn(async () => {
        if (eventIdx < mockEvents.length) {
          const value = new TextEncoder().encode(mockEvents[eventIdx++])
          return { done: false, value }
        }
        return { done: true, value: undefined }
      }),
    }

    const mockResponse = {
      ok: true,
      headers: {
        get: vi.fn(() => 'sess-123'),
      },
      body: {
        getReader: () => mockReader,
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(client.api.chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore.getState().sendMessage('hello', 'proj-123')

    // Optimistic message should be present immediately
    const stateWithOptimistic = useChatbotStore.getState()
    expect(stateWithOptimistic.messages).toHaveLength(1)
    expect(stateWithOptimistic.messages[0].id).toContain('temp-')
    expect((stateWithOptimistic.messages[0] as { content: unknown }).content).toEqual([{ type: 'text', text: 'hello' }])
    expect(stateWithOptimistic.isStreaming).toBe(true)

    await sendPromise

    // Final state assertions
    const finalState = useChatbotStore.getState()
    expect(finalState.isStreaming).toBe(false)
    expect(finalState.currentSessionId).toBe('sess-123')
    expect(finalState.messages).toHaveLength(2)
    expect(finalState.messages[0].id).toBe('user-msg-ulid')
    expect(finalState.messages[1].id).toBe('assistant-msg-ulid')
  })

  it('should not remove optimistic message when historical user message streams back', async () => {
    useChatbotStore.setState({
      currentSessionId: 'sess-123',
      messages: [
        {
          id: 'user-msg-ulid-old',
          role: 'user',
          content: [{ type: 'text', text: 'old message' }],
          timestamp: 100,
        } as unknown as ChatMessage,
      ],
      chatAssets: [],
    })

    const mockEvents = [
      'data: {"type":"session","sessionId":"sess-123"}\n\n',
      'data: {"type":"entry","entry":{"id":"user-msg-ulid-old","role":"user","content":[{"type":"text","text":"old message"}],"timestamp":100}}\n\n',
      'data: {"type":"entry","entry":{"id":"user-msg-ulid-new","role":"user","content":[{"type":"text","text":"new message"}],"timestamp":150}}\n\n',
      'data: {"type":"done","status":"completed"}\n\n',
    ]

    let eventIdx = 0
    const mockReader = {
      read: vi.fn(async () => {
        if (eventIdx < mockEvents.length) {
          const value = new TextEncoder().encode(mockEvents[eventIdx++])
          return { done: false, value }
        }
        return { done: true, value: undefined }
      }),
    }

    const mockResponse = {
      ok: true,
      headers: {
        get: vi.fn(() => 'sess-123'),
      },
      body: {
        getReader: () => mockReader,
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(client.api.chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore.getState().sendMessage('new message', 'proj-123')

    // Optimistic message should be appended immediately
    const stateWithOptimistic = useChatbotStore.getState()
    expect(stateWithOptimistic.messages).toHaveLength(2)
    expect(stateWithOptimistic.messages[0].id).toBe('user-msg-ulid-old')
    expect(stateWithOptimistic.messages[1].id).toContain('temp-')

    await sendPromise

    // Final state assertions
    const finalState = useChatbotStore.getState()
    expect(finalState.messages).toHaveLength(2)
    expect(finalState.messages[0].id).toBe('user-msg-ulid-old')
    expect(finalState.messages[1].id).toBe('user-msg-ulid-new')
  })
})
