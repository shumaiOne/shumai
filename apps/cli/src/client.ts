import { hc } from 'hono/client'
import type { AppType } from '@shumai/api'

export function getClient() {
  const apiKey = process.env.SHUMAI_API_KEY
  const apiServer = process.env.SHUMAI_API_SERVER

  if (!apiServer) {
    console.error('Error: SHUMAI_API_SERVER environment variable is not set.')
    process.exit(1)
  }

  if (!apiKey) {
    console.error(
      'Error: SHUMAI_API_KEY environment variable is not set. Please generate a token in the Settings -> Developer tab.',
    )
    process.exit(1)
  }

  return hc<AppType>(apiServer, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
}
