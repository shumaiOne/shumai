import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import type { ImageSearchRequest } from '@shumai/dtos'

export async function searchByImage(
  folderId: string,
  request: ImageSearchRequest,
  signal: AbortSignal,
) {
  const res = await client.api.folders[':folderId']['image-search'].$post(
    { param: { folderId }, json: request },
    { init: { signal } },
  )
  if (!res.ok) {
    if (res.status === 409) throw new Error(m.image_search_waiting_for_index())
    if (res.status === 422) throw new Error(m.enable_embedding_agent_hint())
    if (res.status === 400 || res.status === 413) throw new Error(m.image_search_invalid_image())
    throw new Error(m.search_failed())
  }
  return res.json()
}
