import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { useQuery } from '@tanstack/react-query'

export function useSemanticSearchEnabled(teamId: string, enabled: boolean): boolean {
  const { data } = useQuery({
    queryKey: ['team-settings', teamId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].settings.$get({ param: { teamId } })
      if (!res.ok) throw new Error(m.failed_load_settings())
      return await res.json()
    },
    enabled,
  })

  return data?.semanticSearchEnabled ?? false
}
