import type { Context } from '@earendil-works/chord/context'
import type {
  ConversationId,
  EntryId,
  Seq,
  Storage,
  StorageWrite,
} from '@earendil-works/pi-durable'
import { compactSessionWrites, hydrateEntry } from './session-content'

export interface CommitReceipt {
  seq: Seq
  writes: readonly StorageWrite[]
}

/** Decorate the native instance; every query and ID rule remains implemented by Pi. */
export function synchronizeStorage(
  storage: Storage,
  callbacks: {
    dirty(): Promise<void>
    persist(commits: readonly CommitReceipt[]): Promise<void>
    clean(seq?: Seq): Promise<void>
  },
): Storage {
  const commit = storage.commit.bind(storage)
  storage.commit = async (batches, receive, context) => {
    await callbacks.dirty()
    const compact = batches.map(compactSessionWrites)
    const receipts: Array<{ index: number; seq: Seq }> = []
    const result = await commit(compact, (index, seq) => receipts.push({ index, seq }), context)
    await callbacks.persist(receipts.map(({ index, seq }) => ({ seq, writes: compact[index] })))
    await callbacks.clean(receipts.at(-1)?.seq)
    for (const { index, seq } of receipts) receive(index, seq)
    return result
  }
  return storage
}

/** Runtime reads hydrate detached entries; API reads use the compact native instance. */
export function hydrateStorage(storage: Storage): Storage {
  const entry = storage.entry.bind(storage)
  const scan = storage.scanEntries.bind(storage)
  const head = storage.findLatestHeadMarker.bind(storage)
  storage.entry = (async (
    first: EntryId | ConversationId,
    second: EntryId | Context,
    third?: Context,
  ) => {
    const record =
      third === undefined
        ? await entry(first as EntryId, second as Context)
        : await entry(first as ConversationId, second as EntryId, third)
    return record ? { ...record, entry: await hydrateEntry(record.entry) } : undefined
  }) as Storage['entry']
  storage.scanEntries = async (...args) => {
    const page = await scan(...args)
    return { ...page, items: await Promise.all(page.items.map(hydrateEntry)) }
  }
  storage.findLatestHeadMarker = async (...args) => {
    const found = await head(...args)
    return found ? { ...(await hydrateEntry(found)), head: found.head } : undefined
  }
  return storage
}
