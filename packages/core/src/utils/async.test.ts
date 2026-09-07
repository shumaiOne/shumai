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
})
