import { hc } from 'hono/client'
import type { AppType } from '@shumai/api'

export interface CliConfig {
  apiServer: string
  apiKey: string
}

/** Reads the server URL and API token from the environment, exiting with guidance if missing. */
export function getCliConfig(): CliConfig {
  const apiKey = process.env.SHUMAI_API_KEY
  const apiServer = process.env.SHUMAI_API_SERVER

  if (!apiServer) {
    console.error('Error: SHUMAI_API_SERVER environment variable is not set.')
    process.exit(1)
  }

  if (!apiKey) {
    console.error(
      'Error: SHUMAI_API_KEY environment variable is not set. Please generate a token in the Settings -> API Tokens tab.',
    )
    process.exit(1)
  }

  return { apiServer: apiServer.replace(/\/+$/, ''), apiKey }
}

/** Typed REST client, used by commands that are not Operations yet (upload, create-version). */
export function getClient() {
  const { apiServer, apiKey } = getCliConfig()
  return hc<AppType>(apiServer, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
}
