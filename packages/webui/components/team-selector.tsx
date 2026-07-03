import { client } from '@/ui/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { m } from '@/ui/paraglide/messages.js'

export function TeamSelector() {
  const navigate = useNavigate()
  const { data: teamsData, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await client.api.teams.$get({
        query: {},
      })
      if (!res.ok) throw new Error('Failed to get teams')
      return await res.json()
    },
  })

  const teams = teamsData?.data
  const onlyTeamId = teams?.length === 1 ? teams[0].id : null

  useEffect(() => {
    if (onlyTeamId) {
      navigate({ to: `/teams/${onlyTeamId}` })
    }
  }, [onlyTeamId, navigate])

  if (isLoading) {
    return <div>{m.loading()}</div>
  }

  if (onlyTeamId) {
    return null
  }

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.select_a_team()}</DialogTitle>
          <DialogDescription>{m.select_team_description()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {teams?.map((team) => (
            <div
              key={team.id}
              className="p-2 border rounded-md cursor-pointer hover:bg-gray-100"
              onClick={() => navigate({ to: `/teams/${team.id}` })}
            >
              {team.name}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
