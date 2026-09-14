import { hc } from 'hono/client'
import type { AppType } from '@shumai/api'

export type ShumaiClient = ReturnType<typeof hc<AppType>>

let currentClient: ShumaiClient | null = null
let currentKey = ''

export function getShumaiClient(endpoint: string, apiKey: string): ShumaiClient {
  const normalizedEndpoint = endpoint.trim().replace(/\/+$/, '')
  const cacheKey = `${normalizedEndpoint}::${apiKey}`

  if (currentClient && currentKey === cacheKey) {
    return currentClient
  }

  currentClient = hc<AppType>(normalizedEndpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'x-api-key': apiKey,
    },
  })
  currentKey = cacheKey

  return currentClient
}

export function resetClient(): void {
  currentClient = null
  currentKey = ''
}
