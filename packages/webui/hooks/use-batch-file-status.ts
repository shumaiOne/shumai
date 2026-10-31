import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AssetInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'

export const BATCH_SIZE = 100
export const BATCH_POLL_INTERVAL_MS = 2000

export interface UseBatchFileStatusOptions {
  teamId?: string
  items: AssetInfo[]
}

export function useBatchFileStatus({ teamId, items }: UseBatchFileStatusOptions): void {
  const queryClient = useQueryClient()

  const processingIds = useMemo(() => {
    if (!teamId) return []
    return items
      .filter(
        (item) =>
          item.id &&
          (item.type === 'file' || item.type === 'version_stack') &&
          (item.status === 'uploaded' || item.status === 'processing'),
      )
      .map((item) => item.id!)
  }, [items, teamId])

  const queryKey = useMemo(() => {
    return ['files', 'batch', teamId, [...processingIds].sort().join(',')]
  }, [teamId, processingIds])

  useQuery({
    queryKey,
    queryFn: async () => {
      if (processingIds.length === 0) return []

      const chunks: string[][] = []
      for (let i = 0; i < processingIds.length; i += BATCH_SIZE) {
        chunks.push(processingIds.slice(i, i + BATCH_SIZE))
      }

      const results = await Promise.all(
        chunks.map(async (chunkIds) => {
          const res = await client.api.files.batch.$post({
            json: { ids: chunkIds },
          })
          if (!res.ok) throw new Error('Failed to fetch batch file statuses')
          return (await res.json()) as unknown as AssetInfo[]
        }),
      )

      const assets = results.flat()

      for (const asset of assets) {
        if (asset.id) {
          queryClient.setQueryData(['file', teamId, asset.id], asset)
        }
      }

      const hasFinished = assets.some(
        (a) => a.status === 'processed' || a.status === 'failed' || a.status === 'error',
      )
      if (hasFinished) {
        queryClient.invalidateQueries({ queryKey: ['search', teamId] })
      }

      return assets
    },
    enabled: !!teamId && processingIds.length > 0,
    refetchInterval: BATCH_POLL_INTERVAL_MS,
  })
}
