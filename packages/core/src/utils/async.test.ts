import { describe, it, expect } from 'vitest'
import { mapConcurrent } from './async'

describe('mapConcurrent', () => {
  it('should process items and preserve original ordering', async () => {
    const items = [10, 20, 30, 40, 50]
    const results = await mapConcurrent(items, 2, async (item, idx) => {
      return item * 2 + idx
    })

    expect(results).toEqual([20, 41, 62, 83, 104])
  })

  it('should respect concurrency limits', async () => {
    let running = 0
    let maxRunning = 0
    const items = Array.from({ length: 20 }, (_, i) => i)

    const results = await mapConcurrent(items, 4, async (item) => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 10))
      running--
      return item * 2
    })

    expect(results).toHaveLength(20)
    expect(maxRunning).toBeLessThanOrEqual(4)
    expect(maxRunning).toBeGreaterThan(1)
  })

  it('should handle empty input array', async () => {
    const results = await mapConcurrent([], 5, async () => 1)
    expect(results).toEqual([])
  })

  it('should wait for all in-flight tasks to settle and not start queued tasks on error', async () => {
    let task1Settled = false
    let task2Started = false

    const items = [0, 1, 2]
    // concurrency 2: items 0 and 1 start immediately. Item 2 is queued.
    await expect(
      mapConcurrent(items, 2, async (item) => {
        if (item === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          throw new Error('Task 0 failed')
        }
        if (item === 1) {
          await new Promise((resolve) => setTimeout(resolve, 30))
          task1Settled = true
          return 'ok-1'
        }
        task2Started = true
        return 'ok-2'
      }),
    ).rejects.toThrow('Task 0 failed')

    expect(task1Settled).toBe(true)
    expect(task2Started).toBe(false)
  })

  it('should rethrow the first encountered error when multiple concurrent workers fail', async () => {
    let task1Settled = false

    const items = [0, 1]
    await expect(
      mapConcurrent(items, 2, async (item) => {
        if (item === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          throw new Error('First error')
        }
        await new Promise((resolve) => setTimeout(resolve, 30))
        task1Settled = true
        throw new Error('Second error')
      }),
    ).rejects.toThrow('First error')

    expect(task1Settled).toBe(true)
  })
})
