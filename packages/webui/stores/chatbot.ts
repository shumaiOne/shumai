import { create } from 'zustand'
import { client } from '@/ui/api/client'
import type { ChatMessage, ChatSessionInfo } from '@shumai/dtos'
import type { Annotation } from '@/ui/types'
import { toast } from 'sonner'

export const AGENT_PREFERENCE_STORAGE_KEY = 'shumai_selected_agent_id'

const getInitialAgentId = (): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem(AGENT_PREFERENCE_STORAGE_KEY)
  }
  return null
}

export interface ChatAsset {
  id: string
  name: string
  type: 'file' | 'folder'
}

export interface AttachedFileMeta {
  id: string
  name: string
  type: string
  url?: string
  mediaType?: string
  mimeType?: string
}

interface ChatbotState {
  isChatbotOpen: boolean
  setIsChatbotOpen: (open: boolean) => void
  isHistoryMode: boolean
  setIsHistoryMode: (history: boolean) => void
  currentSessionId: string | null
  setCurrentSessionId: (id: string | null) => void
  chatAssets: ChatAsset[]
  addAssets: (assets: ChatAsset[]) => void
  removeAsset: (id: string) => void
  clearAssets: () => void
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  historySessions: ChatSessionInfo[]
  setHistorySessions: (sessions: ChatSessionInfo[]) => void
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void
  selectedAgentId: string | null
  setSelectedAgentId: (id: string | null) => void
  inputText: string
  setInputText: (text: string) => void

  scrollTop: number
  isAtBottom: boolean
  setScrollState: (scrollTop: number, isAtBottom: boolean) => void

  fetchHistorySessions: (teamId: string) => Promise<void>
  loadSession: (teamId: string, sessionId: string) => Promise<void>
  deleteSession: (teamId: string, sessionId: string) => Promise<void>
  startNewSession: () => void
  sendMessage: (
    teamId: string,
    text: string,
    projectId: string,
    contextAssetId?: string,
    onAssetMutation?: () => void,
    attachmentIds?: string[],
    annotations?: Annotation[],
    second?: number | null,
    attachedFilesMeta?: AttachedFileMeta[],
  ) => Promise<void>
  abortActiveSession: (teamId: string) => Promise<void>
}

