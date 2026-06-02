import { create } from 'zustand'
import { client } from '@/ui/api/client'

interface UserMetadataState {
  metadata: Record<string, unknown>
  isLoading: boolean
  error: string | null

  fetchMetadata: (teamId: string) => Promise<void>
  setMetadata: (teamId: string, key: string, value: unknown) => Promise<void>
  getMetadata: <T>(key: string, defaultValue?: T) => T | undefined
}

export const useUserMetadataStore = create<UserMetadataState>((set, get) => ({
  metadata: {},
  isLoading: false,
  error: null,

  fetchMetadata: async (teamId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await client.api.teams[':teamId']['user-metadata'].$get({
        param: { teamId: teamId },
      })
      if (!res.ok) throw new Error('failed to fetch user metadata')
      const data = await res.json()

      const metadataMap = data.reduce((acc: Record<string, unknown>, item) => {
        acc[item.key] = item.value
        return acc
      }, {})

      set({ metadata: metadataMap, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false })
    }
  },

  setMetadata: async (teamId, key, value) => {
    // Optimistic update
    const previousMetadata = get().metadata
    set((state) => ({
      metadata: { ...state.metadata, [key]: value },
    }))

    try {
      const res = await client.api.teams[':teamId']['user-metadata'][':key'].$put({
        param: { teamId: teamId, key },
        json: { value },
      })
      if (!res.ok) throw new Error('failed to update user metadata')
    } catch (err) {
      // Rollback on error
      set({ metadata: previousMetadata })
      console.error(err)
    }
  },

  getMetadata: (key, defaultValue) => {
    const val = get().metadata[key]
    // We use a cast here because the metadata store holds unknown values,
    // and we want to allow the caller to specify the expected type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (val !== undefined ? val : defaultValue) as any
  },
}))
