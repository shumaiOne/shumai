import type { AssetInfo, ChunkPreviewState } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { Film, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { SpriteScrubber } from '../sprite-scrubber'

export function ChunkVideoPreview({
  assetId,
  chunk,
  startTime,
  endTime,
  focused,
}: {
  assetId: string
  chunk: NonNullable<AssetInfo['chunkPreview']>
  startTime: number
  endTime: number
  focused?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || Boolean(focused)
  const queryKey = ['video-chunk-preview', assetId, chunk.matchId] as const
  const query = useQuery<ChunkPreviewState>({
    queryKey,
    enabled: active && !chunk.preview,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (active && query.state.data?.status === 'pending' ? 1200 : false),
    queryFn: async ({ signal, client: queryClient }) => {
      const status = queryClient.getQueryData<ChunkPreviewState>(queryKey)?.status
      const endpoint = client.api.files[':fileId']['chunk-previews'][':matchId']
      const params = { param: { fileId: assetId, matchId: chunk.matchId } }
      const response =
        status === 'pending' || status === 'ready'
          ? await endpoint.$get(params, { init: { signal } })
          : await endpoint.$post(params, { init: { signal } })
      if (!response.ok) throw new Error('Failed to load video chunk preview')
      return response.json()
    },
  })
  const preview = chunk.preview ?? (query.data?.status === 'ready' ? query.data.preview : undefined)
  const position = (timestamp: number) => (timestamp - startTime) / (endTime - startTime)
  const loading = active && (query.isFetching || query.data?.status === 'pending')

  return (
    <div
      className="relative h-full w-full bg-muted"
      data-testid="chunk-video-preview"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {preview ? (
        <SpriteScrubber
          active={active}
          spriteUrl={preview.spriteUrl}
          thumbnailUrl={preview.posterUrl}
          videoWidth={preview.frameWidth}
          videoHeight={preview.frameHeight}
          columns={preview.columns}
          rows={preview.rows}
          frames={preview.timestamps.map((timestamp, index) => ({
            index,
            position: position(timestamp),
          }))}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          {loading ? (
            <span role="status" aria-label={m.loading()}>
              <Loader2 className="size-5 animate-spin" />
            </span>
          ) : (
            <Film className="size-7" aria-label={m.preview_unavailable()} />
          )}
        </div>
      )}
    </div>
  )
}
