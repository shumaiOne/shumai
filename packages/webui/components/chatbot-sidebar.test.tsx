// @vitest-environment happy-dom
import { cleanup, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatbotSidebar } from './chatbot-sidebar'
import { useChatbotStore, AGENT_PREFERENCE_STORAGE_KEY } from '@/ui/stores/chatbot'
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

  it('renders user messages with markup badge, timestamp, and attachments and triggers onSelectMessage on click when matched', async () => {
    vi.mocked(client.api.projects[':projectId']['chat-agents'].$get).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'agent-1', name: 'Agent 1', type: 'chat', enabled: true }],
    } as unknown as Awaited<
      ReturnType<(typeof client.api.projects)[':projectId']['chat-agents']['$get']>
    >)

    const mockSelectMessage = vi.fn()

    const mockMessage = {
      id: 'msg-1',
      role: 'custom',
      customType: 'shumai_message',
      content: 'Fix the color in this scene',
      details: {
        annotation: true,
        annotations: [{ type: 'rectangle', x: 5, y: 10 }],
        position: { type: 'time', seconds: 15 },
        currentAsset: { id: 'file-123', name: 'video.mp4', type: 'file' },
        attachedFiles: [
          { id: 'att-1', name: 'color-ref.png', type: 'image', mediaType: 'image/png' },
        ],
      },
    } as unknown as ChatMessage

    useChatbotStore.setState({
      messages: [mockMessage],
    })

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar
          projectId="proj-1"
          contextAssetId="file-123"
          onSelectMessage={mockSelectMessage}
        />
      </QueryClientProvider>,
    )

    expect(getByText('Fix the color in this scene')).toBeTruthy()
    expect(getByText('00:15')).toBeTruthy()
    expect(getByText('color-ref.png')).toBeTruthy()

    const msgCard = getByText('Fix the color in this scene').closest('div')
    msgCard?.click()

    expect(mockSelectMessage).toHaveBeenCalledWith(mockMessage)
  })

  it('does not trigger onSelectMessage on click when currentAsset does not match', async () => {
    vi.mocked(client.api.projects[':projectId']['chat-agents'].$get).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'agent-1', name: 'Agent 1', type: 'chat', enabled: true }],
    } as unknown as Awaited<
      ReturnType<(typeof client.api.projects)[':projectId']['chat-agents']['$get']>
    >)

    const mockSelectMessage = vi.fn()

    const mockMessage = {
      id: 'msg-2',
      role: 'custom',
      customType: 'shumai_message',
      content: 'Other file comment',
      details: {
        annotation: true,
        annotations: [{ type: 'rectangle', x: 5, y: 10 }],
        position: { type: 'time', seconds: 20 },
        currentAsset: { id: 'other-file-456', name: 'other.mp4', type: 'file' },
      },
    } as unknown as ChatMessage

    useChatbotStore.setState({
      messages: [mockMessage],
    })

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar
          projectId="proj-1"
          contextAssetId="file-123"
          onSelectMessage={mockSelectMessage}
        />
      </QueryClientProvider>,
    )

    const msgCard = getByText('Other file comment').closest('div')
    msgCard?.click()

    expect(mockSelectMessage).not.toHaveBeenCalled()
  })

  it('renders full-width message card with inline badges, attachments and assets sections', async () => {
    vi.mocked(client.api.projects[':projectId']['chat-agents'].$get).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'agent-1', name: 'Agent 1', type: 'chat', enabled: true }],
    } as unknown as Awaited<
      ReturnType<(typeof client.api.projects)[':projectId']['chat-agents']['$get']>
    >)

    const mockMessage = {
      id: 'msg-full',
      role: 'custom',
      customType: 'shumai_message',
      content: 'Review this scene carefully',
      details: {
        annotation: true,
        annotations: [
          {
            type: 'box',
            color: '#ff0000',
            points: [
              [0, 0],
              [10, 10],
            ],
          },
        ],
        position: { type: 'time', seconds: 45 },
        currentAsset: { id: 'file-123', name: 'clip.mp4', type: 'file' },
        attachedFiles: [
          { id: 'att-1', name: 'reference-mood.jpg', type: 'image', mediaType: 'image/jpeg' },
        ],
        referencedAssets: [
          { id: 'asset-ref-1', name: 'Storyboard.pdf', type: 'file' },
          { id: 'asset-ref-2', name: 'Audio Stems', type: 'folder' },
        ],
      },
    } as unknown as ChatMessage

    useChatbotStore.setState({
      messages: [mockMessage],
    })

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" contextAssetId="file-123" />
      </QueryClientProvider>,
    )

    // Inline text and timestamp
    expect(getByText('Review this scene carefully')).toBeTruthy()
    expect(getByText('00:45')).toBeTruthy()

    // Attachments section
    expect(getByText('Attachments')).toBeTruthy()
    expect(getByText('reference-mood.jpg')).toBeTruthy()

    // Assets section
    expect(getByText('Assets')).toBeTruthy()
    expect(getByText('Storyboard.pdf')).toBeTruthy()
    expect(getByText('Audio Stems')).toBeTruthy()

    // Card should be full width (w-full)
    const cardEl = getByText('Review this scene carefully').closest('.bg-primary')
    expect(cardEl?.className).toContain('w-full')
  })

  it('asks for confirmation before deleting a session and deletes when confirmed', async () => {
    const mockDeleteSession = vi.fn()
    const originalDeleteSession = useChatbotStore.getState().deleteSession
    useChatbotStore.setState({
      isHistoryMode: true,
      historySessions: [
        {
          id: 'sess-1',
          agentId: 'agent-1',
          userId: 'user-1',
          assetId: 'asset-1',
          userCommentId: null,
          name: 'Important Chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      deleteSession: mockDeleteSession,
    })

    const { useTeamContextStore } = await import('@/ui/stores/team-context')
    useTeamContextStore.setState({ teamId: 'team-123' })

    window.confirm = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm')

    // 1. User cancels confirmation
    confirmSpy.mockReturnValue(false)
    const { getByTitle } = render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" />
      </QueryClientProvider>,
    )

    const deleteBtn = getByTitle('Delete Session')
    deleteBtn.click()
    expect(confirmSpy).toHaveBeenCalled()
    expect(mockDeleteSession).not.toHaveBeenCalled()

    // 2. User confirms deletion
    confirmSpy.mockReturnValue(true)
    deleteBtn.click()
    expect(mockDeleteSession).toHaveBeenCalledWith('team-123', 'sess-1')

    confirmSpy.mockRestore()
    useChatbotStore.setState({ deleteSession: originalDeleteSession })
  })

  it('renders thinking_level_change messages properly in the chat log', () => {
    const mockThinkingChangeMsg = {
      id: 'think-1',
      role: 'thinking_level_change',
      content: 'Thinking level changed to high',
      timestamp: Date.now(),
    } as unknown as ChatMessage

    useChatbotStore.setState({
      messages: [mockThinkingChangeMsg],
    })

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" />
      </QueryClientProvider>,
    )

    expect(getByText('Thinking level changed to high')).toBeTruthy()
  })

  it('disables message input when teamId is not available', async () => {
    const { useTeamContextStore } = await import('@/ui/stores/team-context')
    useTeamContextStore.setState({ teamId: null, projectTeamMap: {} })
    useChatbotStore.setState({ selectedAgentId: 'agent-1' })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ChatbotSidebar projectId="proj-1" />
      </QueryClientProvider>,
    )

    const inputArea = container.querySelector('[contenteditable="false"]')
    expect(inputArea).toBeTruthy()
    expect(inputArea?.getAttribute('contenteditable')).toBe('false')
  })
})
