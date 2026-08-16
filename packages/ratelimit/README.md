# @shumai/ratelimit

A distributed leaky-bucket rate limiter backed by Postgres (Prisma),
ported from [go.uber.org/ratelimit](https://github.com/uber-go/ratelimit)
(MIT).

Unlike the in-memory Go original, the limiter state
(`nextPermissionTimeNanos`) lives in the `RateLimitState` table, so the
limiter is correct across processes/instances and survives restarts and
redeploys: a new instance simply continues from the persisted next-permission
time instead of starting over.

## Usage

```ts
import { PrismaLimiter } from '@shumai/ratelimit'

// 100 requests per second, default slack (burst) of 10.
const limiter = new PrismaLimiter({ rate: 100 })

// Blocking: sleeps until a slot is available (client-side throttling).
const at = await limiter.take('user:42:upload')

// Non-blocking: consumes a slot and reports whether it was granted
// (server-side 429 + Retry-After style checks).
const result = await limiter.allow('user:42:upload')
if (!result.allowed) {
  // respond 429 with Retry-After: result.retryAfterMs
}
```

## Configuration

| Option  | Default | Description                                                          |
| ------- | ------- | -------------------------------------------------------------------- |
| `rate`  | —       | Max requests per `perMs` window (>= 1).                              |
| `perMs` | `1000`  | Window in ms (e.g. `60_000` for per-minute limits).                  |
| `slack` | `10`    | Burst credit accumulated while idle, in units of one request window. `0` = strict pacing. |
| `clock` | `systemClock` | Time source (use `MockClock` in tests; see below).            |

`take(key)` and `allow(key)` accept an arbitrary key, so one limiter instance
can rate-limit many subjects (users, IPs, routes). Keys are independent.

## Persistence & time

- **State** (`RateLimitState.nextPermissionTimeNanos`) is a nullable `BigInt`
  column holding the unix-nanos timestamp of the next permitted request —
  `null` means "uninitialized". Each `take`/`allow` performs an atomic
  conditional update (`UPDATE ... WHERE key AND next_permission_time_nanos =
  expected`) and retries on lost races, mirroring the CAS loop of the Go
  atomic implementation. No long-lived transactions.
- **Clock**: the default `systemClock` uses the Bun/Node runtime. Because
  state is in Postgres, restarts/redeploys are safe. If you run multiple
  instances whose wall clocks are not NTP-synced, provide a `Clock` whose
  `nowNanos()` reads the database time so all instances agree on one source.
- **Sleep** is always local (`take()` is a blocking API; `allow()` never
  sleeps).

## Row lifecycle

Rows are created lazily on first use and never deleted automatically. For
high-cardinality keys, plan a periodic sweep (delete rows unused for N days)
if the table grows.

## Tests

- `clock.test.ts` — MockClock unit tests.
- `ratelimit.test.ts` — the full Go test suite ported verbatim to a
  deterministic mock-time runner (TestRateLimiter, TestDelayedRateLimiter,
  TestPer, TestInitial, TestMaxSlack, TestSlack matrix), plus a
  multi-instance shared-state test.
- `prisma-limiter.test.ts` — consume semantics, CAS contention, burst caps,
  redeploy persistence, validation.
