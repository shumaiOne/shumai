import type { z } from 'zod'
import type { AnyOperationDefinition } from '@shumai/operations'
import { getCliConfig } from '../client'
import { CliError } from './errors'

/** Header that attributes invocations to the CLI (`via: cli`) in audit logs. */
const CLIENT_HEADER = 'x-shumai-client'

/** Signature used by generated commands, which only see type-erased definitions. */
export type CallOperation = (
  definition: AnyOperationDefinition,
  input: Record<string, unknown>,
) => Promise<unknown>

/** Runs an Operation on the server via `POST /api/ops/:name`. */
export async function callOperation<TDef extends AnyOperationDefinition>(
  definition: TDef,
  input: z.output<TDef['input']>,
): Promise<z.output<TDef['output']>> {
  const { apiServer, apiKey } = getCliConfig()

  let res: Response
  try {
    res = await fetch(`${apiServer}/api/ops/${definition.name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        [CLIENT_HEADER]: 'cli',
      },
      body: JSON.stringify(input),
    })
  } catch (err) {
    throw new CliError(
      `Error connecting to API server: ${err instanceof Error ? err.message : String(err)}`,
      { prefixed: true },
    )
  }

  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${res.status}`
    throw new CliError(message)
  }

  const parsed = definition.output.safeParse(body)
  if (!parsed.success) {
    throw new CliError(`Unexpected response from server for ${definition.name}`)
  }
  // safeParse on the generic schema type loses the concrete shape; the schema guarantees it.
  return parsed.data as z.output<TDef['output']>
}