export const useChatbotStore = create<ChatbotState>((set) => ({
  isChatbotOpen: false,
  setIsChatbotOpen: (open) => set({ isChatbotOpen: open }),
  isHistoryMode: false,
  setIsHistoryMode: (history) => set({ isHistoryMode: history }),
  currentSessionId: null,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  chatAssets: [],
  addAssets: (assets) =>
    set((state) => {
      const existingIds = new Set(state.chatAssets.map((a) => a.id))
      const uniqueNewAssets = assets.filter((a) => !existingIds.has(a.id))
      return { chatAssets: [...state.chatAssets, ...uniqueNewAssets] }
    }),
  removeAsset: (id) =>
    set((state) => ({
      chatAssets: state.chatAssets.filter((a) => a.id !== id),
    })),
  clearAssets: () => set({ chatAssets: [] }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  historySessions: [],
  setHistorySessions: (sessions) => set({ historySessions: sessions }),
  isStreaming: false,
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  selectedAgentId: getInitialAgentId(),
  setSelectedAgentId: (id) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (id) {
        localStorage.setItem(AGENT_PREFERENCE_STORAGE_KEY, id)
      } else {
        localStorage.removeItem(AGENT_PREFERENCE_STORAGE_KEY)
      }
    }
    set({ selectedAgentId: id })
  },
  inputText: '',
  setInputText: (text) => set({ inputText: text }),
  scrollTop: 0,
  isAtBottom: true,
  setScrollState: (scrollTop, isAtBottom) => set({ scrollTop, isAtBottom }),

  fetchHistorySessions: async (teamId) => {
    try {
      const res = await client.api.teams[':teamId'].chat.sessions.$get({
        param: { teamId },
        query: { first: '50' },
      })
      if (res.ok) {
        const data = await res.json()
        set({ historySessions: data.data || [] })
      }
    } catch (err) {
      console.error('Failed to fetch history sessions:', err)
    }
  },

  loadSession: async (teamId, sessionId) => {
    try {
      const res = await client.api.teams[':teamId'].chat.sessions[':sessionId'].messages.$get({
        param: { teamId, sessionId },
      })
      if (res.ok) {
        const messages = await res.json()
        const sessionInfo = useChatbotStore
          .getState()
          .historySessions.find((s) => s.id === sessionId)
        const agentId = sessionInfo?.agentId || null
        set({
          currentSessionId: sessionId,
          messages: messages as ChatMessage[],
          isHistoryMode: false,
          scrollTop: 0,
          isAtBottom: true,
          ...(agentId ? { selectedAgentId: agentId } : {}),
        })
      } else {
        throw new Error('Failed to load session messages')
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load session'
      toast.error(errMsg)
    }
  },

  deleteSession: async (teamId, sessionId) => {
    try {
      const res = await client.api.teams[':teamId'].chat.sessions[':sessionId'].$delete({
        param: { teamId, sessionId },
      })
      if (res.ok) {
        toast.success('Session deleted successfully')
        set((s) => ({
          historySessions: s.historySessions.filter((sess) => sess.id !== sessionId),
          currentSessionId: s.currentSessionId === sessionId ? null : s.currentSessionId,
          messages: s.currentSessionId === sessionId ? [] : s.messages,
        }))
      } else {
        throw new Error('Failed to delete session')
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to delete session'
      toast.error(errMsg)
    }
  },

  startNewSession: () => {
    const savedAgentId = getInitialAgentId()
    set({
      currentSessionId: null,
      messages: [],
      chatAssets: [],
      inputText: '',
      scrollTop: 0,
      isAtBottom: true,
      ...(savedAgentId ? { selectedAgentId: savedAgentId } : {}),
    })
  },

  sendMessage: async (
    teamId,
    text,
    projectId,
    contextAssetId,
    onAssetMutation,
    attachmentIds,
    annotations,
    second,
    attachedFilesMeta,
  ) => {
    const state = useChatbotStore.getState()
    if (state.isStreaming) return

    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      role: 'custom' as const,
      customType: 'shumai_message',
      content: text,
      display: true,
      details: {
        currentAsset: contextAssetId ? { id: contextAssetId, name: '', type: 'file' } : undefined,
        position:
          second !== undefined && second !== null ? { type: 'time', seconds: second } : undefined,
        annotation: !!(annotations && annotations.length > 0),
        annotations: annotations || undefined,
        attachedFiles: attachedFilesMeta || undefined,
        referencedAssets:
          state.chatAssets.length > 0
            ? state.chatAssets.map((a) => ({ id: a.id, name: a.name, type: a.type }))
            : undefined,
      },
      timestamp: Date.now(),
    } as unknown as ChatMessage

    const newMessages = [...state.messages, optimisticMsg]

    set({
      messages: newMessages,
      isStreaming: true,
      chatAssets: [],
      isAtBottom: true,
    })

    const assetIds = state.chatAssets.map((a) => a.id)

    const agentId = state.selectedAgentId
    if (!agentId) {
      toast.error('No agent selected')
      return
    }

    try {
      const res = await client.api.teams[':teamId'].chat.$post({
        param: { teamId },
        json: {
          agentId,
          textPrompt: text || undefined,
          attachedFiles: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
          assetIds: assetIds && assetIds.length > 0 ? assetIds : undefined,
          sessionId: state.currentSessionId || undefined,
          contextAssetId,
          projectId,
          second: second ?? undefined,
          annotations:
            annotations && annotations.length > 0
              ? (annotations as unknown as Record<string, unknown>[])
              : undefined,
        },
      })

      if (!res.ok) {
        throw new Error('Failed to start chat')
      }

      // Try reading custom header first
      const headerSessionId = res.headers.get('x-session-id')
      if (headerSessionId && !state.currentSessionId) {
        set({ currentSessionId: headerSessionId })
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('No stream body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const data = JSON.parse(dataStr)
              if (data.type === 'session') {
                if (!useChatbotStore.getState().currentSessionId) {
                  set({ currentSessionId: data.sessionId })
                }
              } else if (data.type === 'entry') {
                const entry = data.entry as ChatMessage
                const entryObj = entry as unknown as Record<string, unknown>
                if (
                  entryObj.role === 'toolResult' &&
                  typeof entryObj.toolName === 'string' &&
                  ['create_file', 'create_folder', 'create_version'].includes(entryObj.toolName) &&
                  !entryObj.isError
                ) {
                  onAssetMutation?.()
                }

                set((s) => {
                  const isExisting = s.messages.some((m) => m.id === entry.id)
                  const isUserMessage =
                    (entry.role === 'user' ||
                      (entry.role === 'custom' && entry.customType === 'shumai_message')) &&
                    !isExisting
                  // Replace temp/optimistic message when the real counterpart streams back
                  const filtered = s.messages.filter((m) => {
                    if (isUserMessage) {
                      return !m.id.startsWith('temp-')
                    }
                    if (
                      entry.role === 'custom' &&
                      entry.customType === 'context_display_info' &&
                      !isExisting
                    ) {
                      return !m.id.startsWith('temp-context-')
                    }
                    return true
                  })

                  // Prevent duplicates by ID
                  const existingIdx = filtered.findIndex((m) => m.id === entry.id)
                  if (existingIdx !== -1) {
                    const copy = [...filtered]
                    copy[existingIdx] = entry
                    return { messages: copy }
                  } else {
                    return { messages: [...filtered, entry] }
                  }
                })
              } else if (data.type === 'done') {
                if (data.status === 'failed') {
                  toast.error(data.error || 'Workflow failed')
                }
              }
            } catch (err) {
              console.error('Error parsing SSE line:', err)
            }
          }
        }
      }

      // If we finished successfully, trigger a history list refresh
      const finalState = useChatbotStore.getState()
      finalState.fetchHistorySessions(teamId)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message'
      toast.error(errMsg)
      // Remove optimistic message on failure
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== tempId),
      }))
    } finally {
      set({ isStreaming: false })
    }
  },

  abortActiveSession: async (teamId) => {
    const { currentSessionId, isStreaming } = useChatbotStore.getState()
    if (!currentSessionId || !isStreaming) return

    try {
      const res = await client.api.teams[':teamId'].chat.sessions[':sessionId'].abort.$post({
        param: { teamId, sessionId: currentSessionId },
      })
      if (res.ok) {
        toast.success('Agent execution stopped')
      } else {
        throw new Error('Failed to abort agent execution')
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to abort execution'
      toast.error(errMsg)
    }
  },
}))
