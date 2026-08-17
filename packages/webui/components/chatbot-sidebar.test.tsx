// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatbotSidebar } from './chatbot-sidebar'
import { useChatbotStore, AGENT_PREFERENCE_STORAGE_KEY } from '@/ui/stores/chatbot'
import { client } from '@/ui/api/client'

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

// Mock droppable from @dnd-kit/react
vi.mock('@dnd-kit/react', () => ({
  useDroppable: () => ({
    ref: vi.fn(),
    isDropTarget: false,
  }),
}))

// Mock API client
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      projects: {
        ':projectId': {
          'chat-agents': {
            $get: vi.fn(),
          },
        },
      },
      teams: {
        ':teamId': {
          chat: {
            sessions: {
              $get: vi.fn(() =>
                Promise.resolve({
                  ok: true,
                  json: async () => ({ data: [] }),
                } as unknown),
              ),
            },
          },
        },
      },
    },
  },
}))

describe('ChatbotSidebar - Agent Selection & Preference Persistence', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    localStorage.clear()
    useChatbotStore.setState({
      isHistoryMode: false,
      isChatbotOpen: true,
      currentSessionId: null,
      chatAssets: [],
      messages: [],
      historySessions: [],
      isStreaming: false,
      selectedAgentId: null,
      inputText: '',
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('should not wipe saved agent preference while chat agents query is loading', async () => {
    localStorage.setItem(AGENT_PREFERENCE_STORAGE_KEY, 'agent-2')
    useChatbotStore.setState({ selectedAgentId: 'agent-2' })

    let resolveAgents: (value: unknown) => void
    const agentsPromise = new Promise((resolve) => {
      resolveAgents = resolve
    })

    vi.mocked(client.api.projects[':projectId']['chat-agents'].$get).mockImplementation(
      () =>
        agentsPromise as unknown as ReturnType<
          (typeof client.api.projects)[':projectId']['chat-agents']['$get']
        >,
    )

    render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" />
      </QueryClientProvider>,
    )

    // While query is loading, selectedAgentId in store and localStorage must NOT be wiped
    expect(useChatbotStore.getState().selectedAgentId).toBe('agent-2')
    expect(localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)).toBe('agent-2')

    // Now resolve query with available agents
    resolveAgents!({
      ok: true,
      json: async () => [
        { id: 'agent-1', name: 'Agent 1', type: 'chat', enabled: true },
        { id: 'agent-2', name: 'Agent 2', type: 'chat', enabled: true },
      ],
    })

    await waitFor(() => {
      expect(useChatbotStore.getState().selectedAgentId).toBe('agent-2')
      expect(localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)).toBe('agent-2')
    })
  })

  it('should fallback to first agent if saved agent does not exist in project agents list', async () => {
    localStorage.setItem(AGENT_PREFERENCE_STORAGE_KEY, 'agent-nonexistent')
    useChatbotStore.setState({ selectedAgentId: 'agent-nonexistent' })

    vi.mocked(client.api.projects[':projectId']['chat-agents'].$get).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'agent-1', name: 'Agent 1', type: 'chat', enabled: true },
        { id: 'agent-2', name: 'Agent 2', type: 'chat', enabled: true },
      ],
    } as unknown as Awaited<
      ReturnType<(typeof client.api.projects)[':projectId']['chat-agents']['$get']>
    >)

    render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(useChatbotStore.getState().selectedAgentId).toBe('agent-1')
      expect(localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)).toBe('agent-1')
    })
  })

  it('should reset to null if project has no enabled chat agents', async () => {
    localStorage.setItem(AGENT_PREFERENCE_STORAGE_KEY, 'agent-1')
    useChatbotStore.setState({ selectedAgentId: 'agent-1' })

    vi.mocked(client.api.projects[':projectId']['chat-agents'].$get).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Awaited<
      ReturnType<(typeof client.api.projects)[':projectId']['chat-agents']['$get']>
    >)

    render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(useChatbotStore.getState().selectedAgentId).toBeNull()
      expect(localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)).toBeNull()
    })
  })
})
