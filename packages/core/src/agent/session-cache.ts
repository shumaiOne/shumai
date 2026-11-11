import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import type { Seq, StorageWrite } from '@earendil-works/pi-durable'
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node'
import { prisma } from '@shumai/db'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Process-owned copies prevent an API replica from replacing a live writer's SQLite files.
const instance = randomUUID()
const root = join(
  process.env.AGENT_SESSION_CACHE_DIR || join(tmpdir(), 'shumai-sessions'),
  instance,
)

export async function openSessionCache(sessionId: string, mode: 'read' | 'write') {
  const directory = join(root, mode, encodeURIComponent(sessionId))
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, 'session.sqlite')
  const marker = join(directory, 'sync.json')
  const latest = await prisma.agentSessionCommit.findFirst({
    where: { sessionId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  })
  const head = Number(latest?.seq ?? 0)
  if (!Number.isSafeInteger(head))
    throw new Error('Session commit sequence exceeds the supported range')
  let seq = 0
  let reusable = false
  try {
    if (!(await stat(path)).isFile()) throw new Error('SQLite cache missing')
    const value: unknown = JSON.parse(await readFile(marker, 'utf8'))
    if (
      value &&
      typeof value === 'object' &&
      'seq' in value &&
      typeof value.seq === 'number' &&
      'clean' in value &&
      value.clean === true &&
      value.seq <= head
    ) {
      seq = value.seq
      reusable = true
    }
  } catch {
    /* A missing/uncertain marker requires rebuilding the disposable copy. */
  }
  const save = async (clean: boolean) => {
    await writeFile(`${marker}.tmp`, JSON.stringify({ clean, seq }), { mode: 0o600 })
    await rename(`${marker}.tmp`, marker)
  }
  const remove = async () => {
    for (const suffix of ['', '-wal', '-shm']) await rm(`${path}${suffix}`, { force: true })
    seq = 0
  }
  if (!reusable) await remove()
  let storage
  try {
    storage = await openNodeSqliteStorage(path)
  } catch (error) {
    if (!reusable) throw error
    await remove()
    storage = await openNodeSqliteStorage(path)
  }
  try {
    await save(false)
    while (seq < head) {
      const commits = await prisma.agentSessionCommit.findMany({
        where: { sessionId, seq: { gt: BigInt(seq), lte: BigInt(head) } },
        orderBy: { seq: 'asc' },
        take: 100,
      })
      if (commits.length === 0) throw new Error(`Session ${sessionId} has a commit gap`)
      const writes = commits.map(({ data }) => {
        if (data.version !== 1 || !Array.isArray(data.writes))
          throw new Error('Unsupported session commit format')
        return data.writes as unknown as StorageWrite[]
      })
      const receipts: Array<{ index: number; seq: Seq }> = []
      const result = await storage.commit(
        writes,
        (index, storedSeq) => {
          receipts.push({ index, seq: storedSeq })
        },
        BACKGROUND_CONTEXT,
      )
      for (const receipt of receipts) {
        if (Number(commits[receipt.index].seq) !== receipt.seq)
          throw new Error('Session commit sequence mismatch')
        seq = receipt.seq
      }
      if (result.stored !== commits.length)
        throw result.refused ?? new Error('Session restoration refused')
    }
    await save(true)
  } catch (error) {
    await storage.close(BACKGROUND_CONTEXT)
    throw error
  }
  return {
    storage,
    seq,
    path,
    dirty: () => save(false),
    clean: async (next?: Seq) => {
      if (next !== undefined) seq = next
      await save(true)
    },
  }
}

export async function removeSessionCaches() {
  await rm(root, { recursive: true, force: true })
}
