import { Hono } from 'hono'
import { runnerService, type RunnerSocket } from '@shumai/core/src/runner'

export interface RunnerWsData {
  runner: {
    id: string
    teamId: string
    name: string
  }
}

interface BunServerLike {
  upgrade(req: Request, options?: { data?: RunnerWsData }): boolean
}

function extractRunnerKey(authHeader?: string | null, customHeader?: string | null): string | null {
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }
  if (customHeader) {
    return customHeader.trim()
  }
  return null
}

const runnerWsRoute = new Hono().get('/runners/ws', async (c) => {
  const rawKey = extractRunnerKey(c.req.header('authorization'), c.req.header('x-runner-key'))
  if (!rawKey) {
    return c.json({ message: 'Missing runner key' }, 401)
  }

  const runner = await runnerService.authenticateRunnerKey(rawKey)
  if (!runner) {
    return c.json({ message: 'Invalid runner key' }, 401)
  }

  const env = c.env as BunServerLike | { server?: BunServerLike } | undefined
  const server: BunServerLike | undefined =
    env && typeof (env as BunServerLike).upgrade === 'function'
      ? (env as BunServerLike)
      : env && typeof (env as { server?: BunServerLike }).server?.upgrade === 'function'
        ? (env as { server?: BunServerLike }).server
        : undefined

  if (!server) {
    return c.json({ message: 'WebSocket upgrade is not supported in this environment' }, 426)
  }

  const upgraded = server.upgrade(c.req.raw, {
    data: { runner },
  })
  if (upgraded) {
    return new Response(null)
  }
  return c.json({ message: 'WebSocket upgrade failed' }, 400)
})

export const runnerWebsocket = {
  open(ws: RunnerSocket & { data?: RunnerWsData }) {
    const runner = ws.data?.runner
    if (!runner) {
      ws.close(1008, 'Unauthorized')
      return
    }
    void runnerService.registerConnection(runner, ws)
  },
  message(ws: RunnerSocket & { data?: RunnerWsData }, message: string | Buffer | Uint8Array) {
    const runner = ws.data?.runner
    if (!runner) return
    runnerService.handleMessage(runner.id, ws, message)
  },
  close(ws: RunnerSocket & { data?: RunnerWsData }, code: number) {
    const runner = ws.data?.runner
    if (!runner) return
    runnerService.handleDisconnect(runner.id, ws, code)
  },
}

export default runnerWsRoute
