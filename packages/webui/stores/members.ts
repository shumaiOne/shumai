import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { client } from '@/ui/api/client'
import type { UserInfo } from '@shumai/dtos'

interface MemberState {
  members: UserInfo[]
  loadedTeamId?: string
  loadedWithAgents?: boolean
  loading: boolean
  fetchMembers: (teamId: string, includeAgents?: boolean, force?: boolean) => Promise<void>
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
            members: (members as UserInfo[]) || [],
            loadedTeamId: teamId,
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
