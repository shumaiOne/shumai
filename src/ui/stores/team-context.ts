import { client } from '@/ui/api/client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface TeamContextState {
  teamId: string | null
  projectTeamMap: Record<string, string>
  setTeamId: (id: string | null) => void
  ensureTeamIdForProject: (projectId: string) => Promise<string | null>
}

export const useTeamContextStore = create<TeamContextState>()(
  persist(
    (set, get) => ({
      teamId: null,
      projectTeamMap: {},
      setTeamId: (id) => set({ teamId: id }),
      ensureTeamIdForProject: async (projectId) => {
        const state = get()
        // Check cache first
        if (state.projectTeamMap[projectId]) {
          const cachedTeamId = state.projectTeamMap[projectId]
          if (state.teamId !== cachedTeamId) {
            set({ teamId: cachedTeamId })
          }
          return cachedTeamId
        }

        // Fetch if not in cache
        try {
          const res = await client.api.projects[':projectId'].team.$get({
            param: { projectId: projectId },
          })
          if (!res.ok) throw new Error('failed to fetch project team')
          const data = await res.json()
          if (data && data.teamId) {
            set((prev) => ({
              teamId: data.teamId!,
              projectTeamMap: {
                ...prev.projectTeamMap,
                [projectId]: data.teamId!,
              },
            }))
            return data.teamId!
          }
        } catch (error) {
          console.error('Failed to fetch team ID for project', projectId, error)
        }
        return null
      },
    }),
    {
      name: 'team-context-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
