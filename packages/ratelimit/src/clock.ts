// Clock abstraction ported from go.uber.org/ratelimit (MIT).
//
// The limiter needs two time services:
//   - nowNanos: the authoritative "current time" used by the algorithm. The
//     default systemClock uses the Bun/Node runtime clock. State itself is
//     persisted in Postgres, so a server restart/redeploy does NOT reset the
//     limiter — the new process simply reads the stored next-permission time
//     and continues from there.
//   - sleep: used only by the blocking take() variant. Always local.
//
// For tests, use MockClock to drive time deterministically. If you ever run
// multiple instances whose wall clocks are not NTP-synced, provide a Clock
// whose nowNanos() reads the database time (e.g. SELECT now()) so all
// instances agree on a single time source.

export interface Clock {
  /** Current time in unix nanoseconds (bigint to match DB precision). */
  nowNanos(): bigint
  /** Sleeps for at least the given number of nanoseconds. */
  sleep(nanos: bigint): Promise<void>
}

const NS_PER_MS = 1_000_000n

/** Default clock backed by the Bun/Node runtime (Date.now + setTimeout). */
export const systemClock: Clock = {
  nowNanos: () => BigInt(Date.now()) * NS_PER_MS,
  sleep: (nanos) =>
    new Promise((resolve) => {
      // Round up so we never sleep less than requested (ms resolution).
      const ms = Math.max(1, Math.ceil(Number(nanos) / Number(NS_PER_MS)))
      setTimeout(resolve, ms)
    }),
}

interface TimerEntry {
  atNs: bigint
  resolve: () => void
}

/**
 * Deterministic in-memory clock for tests, mirroring the behavior of
 * benbjohnson/clock used by the original Go implementation: time only
 * advances when advance()/advanceToNs() is called, and pending sleep()
 * promises resolve in deadline order. All arithmetic is nanosecond-exact.
 */
export class MockClock implements Clock {
  private nowNs: bigint
  private timers: TimerEntry[] = []

  constructor(startTimeMs: number = Date.parse('2024-01-01T00:00:00Z')) {
    this.nowNs = BigInt(startTimeMs) * NS_PER_MS
  }

  nowNanos(): bigint {
    return this.nowNs
  }

  /** Returns the current mock time as a Date (ms precision). */
  now(): Date {
    return new Date(Number(this.nowNs / NS_PER_MS))
  }

  setTime(timeMs: number): void {
    this.advanceToNs(BigInt(timeMs) * NS_PER_MS)
  }

  advance(ms: number): void {
    this.advanceNs(BigInt(ms) * NS_PER_MS)
  }

  advanceNs(deltaNs: bigint): void {
    this.advanceToNs(this.nowNs + deltaNs)
  }

  /** Moves the clock to the given absolute ns timestamp (must be >= now). */
  advanceToNs(targetNs: bigint): void {
    if (targetNs < this.nowNs) {
      throw new Error('MockClock cannot move backwards')
    }
    this.nowNs = targetNs
    this.fireDue()
  }

  /** Earliest pending timer deadline in ns, or undefined when idle. */
  peekDeadlineNs(): bigint | undefined {
    let earliest: bigint | undefined
    for (const t of this.timers) {
      if (earliest === undefined || t.atNs < earliest) earliest = t.atNs
    }
    return earliest
  }

  /** Number of pending timers (used by the test harness to detect quiescence). */
  pendingCount(): number {
    return this.timers.length
  }

  sleep(nanos: bigint): Promise<void> {
    return new Promise((resolve) => {
      this.timers.push({ atNs: this.nowNs + nanos, resolve })
    })
  }

  /** Alias of sleep(); mirrors clock.Mock.After in the Go tests. */
  afterNs(nanos: bigint): Promise<void> {
    return this.sleep(nanos)
  }

  private fireDue(): void {
    const due = this.timers
      .filter((t) => t.atNs <= this.nowNs)
      .sort((a, b) => (a.atNs < b.atNs ? -1 : a.atNs > b.atNs ? 1 : 0))
    if (due.length === 0) return
    this.timers = this.timers.filter((t) => t.atNs > this.nowNs)
    for (const t of due) t.resolve()
  }
}
