import { client } from '@/ui/api/client'
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

function getIdsFromPathname(pathname: string): {
  teamId?: string
  projectId?: string
} {
  const teamMatch = pathname.match(/teams\/([^/]+)/)
  if (teamMatch) {
    return { teamId: teamMatch[1] }
  }

  const projectMatch = pathname.match(/projects\/([^/]+)/)
  if (projectMatch) {
    return { projectId: projectMatch[1] }
  }

  return {}
}

export function useTeamId() {
  const [teamId, setTeamId] = useState<string | undefined>()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const { teamId: paramsTeamId, projectId: paramsProjectId } = getIdsFromPathname(pathname)

  const { data: projectTeam } = useQuery({
    queryKey: ['projects', paramsProjectId, 'team'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].team.$get({
        param: { projectId: paramsProjectId! },
      })
      if (!res.ok) throw new Error('failed to fetch project team')
      return await res.json()
    },
    enabled: !!paramsProjectId,
  })

  useEffect(() => {
    if (paramsTeamId) {
      setTeamId(paramsTeamId)
    } else if (projectTeam?.teamId) {
      setTeamId(projectTeam.teamId)
    }
  }, [paramsTeamId, projectTeam])

  return teamId
}
