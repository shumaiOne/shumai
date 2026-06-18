import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import authnRoute from './authn'
import { teamService } from '@shumai/core/src/team/team'

describe('authn api', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGetSignupInfo: any

  beforeEach(() => {
    mockGetSignupInfo = vi.spyOn(teamService, 'getSignupInfo')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /signup-info', async () => {
    mockGetSignupInfo.mockResolvedValue({
      initialized: true,
      demoMode: false,
    })

    const app = new Hono().route('/', authnRoute)
    const res = await app.request('/signup-info')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      initialized: true,
      demoMode: false,
    })
  })
})
