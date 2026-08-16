import { describe, expect, it } from 'vitest'
import { MockClock } from './clock'

const START = Date.parse('2024-01-01T00:00:00Z')
const NS_PER_MS = 1_000_000n

/** Runs pending microtasks/macrotasks so resolved promises' continuations run. */
async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('MockClock', () => {
  it('reports the configured start time', () => {
    const clock = new MockClock(START)
    expect(clock.nowNanos()).toBe(BigInt(START) * NS_PER_MS)
    expect(clock.now().getTime()).toBe(START)
  })

  it('sleep resolves once the clock advances past the deadline', async () => {
    const clock = new MockClock(START)
    let resolved = false
    clock.sleep(100n * NS_PER_MS).then(() => {
      resolved = true
    })
    await tick()
    expect(resolved).toBe(false)

    clock.advance(99)
    await tick()
    expect(resolved).toBe(false)

    clock.advance(1)
    await tick()
    expect(resolved).toBe(true)
  })

  it('sleep resolves exactly on the deadline', async () => {
    const clock = new MockClock(START)
    let resolved = false
    clock.sleep(100n * NS_PER_MS).then(() => {
      resolved = true
    })
    clock.advance(100)
    await tick()
    expect(resolved).toBe(true)
  })

  it('afterNs is an alias of sleep', async () => {
    const clock = new MockClock(START)
    let resolved = false
    clock.afterNs(50n * NS_PER_MS).then(() => {
      resolved = true
    })
    clock.advanceToNs(BigInt(START) * NS_PER_MS + 50n * NS_PER_MS)
    await tick()
    expect(resolved).toBe(true)
  })

  it('fires multiple timers in deadline order', async () => {
    const clock = new MockClock(START)
    const order: string[] = []
    clock.sleep(200n * NS_PER_MS).then(() => order.push('b'))
    clock.sleep(100n * NS_PER_MS).then(() => order.push('a'))
    clock.sleep(300n * NS_PER_MS).then(() => order.push('c'))

    clock.advance(300)
    await tick()
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('keeps timers beyond the current time pending', async () => {
    const clock = new MockClock(START)
    let resolved = false
    clock.sleep(1000n * NS_PER_MS).then(() => {
      resolved = true
    })
    clock.advance(100)
    await tick()
    expect(resolved).toBe(false)
    expect(clock.peekDeadlineNs()).toBe(BigInt(START) * NS_PER_MS + 1000n * NS_PER_MS)
    expect(clock.pendingCount()).toBe(1)
  })

  it('peekDeadlineNs returns undefined when idle', () => {
    const clock = new MockClock(START)
    expect(clock.peekDeadlineNs()).toBeUndefined()
    expect(clock.pendingCount()).toBe(0)
  })

  it('does not move backwards', () => {
    const clock = new MockClock(START)
    clock.advance(100)
    expect(() => clock.setTime(START)).toThrow()
  })
})
