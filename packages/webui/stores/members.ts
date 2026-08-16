import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { client } from '@/ui/api/client'
import type { UserInfo, ProjectUserInfo } from '@shumai/dtos'

export type MemberInfo = UserInfo | ProjectUserInfo

interface MemberState {
  members: MemberInfo[]
  loadedTeamId?: string
  loadedProjectId?: string
  loadedWithAgents?: boolean
  loading: boolean
  fetchMembers: (teamId: string, includeAgents?: boolean, force?: boolean) => Promise<void>
  fetchProjectMembers: (
    projectId: string,
    includeAgents?: boolean,
    force?: boolean,
  ) => Promise<void>
}

export const useMemberStore = create<MemberState>()(
  devtools(
    immer((set, get) => ({
      members: [],
      loading: false,
      fetchMembers: async (teamId, includeAgents, force) => {
        if (!force && get().loadedTeamId === teamId && get().loadedWithAgents === includeAgents) {
          return
        }

        set({ loading: true })
        try {
          const res = await client.api.teams[':teamId'].members.$get({
            param: { teamId: teamId },
            query: { includeAgents: includeAgents ? 'true' : 'false' },
          })
          if (!res.ok) throw new Error('failed to fetch members')
          const members = await res.json()
          set({
            members: (members as MemberInfo[]) || [],
            loadedTeamId: teamId,
            loadedProjectId: undefined,
            loadedWithAgents: includeAgents,
            loading: false,
          })
        } catch {
          set({
            loading: false,
          })
        }
      },
      fetchProjectMembers: async (projectId, includeAgents, force) => {
        if (
          !force &&
          get().loadedProjectId === projectId &&
          get().loadedWithAgents === includeAgents
        ) {
          return
        }

        set({ loading: true })
        try {
          const res = await client.api.projects[':projectId'].members.$get({
            param: { projectId: projectId },
            query: { includeAgents: includeAgents ? 'true' : 'false' },
          })
          if (!res.ok) throw new Error('failed to fetch project members')
          const members = await res.json()
          set({
            members: (members as MemberInfo[]) || [],
            loadedProjectId: projectId,
            loadedTeamId: undefined,
            loadedWithAgents: includeAgents,
            loading: false,
          })
        } catch {
          set({
            loading: false,
          })
        }
      },
    })),
  ),
)
