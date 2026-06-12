import { client } from '@/ui/api/client'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export interface Permissions {
  role: string | undefined
  /** Whether the user can perform write operations (owner or editor) */
  canEdit: boolean
  /** Whether the user can perform admin operations (owner only) */
  canAdmin: boolean
}

/**
 * Hook that derives permission booleans from the current user's team role.
 *
 * Permission model (mirrors backend AuthzService.checkRole):
 * - Read:  all roles (owner, editor, reviewer)
 * - Edit:  owner + editor
 * - Admin: owner only
 *
 * Reuses the same React Query cache key (['teams', teamId, 'me']) populated
 * by __root.tsx, so no extra API calls are made.
 */
export function usePermissions(projectId?: string): Permissions {
  const teamId = useTeamContextStore((s) => s.teamId)

  const { data: me } = useQuery({
    queryKey: projectId ? ['projects', projectId, 'me'] : ['teams', teamId, 'me'],
    queryFn: async () => {
      if (projectId) {
        const res = await client.api.projects[':projectId'].me.$get({
          param: { projectId },
        })
        if (!res.ok) throw new Error('Failed to fetch project me')
        return await res.json()
      } else {
        if (!teamId) return null
        const res = await client.api.teams[':teamId'].me.$get({
          param: { teamId },
        })
        if (!res.ok) throw new Error('Failed to fetch team me')
        return await res.json()
      }
    },
    enabled: projectId ? !!projectId : !!teamId,
  })

  return useMemo(
    () => ({
      role: me?.role,
      canEdit: me?.role === 'owner' || me?.role === 'editor',
      canAdmin: me?.role === 'owner',
    }),
    [me?.role],
  )
}
