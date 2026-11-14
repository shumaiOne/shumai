import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerService } from '@shumai/core/src/runner'
import runnerWsRoute from './runner-ws'

vi.mock('@shumai/core/src/runner', () => ({
  runnerService: {
    authenticateRunnerKey: vi.fn(),
    registerConnection: vi.fn(),
    handleMessage: vi.fn(),
    handleDisconnect: vi.fn(),
  },
}))

describe('runnerWsRoute', () => {
  const app = new Hono().route('/', runnerWsRoute)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when runner key is missing', async () => {
    const res = await app.request('/runners/ws')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'Missing runner key' })
  })

  it('returns 401 when runner key is invalid', async () => {
    vi.mocked(runnerService.authenticateRunnerKey).mockResolvedValue(null)
    const res = await app.request('/runners/ws', {
      headers: { Authorization: 'Bearer shm_rn_invalid' },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'Invalid runner key' })
  })
})
