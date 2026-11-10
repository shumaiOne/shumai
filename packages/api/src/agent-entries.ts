import type { EntryRecord } from '@earendil-works/pi-durable'
import type { TypedResponse } from 'hono'

/** Pi records are already JSON; retain their public types without recursively remapping SDK schemas. */
export function agentEntriesResponse(
  entries: EntryRecord[],
): Response & TypedResponse<EntryRecord[], 200, 'json'> {
  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  }) as Response & TypedResponse<EntryRecord[], 200, 'json'>
}
