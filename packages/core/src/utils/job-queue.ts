/**
 * A small in-process queue that runs at most `concurrency` jobs at once. Jobs are fire-and-forget: a job that
 * throws is reported through `onError` and never rejects anything, so one failure cannot affect the caller or
 * the other jobs. `shutdown` lets a process stop without cutting running jobs off mid-way.
 */
export interface JobQueueOptions {
  concurrency: number
  onError?: (err: unknown, name: string) => void
}

export class JobQueue {
  private readonly concurrency: number
  private readonly onError: (err: unknown, name: string) => void
  private readonly waiting: { name: string; job: () => Promise<void> }[] = []
  private running = 0
  private closed = false
  private idleWaiters: (() => void)[] = []

  constructor(options: JobQueueOptions) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency) || 1)
    this.onError = options.onError ?? (() => {})
  }

  /** Jobs running or waiting. */
  get size(): number {
    return this.running + this.waiting.length
  }

  /** Queues a job. Ignored (returns false) once the queue is shut down. */
  enqueue(name: string, job: () => Promise<void>): boolean {
    if (this.closed) return false
    this.waiting.push({ name, job })
    this.pump()
    return true
  }

  /** Resolves when nothing is running or waiting. */
  idle(): Promise<void> {
    if (this.size === 0) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  /**
   * Stops accepting jobs, drops the ones that have not started (they simply stay unprocessed) and waits for
   * the running ones, for at most `timeoutMs`.
   */
  async shutdown(timeoutMs: number): Promise<{ dropped: number; timedOut: boolean }> {
    this.closed = true
    const dropped = this.waiting.length
    this.waiting.length = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = await Promise.race([
      this.idle().then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), timeoutMs)
      }),
    ])
    clearTimeout(timer)
    return { dropped, timedOut }
  }

  private pump() {
    while (this.running < this.concurrency && this.waiting.length > 0) {
      const { name, job } = this.waiting.shift()!
      this.running++
      void Promise.resolve()
        .then(job)
        .catch((err: unknown) => {
          try {
            this.onError(err, name)
          } catch {
            // an error handler must never break the queue
          }
        })
        .finally(() => {
          this.running--
          this.pump()
          if (this.size === 0) {
            const waiters = this.idleWaiters
            this.idleWaiters = []
            for (const resolve of waiters) resolve()
          }
        })
    }
  }
}
