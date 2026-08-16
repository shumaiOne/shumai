// Prisma-backed leaky-bucket rate limiter.
//
// Port of the atomic_int64 implementation from go.uber.org/ratelimit (MIT).
// The original stores a single int64 (`timeOfNextPermissionIssue`, unix
// nanoseconds) in memory and uses an atomic compare-and-swap loop. We store
// that same single value in Postgres and replace the CAS with an atomic
// conditional UPDATE (updateMany ... WHERE key AND nextPermissionTimeNanos =
// expected), retrying on lost races. This makes the limiter correct across
// processes and instances, and state survives restarts/redeploys.

import { prisma } from '@shumai/db'
import { systemClock } from './clock'
import type { Clock } from './clock'
import { DEFAULT_PER_MS, DEFAULT_SLACK } from './ratelimit'
import type { AllowResult, Limiter, RateLimitConfig } from './ratelimit'

const NS_PER_MS = 1_000_000n

export class PrismaLimiter implements Limiter {
  private readonly perRequestNanos: bigint
  private readonly maxSlackNanos: bigint
  private readonly clock: Clock
  private pendingDbOps = 0

  /**
   * Number of in-flight database operations (each take/allow performs a
   * read + conditional update). Useful for tests and observability.
   */
  get inFlight(): number {
    return this.pendingDbOps
  }

  constructor(config: RateLimitConfig) {
    const { rate, perMs = DEFAULT_PER_MS, slack = DEFAULT_SLACK, clock } = config
    if (!Number.isInteger(rate) || rate < 1) {
      throw new Error('rate must be a positive integer')
    }
    if (!Number.isInteger(perMs) || perMs < 1) {
      throw new Error('perMs must be a positive integer')
    }
    if (!Number.isInteger(slack) || slack < 0) {
      throw new Error('slack must be a non-negative integer')
    }
    this.perRequestNanos = (BigInt(perMs) * NS_PER_MS) / BigInt(rate)
    this.maxSlackNanos = BigInt(slack) * this.perRequestNanos
    this.clock = clock ?? systemClock
  }

  async take(key: string): Promise<Date> {
    const next = await this.computeNextPermission(key)
    const now = this.clock.nowNanos()
    const sleepNanos = next - now
    if (sleepNanos > 0n) {
      await this.clock.sleep(sleepNanos)
      return new Date(Number(next / NS_PER_MS))
    }
    return new Date(Number(now / NS_PER_MS))
  }

  async allow(key: string): Promise<AllowResult> {
    const next = await this.computeNextPermission(key)
    const now = this.clock.nowNanos()
    const waitNanos = next - now
    if (waitNanos > 0n) {
      return { allowed: false, retryAfterMs: Math.max(1, Number(waitNanos / NS_PER_MS)) }
    }
    return { allowed: true, retryAfterMs: 0 }
  }

  /**
   * Single-flight CAS loop mirroring the atomic loop of the Go int64 limiter:
   *
   *   if state is uninitialized:                     next = now
   *   elif strict && now - state > perRequest:       next = now          (reset)
   *   elif now - state > maxSlack + perRequest:      next = now - maxSlack (burst cap)
   *   else:                                          next = state + perRequest
   *
   * Each attempt atomically claims the transition with a conditional UPDATE;
   * a count of 0 means another caller won the race and we re-read and retry.
   */
  private async computeNextPermission(key: string): Promise<bigint> {
    this.pendingDbOps += 1
    try {
      for (;;) {
        const now = this.clock.nowNanos()
        const row = await prisma.rateLimitState.findUnique({ where: { key } })

        if (!row) {
          // Lazily create the row as "uninitialized" (null). Upsert is atomic
          // and race-free: concurrent creators for the same key collapse into
          // one row without erroring, then we simply re-read.
          await prisma.rateLimitState.upsert({
            where: { key },
            create: { key, nextPermissionTimeNanos: null },
            update: {},
          })
          continue
        }

        const current = row.nextPermissionTimeNanos
        let next: bigint
        if (current === null) {
          next = now
        } else if (this.maxSlackNanos === 0n && now - current > this.perRequestNanos) {
          next = now
        } else if (
          this.maxSlackNanos > 0n &&
          now - current > this.maxSlackNanos + this.perRequestNanos
        ) {
          next = now - this.maxSlackNanos
        } else {
          next = current + this.perRequestNanos
        }

        const result = await prisma.rateLimitState.updateMany({
          where: { key, nextPermissionTimeNanos: current },
          data: { nextPermissionTimeNanos: next },
        })
        if (result.count === 1) {
          return next
        }
        // Lost the race (state changed underneath us) — re-read and retry.
      }
    } finally {
      this.pendingDbOps -= 1
    }
  }
}
