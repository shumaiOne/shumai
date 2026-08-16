// Config, options and shared types ported from go.uber.org/ratelimit (MIT).
//
// The Go package exposes functional options (WithSlack, WithoutSlack, Per);
// we express the same knobs as a plain config object instead.

import type { Clock } from './clock'

export const DEFAULT_PER_MS = 1000
export const DEFAULT_SLACK = 10

export interface AllowResult {
  allowed: boolean
  /** Time to wait before the next attempt, in milliseconds (0 when allowed). */
  retryAfterMs: number
}

export interface Limiter {
  /**
   * Blocks (sleeps) until a slot is available for the given key and returns
   * the time at which the request is permitted to proceed.
   */
  take(key: string): Promise<Date>
  /**
   * Non-blocking variant of take(). Consumes a slot and reports whether the
   * request is granted within the current window. When rejected, retryAfterMs
   * indicates how long the caller should wait (e.g. for a 429 + Retry-After).
   */
  allow(key: string): Promise<AllowResult>
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed per `perMs` window. Must be >= 1. */
  rate: number
  /** Window in milliseconds (default 1000, i.e. requests per second). */
  perMs?: number
  /**
   * Accumulated "unspent" capacity allowed for bursts after an idle period,
   * in units of one request window (default 10). 0 disables bursts entirely
   * (strict pacing).
   */
  slack?: number
  /** Clock used for time (default systemClock; use MockClock in tests). */
  clock?: Clock
}

/** A limiter that never throttles. */
class UnlimitedLimiter implements Limiter {
  async take(): Promise<Date> {
    return new Date()
  }

  async allow(): Promise<AllowResult> {
    return { allowed: true, retryAfterMs: 0 }
  }
}

export const unlimited: Limiter = new UnlimitedLimiter()
