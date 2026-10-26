import { Hono } from 'hono'
import type { Prisma } from '@shumai/db'
import { getOperation, runOperation } from '@shumai/core/src/operations'
import { assertWritableInDemoMode, describeOperationError } from './operation-support'

type User = Prisma.UserGetPayload<Record<string, never>>

/** Header the CLI sends so its invocations are attributed to `via: cli` in audit logs. */
export const CLIENT_HEADER = 'x-shumai-client'

/**
 * Generic Operation endpoint used by `shumai-cli`: `POST /ops/:name` with the Operation input
 * as the JSON body. Requires API token authentication (mounted with `requireApiTokenMiddleware`).
 */
const route = new Hono<{ Variables: { user: User } }>().post('/ops/:name', async (c) => {
  const name = c.req.param('name')
  const op = getOperation(name)
  if (!op || !op.definition.surfaces.includes('cli')) {
    return c.json({ error: `Unknown operation "${name}"` }, 404)
  }

  let input: unknown = {}
  const body = await c.req.text()
  if (body.trim()) {
    try {
      input = JSON.parse(body)
    } catch {
      return c.json({ error: 'Request body must be a JSON object' }, 400)
    }
  }

  const userId = c.get('user').id
  const via = c.req.header(CLIENT_HEADER) === 'cli' ? 'cli' : 'api'
  try {
    await assertWritableInDemoMode(op, userId)
    const output = await runOperation(op, { userId, via }, input)
    return c.json(output as Record<string, unknown>)
  } catch (err) {
    const { status, message } = describeOperationError(name, err)
    return c.json({ error: message }, status)
  }
})

export default route
