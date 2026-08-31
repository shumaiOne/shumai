import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChatbotStore, AGENT_PREFERENCE_STORAGE_KEY } from './chatbot'
import { client } from '@/ui/api/client'
import type { ChatMessage } from '@shumai/dtos'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
  })
}
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
  })
}

vi.mock('@/ui/api/client', () => {
  const chatMock = {
    $post: vi.fn(),
    sessions: {
      $get: vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as unknown)),
      $delete: vi.fn(),
      messages: {
        $get: vi.fn(),
      },
    },
  }
  return {
    client: {
      api: {
        teams: {
          ':teamId': {
            chat: chatMock,
          },
        },
      },
    },
  }
})

describe('useChatbotStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    useChatbotStore.setState({
      isHistoryMode: false,
      isChatbotOpen: false,
      currentSessionId: null,
      chatAssets: [],
      messages: [],
      historySessions: [],
      isStreaming: false,
      selectedAgentId: 'agent-1',
      inputText: '',
    })
  })

  it('should persist selectedAgentId to localStorage when setSelectedAgentId is called', () => {
    useChatbotStore.getState().setSelectedAgentId('agent-pref-123')
    expect(useChatbotStore.getState().selectedAgentId).toBe('agent-pref-123')
    expect(localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)).toBe('agent-pref-123')

    useChatbotStore.getState().setSelectedAgentId(null)
    expect(useChatbotStore.getState().selectedAgentId).toBeNull()
    expect(localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)).toBeNull()
  })

  it('should restore preferred agent from localStorage on startNewSession', () => {
    localStorage.setItem(AGENT_PREFERENCE_STORAGE_KEY, 'agent-pref-saved')
    useChatbotStore.setState({
      selectedAgentId: 'agent-temporary-historical',
      currentSessionId: 'sess-historical',
      messages: [{ id: 'msg-1', role: 'user', content: 'test' } as unknown as ChatMessage],
    })

    useChatbotStore.getState().startNewSession()
    const state = useChatbotStore.getState()
    expect(state.currentSessionId).toBeNull()
    expect(state.selectedAgentId).toBe('agent-pref-saved')
  })

  it('should persist and reset inputText', () => {
    expect(useChatbotStore.getState().inputText).toBe('')
    useChatbotStore.getState().setInputText('Draft text in progress')
    expect(useChatbotStore.getState().inputText).toBe('Draft text in progress')

    useChatbotStore.setState({
      currentSessionId: 'sess-abc',
      messages: [{ id: 'msg-1', role: 'user', content: 'test' } as unknown as ChatMessage],
    })
    // Navigating or changing other state does not wipe inputText
    expect(useChatbotStore.getState().inputText).toBe('Draft text in progress')

    useChatbotStore.getState().startNewSession()
    expect(useChatbotStore.getState().inputText).toBe('')
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
    vi.mocked(client.api.teams[':teamId'].chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore.getState().sendMessage('team-123', 'hello', 'proj-123')

    // Optimistic message should be present immediately
    const stateWithOptimistic = useChatbotStore.getState()
    expect(stateWithOptimistic.messages).toHaveLength(1)
    expect(stateWithOptimistic.messages[0].id).toContain('temp-')
    expect((stateWithOptimistic.messages[0] as { content: unknown }).content).toBe('hello')
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
    vi.mocked(client.api.teams[':teamId'].chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore
      .getState()
      .sendMessage('team-123', 'new message', 'proj-123')

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

  it('should create optimistic context display message when sending with assets', async () => {
    // 1. Setup chatAssets in store
    useChatbotStore.setState({
      chatAssets: [{ id: 'asset-1', name: 'File 1.txt', type: 'file' }],
    })

    // 2. Mock POST response with context_display_info entry streaming back
    const mockEvents = [
      'data: {"type":"session","sessionId":"sess-123"}\n\n',
      'data: {"type":"entry","entry":{"id":"context-display-ulid","role":"custom","customType":"context_display_info","details":{"assets":[{"id":"asset-1","name":"File 1.txt","type":"file"}]},"timestamp":120}}\n\n',
      'data: {"type":"entry","entry":{"id":"user-msg-ulid","role":"user","content":[{"type":"text","text":"hello"}],"timestamp":123}}\n\n',
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
    vi.mocked(client.api.teams[':teamId'].chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore.getState().sendMessage('team-123', 'hello', 'proj-123')

    // 3. Verify that the optimistic message includes referencedAssets
    const stateWithOptimistic = useChatbotStore.getState()
    expect(stateWithOptimistic.messages).toHaveLength(1)

    // Message should be the optimistic shumai_message with referencedAssets in details
    expect(stateWithOptimistic.messages[0].id).toContain('temp-')
    expect(stateWithOptimistic.messages[0].role).toBe('custom')
    expect((stateWithOptimistic.messages[0] as { customType?: string }).customType).toBe(
      'shumai_message',
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((stateWithOptimistic.messages[0] as any).details.referencedAssets).toEqual([
      { id: 'asset-1', name: 'File 1.txt', type: 'file' },
    ])

    await sendPromise

    // 4. Verify message list after streaming completes
    const finalState = useChatbotStore.getState()
    expect(finalState.messages).toHaveLength(2)
    expect(finalState.messages[0].id).toBe('context-display-ulid')
    expect(finalState.messages[1].id).toBe('user-msg-ulid')
  })

  it('should invoke onAssetMutation callback when asset creation tool result arrives', async () => {
    const mockEvents = [
      'data: {"type":"session","sessionId":"sess-123"}\n\n',
      'data: {"type":"entry","entry":{"id":"user-msg-ulid","role":"user","content":[{"type":"text","text":"create a file"}],"timestamp":123}}\n\n',
      'data: {"type":"entry","entry":{"id":"tool-res-ulid","role":"toolResult","toolName":"create_file","isError":false,"content":"File created","timestamp":124}}\n\n',
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
    vi.mocked(client.api.teams[':teamId'].chat.$post).mockResolvedValue(mockResponse as any)

    const onAssetMutation = vi.fn()
    await useChatbotStore
      .getState()
      .sendMessage('team-123', 'create a file', 'proj-123', undefined, onAssetMutation)

    expect(onAssetMutation).toHaveBeenCalledTimes(1)
  })

  it('should replace optimistic message when shumai_message entry streams back', async () => {
    const mockEvents = [
      'data: {"type":"session","sessionId":"sess-123"}\n\n',
      'data: {"type":"entry","entry":{"id":"user-msg-ulid","role":"custom","customType":"shumai_message","content":"hello","details":{"user":{"id":"u1","name":"User 1"}},"timestamp":123}}\n\n',
      'data: {"type":"entry","entry":{"id":"assistant-msg-ulid","role":"assistant","content":[{"type":"text","text":"Hi!"}],"timestamp":124}}\n\n',
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
    vi.mocked(client.api.teams[':teamId'].chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore.getState().sendMessage('team-123', 'hello', 'proj-123')

    // Optimistic message should be present immediately
    const stateWithOptimistic = useChatbotStore.getState()
    expect(stateWithOptimistic.messages).toHaveLength(1)
    expect(stateWithOptimistic.messages[0].id).toContain('temp-')

    await sendPromise

    // Final state assertions: optimistic message must be replaced
    const finalState = useChatbotStore.getState()
    expect(finalState.messages).toHaveLength(2)
    expect(finalState.messages[0].id).toBe('user-msg-ulid')
    expect(finalState.messages[0].role).toBe('custom')
    expect((finalState.messages[0] as { customType?: string }).customType).toBe('shumai_message')
    expect(finalState.messages[1].id).toBe('assistant-msg-ulid')
  })

  it('should include attachments, annotations, and second in optimistic message and API call', async () => {
    const mockEvents = [
      'data: {"type":"session","sessionId":"sess-456"}\n\n',
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
        get: vi.fn(() => 'sess-456'),
      },
      body: {
        getReader: () => mockReader,
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(client.api.teams[':teamId'].chat.$post).mockResolvedValue(mockResponse as any)

    const sendPromise = useChatbotStore.getState().sendMessage(
      'team-123',
      'Look at this frame',
      'proj-123',
      'file-asset-1',
      undefined,
      ['att-1'],
      [
        {
          type: 'box',
          color: '#ff0000',
          points: [
            [10, 20],
            [30, 40],
          ],
        },
      ],
      12.5,
      [{ id: 'att-1', name: 'screenshot.png', type: 'image', mediaType: 'image/png' }],
    )

    // Check optimistic message has annotations, second position, and attachedFiles
    const optimisticState = useChatbotStore.getState()
    expect(optimisticState.messages).toHaveLength(1)
    const optMsg = optimisticState.messages[0] as unknown as Record<string, unknown>
    expect(optMsg.customType).toBe('shumai_message')
    const details = optMsg.details as Record<string, unknown>
    expect(details.annotation).toBe(true)
    expect(details.annotations).toHaveLength(1)
    expect(details.position).toEqual({ type: 'time', seconds: 12.5 })
    expect(details.attachedFiles).toEqual([
      { id: 'att-1', name: 'screenshot.png', type: 'image', mediaType: 'image/png' },
    ])

    await sendPromise

    expect(client.api.teams[':teamId'].chat.$post).toHaveBeenCalledWith({
      param: { teamId: 'team-123' },
      json: {
        agentId: 'agent-1',
        textPrompt: 'Look at this frame',
        attachedFiles: ['att-1'],
        assetIds: undefined,
        sessionId: undefined,
        contextAssetId: 'file-asset-1',
        projectId: 'proj-123',
        second: 12.5,
        annotations: [
          {
            type: 'box',
            color: '#ff0000',
            points: [
              [10, 20],
              [30, 40],
            ],
          },
        ],
      },
    })
  })
})
