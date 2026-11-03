import { useQuery } from '@tanstack/react-query'
import { client } from '@/ui/api/client'

export interface ArchiveConfig {
  archiveStorageEnabled: boolean
  isLoading: boolean
}

export function useArchiveConfig(): ArchiveConfig {
  const { data, isLoading } = useQuery({
    queryKey: ['signup-info'],
    queryFn: async () => {
      const res = await client.api['signup-info'].$get()
      if (!res.ok) {
        return { initialized: true, demoMode: false, archiveStorageEnabled: false }
      }
      return (await res.json()) as {
        initialized?: boolean
        demoMode?: boolean
        archiveStorageEnabled?: boolean
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    archiveStorageEnabled: Boolean(data?.archiveStorageEnabled),
    isLoading,
  }
}
