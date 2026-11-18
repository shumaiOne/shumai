import { Pool } from 'pg'

const locks = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 })

/** A session lock uses a dedicated connection, never a long-running application transaction. */
export async function acquireAdvisoryLock(key: string, signal?: AbortSignal) {
  const client = await locks.connect()
  const lost = new AbortController()
  const onError = (error: Error) => lost.abort(error)
  client.on('error', onError)
  try {
    while (true) {
      signal?.throwIfAborted()
      lost.signal.throwIfAborted()
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
        [key],
      )
      if (result.rows[0]?.acquired) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch (error) {
    client.release(true)
    throw error
  }
  let released = false
  return {
    signal: lost.signal,
    async release() {
      if (released) return
      released = true
      client.off('error', onError)
      try {
        if (!lost.signal.aborted)
          await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key])
      } finally {
        client.release(lost.signal.aborted)
      }
    },
  }
}

/** Hold a shared server lease, with a non-blocking upgrade to exclusive ownership. */
export async function tryAcquireUpgradeableAdvisoryLock(key: string, exclusive: boolean) {
  const client = await locks.connect()
  const lost = new AbortController()
  const onError = (error: Error) => lost.abort(error)
  client.on('error', onError)

  const tryExclusive = async () => {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
      [key],
    )
    return result.rows[0]?.acquired === true
  }
  let acquired = false
  try {
    if (exclusive && !(await tryExclusive())) return null
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock_shared(hashtextextended($1, 0)) AS acquired',
      [key],
    )
    lost.signal.throwIfAborted()
    acquired = result.rows[0]?.acquired === true
    if (!acquired) return null
  } finally {
    if (!acquired) {
      client.off('error', onError)
      client.release(true)
    }
  }

  let released = false
  const assertHeld = () => {
    if (released) throw new Error('The server lease has been released')
    lost.signal.throwIfAborted()
  }
  return {
    signal: lost.signal,
    get exclusive() {
      return exclusive
    },
    async tryUpgrade() {
      assertHeld()
      if (!exclusive) exclusive = await tryExclusive()
      return exclusive
    },
    async downgrade() {
      assertHeld()
      if (!exclusive) return
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key])
      exclusive = false
    },
    async release() {
      if (released) return
      released = true
      try {
        if (!lost.signal.aborted) await client.query('SELECT pg_advisory_unlock_all()')
      } finally {
        client.off('error', onError)
        client.release(true)
      }
    },
  }
}
