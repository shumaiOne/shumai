// Ported from go.uber.org/ratelimit ratelimit_test.go (MIT).
//
// The original drives three limiter implementations (mutex/atomic/atomic_int64)
// with a mock clock and goroutines. We port the mock-clock test harness to a
// deterministic async runner (MockClock + an event-loop-flushing driver) and
// run every scenario against the Prisma-backed limiter. Scenarios marked
// "shared key" additionally verify that the DB state is shared across limiter
// instances, which the in-memory Go implementation cannot do.

import { describe, expect, it } from 'vitest'
import { setupTestDbHooks } from '@shumai/db/test'
import { MockClock } from './clock'
import { PrismaLimiter } from './prisma-limiter'
import { unlimited } from './ratelimit'
import type { Limiter } from './ratelimit'

const START = Date.parse('2024-01-01T00:00:00Z')
const NS_PER_MS = 1_000_000n
// Mock-time margin used to release pending take() sleeps after the
// simulation ends so the loops can observe the stop flag.
const STOP_ADVANCE_NS = 60_000_000n * NS_PER_MS

interface LimiterOptions {
  slack?: number
  perMs?: number
}

class Runner {
  readonly clock: MockClock
  count = 0
  maxDurationNs = 0n
  private stopped = false
  // Accessed by the module-level runSimulation/flush helpers below.
  errors: Error[] = []
  loops: Promise<void>[] = []
  limiters: PrismaLimiter[] = []
  private readonly keyFor = new Map<Limiter, string>()
  private nextKey = 1

  constructor() {
    this.clock = new MockClock(START)
  }

  createLimiter(rate: number, opts: LimiterOptions = {}, key?: string): PrismaLimiter {
    const limiter = new PrismaLimiter({
      rate,
      clock: this.clock,
      slack: opts.slack,
      perMs: opts.perMs,
    })
    this.limiters.push(limiter)
    this.keyFor.set(limiter, key ?? `test-key-${this.nextKey++}`)
    return limiter
  }

  private take(limiter: Limiter): Promise<Date> {
    const key = this.keyFor.get(limiter)
    if (!key) {
      throw new Error('limiter was not created by this runner')
    }
    return limiter.take(key)
  }

  /** Spawns one loop that takes from the given limiters and increments count. */
  startTaking(...takeLimiters: Limiter[]): void {
    const loop = (async () => {
      try {
        while (!this.stopped) {
          for (const l of takeLimiters) {
            await this.take(l)
          }
          this.count += 1
        }
      } catch (e) {
        this.errors.push(e instanceof Error ? e : new Error(String(e)))
      }
    })()
    this.loops.push(loop)
  }

  /** Takes once at (START + dNs) on the given limiter, incrementing count. */
  takeOnceAfter(dNs: bigint, limiter: Limiter): void {
    this.afterFuncNs(dNs, async () => {
      await this.take(limiter)
      this.count += 1
    })
  }

  /** Asserts the total take count at (START + dMs) mock time. */
  assertCountAt(dMs: number, expected: number): void {
    this.afterFuncNs(BigInt(dMs) * NS_PER_MS, () => {
      if (this.count !== expected) {
        this.errors.push(new Error(`count at ${dMs}ms: expected ${expected}, got ${this.count}`))
      }
    })
  }

  afterFuncNs(dNs: bigint, fn: () => void | Promise<void>): void {
    this.maxDurationNs = this.maxDurationNs > dNs ? this.maxDurationNs : dNs
    this.clock
      .afterNs(dNs)
      .then(fn)
      .catch((e) => {
        this.errors.push(e instanceof Error ? e : new Error(String(e)))
      })
  }

  stop(): void {
    this.stopped = true
  }
}

/** Yields to the event loop until no limiter has in-flight DB work. */
/**
 * Yields to the event loop until no limiter has in-flight DB work.
 *
 * Uses setTimeout(0) rather than setImmediate: in Bun, setImmediate callbacks
 * run without giving the event loop a chance to process pending I/O, so DB
 * responses never arrive; setTimeout(0) yields properly.
 *
 * A generous real-time budget guards against bursty work (e.g. draining 150
 * accumulated-slack slots) when the DB is contended by parallel test forks.
 */
async function flush(runner: Runner): Promise<void> {
  const deadline = Date.now() + 10_000
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (runner.limiters.every((l) => l.inFlight === 0)) {
      return
    }
    if (Date.now() > deadline) {
      return
    }
  }
}

/**
 * Runs a mock-time simulation: fires pending timers in deadline order,
 * flushing the event loop between batches so async take() DB work always
 * completes before the clock advances past it.
 */
async function runSimulation(fn: (r: Runner) => void): Promise<void> {
  const r = new Runner()
  fn(r)

  // Let the initial take() calls complete so their sleep timers are registered
  // before we start stepping the clock (otherwise we'd jump straight to the
  // first assert deadline and corrupt the simulated timeline).
  await flush(r)

  const endNs = BigInt(START) * NS_PER_MS + r.maxDurationNs
  for (;;) {
    const next = r.clock.peekDeadlineNs()
    if (next === undefined || next > endNs) break
    r.clock.advanceToNs(next)
    await flush(r)
  }

  r.stop()
  // Release any pending take() sleeps so the loops observe the stop flag.
  // Repeated in case a continuation registers one more sleep after a flush.
  for (let i = 0; i < 4; i++) {
    r.clock.advanceNs(STOP_ADVANCE_NS)
    await flush(r)
  }
  await Promise.all(r.loops)

  if (r.errors.length > 0) {
    throw new Error(r.errors.map((e) => e.message).join('; '))
  }
}

