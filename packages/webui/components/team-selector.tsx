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

  if (isLoading) {
    return <div>Loading...</div>
  }

  const teams = teamsData?.data

  if (teams?.length === 1) {
    navigate({ to: `/teams/${teams[0].id}` })
    return null
  }

  return (
    <Dialog open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.select_a_team()}</DialogTitle>
          <DialogDescription>
            You are a member of multiple teams. Please select one to continue.
          </DialogDescription>
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
