import { HTTPException } from 'hono/http-exception'
import { prisma } from '@shumai/db'
import { tryAcquireUpgradeableAdvisoryLock } from '@shumai/db/src/advisory-lock'
import { logger } from '@shumai/core/src/logger'

const RUNNER_TOPOLOGY_KEY = 'shumai:runner-topology'
const SINGLE_SERVER_REQUIRED =
  'Agent runners require a single main Shumai server per database. Stop the other main server replicas.'

async function hasConfiguredRunners() {
  return (await prisma.runner.findFirst({ select: { id: true } })) !== null
}

/** Each main server holds a shared lease. A configured runner requires an exclusive lease. */
export class RunnerTopology {
  private mutations = Promise.resolve()

  private constructor(
    private readonly lease: NonNullable<
      Awaited<ReturnType<typeof tryAcquireUpgradeableAdvisoryLock>>
    >,
  ) {}

  static async start() {
    const configured = await hasConfiguredRunners()
    let lease = await tryAcquireUpgradeableAdvisoryLock(RUNNER_TOPOLOGY_KEY, configured)
    if (!lease && configured) {
      // If the last runner was just deleted, the incumbent may now hold a shared lease.
      lease = await tryAcquireUpgradeableAdvisoryLock(RUNNER_TOPOLOGY_KEY, false)
    }
    if (!lease) throw new Error(SINGLE_SERVER_REQUIRED)
    try {
      // A concurrently stopping server may have changed the catalog.
      if (await hasConfiguredRunners()) {
        if (!(await lease.tryUpgrade())) throw new Error(SINGLE_SERVER_REQUIRED)
      } else {
        await lease.downgrade()
      }
      return new RunnerTopology(lease)
    } catch (error) {
      await lease.release()
      throw error
    }
  }

  get signal() {
    return this.lease.signal
  }

  /** Serialize runner creation and deletion until the exclusive lease can be safely downgraded. */
  async changeRunners<T>(operation: () => Promise<T>, adding = false): Promise<T> {
    const previous = this.mutations
    const finished = Promise.withResolvers<void>()
    this.mutations = finished.promise
    await previous
    try {
      if (adding && !(await this.lease.tryUpgrade())) {
        throw new HTTPException(409, { message: SINGLE_SERVER_REQUIRED })
      }
      return await operation()
    } finally {
      try {
        if (this.lease.exclusive && !(await hasConfiguredRunners())) await this.lease.downgrade()
      } catch (error) {
        logger.warn({ err: error }, 'Failed to downgrade the runner server lease')
      } finally {
        finished.resolve()
      }
    }
  }

  async close() {
    await this.mutations
    await this.lease.release()
  }
}
