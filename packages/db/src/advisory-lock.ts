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
