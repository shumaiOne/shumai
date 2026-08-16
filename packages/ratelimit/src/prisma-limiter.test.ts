// Focused tests for the Prisma-backed state: consume semantics, CAS
// contention, persistence across instances (restart/redeploy safety), and
// validation. These run against a real Postgres via @shumai/db test hooks.

import { describe, expect, it } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { MockClock } from './clock'
import { PrismaLimiter } from './prisma-limiter'

const START = Date.parse('2024-01-01T00:00:00Z')
const NS_PER_MS = 1_000_000n

describe('PrismaLimiter (Prisma-backed state)', () => {
  setupTestDbHooks()

  it('validates its configuration', () => {
    expect(() => new PrismaLimiter({ rate: 0 })).toThrow(/rate/)
    expect(() => new PrismaLimiter({ rate: -1 })).toThrow(/rate/)
    expect(() => new PrismaLimiter({ rate: 1.5 })).toThrow(/rate/)
    expect(() => new PrismaLimiter({ rate: 10, slack: -1 })).toThrow(/slack/)
    expect(() => new PrismaLimiter({ rate: 10, perMs: 0 })).toThrow(/perMs/)
  })

  it('lazily creates the state row on first use', async () => {
    const clock = new MockClock(START)
    const limiter = new PrismaLimiter({ rate: 10, clock })

    expect(await prisma.rateLimitState.findUnique({ where: { key: 'k' } })).toBeNull()

    const result = await limiter.allow('k')
    expect(result).toEqual({ allowed: true, retryAfterMs: 0 })

    const row = await prisma.rateLimitState.findUnique({ where: { key: 'k' } })
    expect(row?.nextPermissionTimeNanos).toBe(BigInt(START) * NS_PER_MS)
  })

  it('allow() consumes a slot and reports retryAfterMs', async () => {
    const clock = new MockClock(START)
    const limiter = new PrismaLimiter({ rate: 100, slack: 0, clock })

    expect(await limiter.allow('k')).toEqual({ allowed: true, retryAfterMs: 0 })
    // Second request at the same instant must wait one per-request interval.
    expect(await limiter.allow('k')).toEqual({ allowed: false, retryAfterMs: 10 })
  })

  it('take() sleeps until the permitted time and returns it', async () => {
    const clock = new MockClock(START)
    const limiter = new PrismaLimiter({ rate: 10, slack: 0, clock })

    expect((await limiter.take('k')).getTime()).toBe(START)

    const pending = limiter.take('k')
    clock.advance(99)
    let settled = false
    pending.then(() => {
      settled = true
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)

    clock.advance(1)
    expect((await pending).getTime()).toBe(START + 100)
  })

  it('serializes concurrent takes on a fresh key (CAS retry loop)', async () => {
    const clock = new MockClock(START)
    const limiter = new PrismaLimiter({ rate: 100, slack: 0, clock })

    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.allow('k')))

    expect(results.filter((r) => r.allowed)).toHaveLength(1)
    const retries = results
      .filter((r) => !r.allowed)
      .map((r) => r.retryAfterMs)
      .sort((a, b) => a - b)
    expect(retries).toEqual(Array.from({ length: 19 }, (_, i) => 10 * (i + 1)))
  })

  it('caps bursts after an idle period to the accumulated slack', async () => {
    const clock = new MockClock(START)
    const limiter = new PrismaLimiter({ rate: 10, slack: 1, clock }) // perRequest 100ms, maxSlack 100ms

    await limiter.allow('k') // t = 0: state -> now
    clock.advance(5000)

    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.allow('k')))
    // Idle longer than maxSlack + perRequest: reset grants now - maxSlack, then
    // one more slot fits within now; everything after must wait.
    expect(results.filter((r) => r.allowed)).toHaveLength(2)
  })

  it('persists state across limiter instances (redeploy-safe)', async () => {
    const clock = new MockClock(START)
    const a = new PrismaLimiter({ rate: 10, slack: 0, clock })

    expect((await a.allow('k')).allowed).toBe(true) // t0: allowed now
    expect((await a.allow('k')).allowed).toBe(false) // retry 100ms

    clock.advance(150)
    expect((await a.allow('k')).allowed).toBe(false) // retry 50ms
    clock.advance(150)
    expect((await a.allow('k')).allowed).toBe(true) // now == next slot

    // "Redeploy": a brand new instance reads the persisted state.
    const b = new PrismaLimiter({ rate: 10, slack: 0, clock })
    const afterRedeploy = await b.allow('k')
    expect(afterRedeploy).toEqual({ allowed: false, retryAfterMs: 100 })
  })

  it('treats distinct keys as independent limiters', async () => {
    const clock = new MockClock(START)
    const limiter = new PrismaLimiter({ rate: 1, slack: 0, clock }) // 1 per second

    expect((await limiter.allow('a')).allowed).toBe(true)
    expect((await limiter.allow('a')).allowed).toBe(false) // key 'a' exhausted

    expect((await limiter.allow('b')).allowed).toBe(true) // key 'b' is fresh
  })
})