describe('rate limiting (ported from go.uber.org/ratelimit)', () => {
  setupTestDbHooks()

  it('unlimited limiter never throttles', async () => {
    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      await unlimited.take('any')
    }
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it('limits to the configured rate with no slack', { timeout: 30_000 }, async () => {
    await runSimulation((r) => {
      const rl = r.createLimiter(100, { slack: 0 })
      r.startTaking(rl)
      r.startTaking(rl)
      r.startTaking(rl)
      r.startTaking(rl)

      r.assertCountAt(1000, 100)
      r.assertCountAt(2000, 200)
      r.assertCountAt(3000, 300)
    })
  })

  it(
    'paces a slow and a fast limiter, then releases extra takers',
    { timeout: 60_000 },
    async () => {
      await runSimulation((r) => {
        const slow = r.createLimiter(10, { slack: 0 })
        const fast = r.createLimiter(100, { slack: 0 })

        r.startTaking(slow, fast)

        r.afterFuncNs(20n * 1000n * NS_PER_MS, () => {
          r.startTaking(fast)
          r.startTaking(fast)
          r.startTaking(fast)
          r.startTaking(fast)
        })

        r.assertCountAt(30_000, 1200)
      })
    },
  )

  it('supports custom per windows', { timeout: 60_000 }, async () => {
    await runSimulation((r) => {
      const rl = r.createLimiter(7, { slack: 0, perMs: 60_000 })

      r.startTaking(rl)
      r.startTaking(rl)

      r.assertCountAt(1000, 1)
      r.assertCountAt(60_000, 8)
      r.assertCountAt(120_000, 15)
    })
  })

  it('schedules the initial takes as expected', { timeout: 30_000 }, async () => {
    const variants: Array<{ name: string; slack?: number }> = [
      { name: 'with slack' },
      { name: 'without slack', slack: 0 },
    ]
    for (const variant of variants) {
      let results: Promise<Date>[] = []
      await runSimulation((r) => {
        const rl = r.createLimiter(10, { slack: variant.slack })
        const key = variant.slack === 0 ? 'k-strict' : 'k-slack'
        results = [rl.take(key), rl.take(key), rl.take(key)]
        // Bound the simulation (mirrors the hardcoded Add(time.Second) in Go).
        r.afterFuncNs(1000n * NS_PER_MS, () => {})
      })

      const times = (await Promise.all(results)).map((d) => d.getTime()).sort((a, b) => a - b)
      const deltas = times.map((t, i) => (i === 0 ? t - START : t - times[i - 1]))
      expect(deltas, variant.name).toEqual([0, 100, 100])
    }
  })

  it('caps accumulated slack after an idle period', { timeout: 30_000 }, async () => {
    await runSimulation((r) => {
      const rl = r.createLimiter(1, { slack: 1 })

      r.takeOnceAfter(1n, rl)
      r.takeOnceAfter(2n * 1000n * NS_PER_MS + 1n, rl)
      r.takeOnceAfter(2n * 1000n * NS_PER_MS + 2n, rl)
      r.takeOnceAfter(2n * 1000n * NS_PER_MS + 3n, rl)
      r.takeOnceAfter(2n * 1000n * NS_PER_MS + 4n, rl)

      r.assertCountAt(3000, 3)
      r.assertCountAt(10_000, 5)
    })
  })

  it.each([
    { name: 'no option, defaults to 10', slack: undefined, perMs: undefined, want: 130 },
    { name: 'slack of 10, like default', slack: 10, perMs: undefined, want: 130 },
    { name: 'slack of 20', slack: 20, perMs: undefined, want: 140 },
    { name: 'slack of 150', slack: 150, perMs: undefined, want: 270 },
    { name: 'no option, defaults to 10, with per', slack: undefined, perMs: 500, want: 230 },
    { name: 'slack of 10, like default, with per', slack: 10, perMs: 500, want: 230 },
    { name: 'slack of 20, with per', slack: 20, perMs: 500, want: 240 },
    { name: 'slack of 150, with per', slack: 150, perMs: 500, want: 370 },
  ])('accumulates slack: $name', { timeout: 60_000 }, async ({ slack, perMs, want }) => {
    await runSimulation((r) => {
      const slow = r.createLimiter(10, { slack: 0 })
      const fast = r.createLimiter(100, { slack, perMs })

      r.startTaking(slow, fast)

      r.afterFuncNs(2n * 1000n * NS_PER_MS, () => {
        r.startTaking(fast)
        r.startTaking(fast)
      })

      r.assertCountAt(1000, 10)
      r.assertCountAt(3000, want)
    })
  })

  it(
    'shares state across limiter instances (multi-process correctness)',
    { timeout: 30_000 },
    async () => {
      await runSimulation((r) => {
        const a = r.createLimiter(100, { slack: 0 }, 'shared-key')
        const b = r.createLimiter(100, { slack: 0 }, 'shared-key')

        r.startTaking(a)
        r.startTaking(a)
        r.startTaking(b)
        r.startTaking(b)

        r.assertCountAt(1000, 100)
        r.assertCountAt(2000, 200)
      })
    },
  )
})
