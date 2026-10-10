import { describe, expect, it, vi } from 'vitest'
import { JobQueue } from './job-queue'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('JobQueue', () => {
  it('never runs more jobs at once than the concurrency limit', async () => {
    const queue = new JobQueue({ concurrency: 2 })
    let active = 0
    let peak = 0
    for (let i = 0; i < 8; i++) {
      queue.enqueue(`job-${i}`, async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 5))
        active--
      })
    }
    await queue.idle()
    expect(peak).toBe(2)
    expect(queue.size).toBe(0)
  })

  it('reports a failing job through onError and keeps going', async () => {
    const onError = vi.fn()
    const queue = new JobQueue({ concurrency: 1, onError })
    const ran: string[] = []
    queue.enqueue('bad', async () => {
      throw new Error('boom')
    })
    queue.enqueue('good', async () => {
      ran.push('good')
    })
    await queue.idle()
    expect(ran).toEqual(['good'])
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), 'bad')
  })

  it('survives a job that throws synchronously and an error handler that throws', async () => {
    const queue = new JobQueue({
      concurrency: 1,
      onError: () => {
        throw new Error('handler failed')
      },
    })
    const ran = vi.fn()
    queue.enqueue('sync-throw', () => {
      throw new Error('sync')
    })
    queue.enqueue('after', async () => ran())
    await queue.idle()
    expect(ran).toHaveBeenCalledTimes(1)
  })

  it('shutdown waits for running jobs, drops waiting ones and refuses new ones', async () => {
    const queue = new JobQueue({ concurrency: 1 })
    const gate = deferred()
    const started: string[] = []
    queue.enqueue('running', async () => {
      started.push('running')
      await gate.promise
    })
    queue.enqueue('waiting', async () => {
      started.push('waiting')
    })

    const done = queue.shutdown(5000)
    gate.resolve()
    expect(await done).toEqual({ dropped: 1, timedOut: false })
    expect(started).toEqual(['running'])
    expect(queue.enqueue('late', async () => {})).toBe(false)
  })

  it('shutdown gives up after the timeout when a job hangs', async () => {
    const queue = new JobQueue({ concurrency: 1 })
    queue.enqueue('hangs', () => new Promise<void>(() => {}))
    const result = await queue.shutdown(20)
    expect(result.timedOut).toBe(true)
  })

  it('treats a bad concurrency as 1', async () => {
    const queue = new JobQueue({ concurrency: 0 })
    let active = 0
    let peak = 0
    for (let i = 0; i < 3; i++) {
      queue.enqueue('j', async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 2))
        active--
      })
    }
    await queue.idle()
    expect(peak).toBe(1)
  })
})
