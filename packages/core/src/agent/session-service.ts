import { BACKGROUND_CONTEXT, type Context } from '@earendil-works/chord/context'
import {
  ROOT_CONVERSATION_ID,
  type Cursor,
  type EntryId,
  type EntryRecord,
  type Storage,
  type UsageState,
} from '@earendil-works/pi-durable'
import { prisma, type Prisma, type TeamMemberRole } from '@shumai/db'
import { acquireAdvisoryLock } from '@shumai/db/src/advisory-lock'
import { AiUsageService } from '../ai-usage/ai-usage'
import { quotaService } from '../quota/quota-service'
import { openSessionCache, removeSessionCaches } from './session-cache'
import { hydrateStorage, synchronizeStorage, type CommitReceipt } from './session-storage'

type UsageOwner = { teamId: string; userId?: string; role?: TeamMemberRole | null }

export async function readSessionUsage(storage: Storage): Promise<PrismaJson.AgentSessionUsage> {
  const doc = await storage.findDocument(
    { kind: 'pi.usage', scope: { kind: 'conversation', conversationId: ROOT_CONVERSATION_ID } },
    'current',
    BACKGROUND_CONTEXT,
  )
  const stored = doc ? await storage.document(doc.id, 'current', BACKGROUND_CONTEXT) : undefined
  const state = stored?.value as unknown as UsageState | undefined
  const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, totalTokens: 0, cost: 0 }
  for (const usage of Object.values(state?.models ?? {})) {
    totals.inputTokens += usage.input
    totals.outputTokens += usage.output
    totals.cacheReadTokens += usage.cacheRead
    totals.totalTokens += usage.totalTokens
    totals.cost += usage.cost.total
  }
  return totals
}

export class AgentSessionService {
  private readonly readers = new Map<string, Promise<unknown>>()
  private readonly writers = new Set<Storage>()

  async openWriter(sessionId: string, context: Context = BACKGROUND_CONTEXT, owner?: UsageOwner) {
    const lock = await acquireAdvisoryLock(`agent-session:${sessionId}`, context.abortSignal)
    let storage: Storage | undefined
    try {
      const session = await prisma.agentSession.update({
        where: { id: sessionId },
        data: { writerVersion: { increment: 1 } },
      })
      const cache = await openSessionCache(sessionId, 'write')
      let head = cache.seq
      storage = hydrateStorage(
        synchronizeStorage(cache.storage, {
          dirty: cache.dirty,
          clean: cache.clean,
          persist: async (commits: readonly CommitReceipt[]) => {
            lock.signal.throwIfAborted()
            if (!commits.length) return
            await prisma.$transaction(async (tx) => {
              const rows = await tx.$queryRaw<
                Array<{ writerVersion: number }>
              >`SELECT writer_version AS "writerVersion" FROM agent_sessions WHERE id = ${sessionId} FOR UPDATE`
              if (rows[0]?.writerVersion !== session.writerVersion)
                throw new Error('Session writer ownership was lost')
              const latest = await tx.agentSessionCommit.findFirst({
                where: { sessionId },
                orderBy: { seq: 'desc' },
                select: { seq: true },
              })
              if (Number(latest?.seq ?? 0) !== head)
                throw new Error('Session changed while writing')
              if (owner)
                await this.recordUsage(sessionId, await readSessionUsage(cache.storage), owner, tx)
              await tx.agentSessionCommit.createMany({
                data: commits.map(({ seq, writes }) => ({
                  sessionId,
                  seq: BigInt(seq),
                  data: JSON.parse(
                    JSON.stringify({ version: 1, writes }),
                  ) as PrismaJson.AgentSessionCommitData,
                })),
              })
            })
            head = commits[commits.length - 1].seq
          },
        }),
      )
      const close = storage.close.bind(storage)
      let closed = false
      const owned = storage
      owned.close = async (context) => {
        if (closed) return
        closed = true
        this.writers.delete(owned)
        try {
          await close(context)
        } finally {
          await lock.release()
        }
      }
      this.writers.add(owned)
      return { storage: owned, signal: lock.signal }
    } catch (error) {
      try {
        await storage?.close(BACKGROUND_CONTEXT)
      } finally {
        await lock.release()
      }
      throw error
    }
  }

  async withWriter<T>(
    sessionId: string,
    use: (storage: Storage, signal: AbortSignal) => Promise<T>,
    context: Context = BACKGROUND_CONTEXT,
  ): Promise<T> {
    const opened = await this.openWriter(sessionId, context)
    try {
      return await use(opened.storage, opened.signal)
    } finally {
      await opened.storage.close(BACKGROUND_CONTEXT)
    }
  }

  async closeAll() {
    await Promise.allSettled([...this.writers].map((storage) => storage.close(BACKGROUND_CONTEXT)))
    await Promise.allSettled(this.readers.values())
    await removeSessionCaches()
  }

  private async read<T>(sessionId: string, use: (storage: Storage) => Promise<T>): Promise<T> {
    const previous = this.readers.get(sessionId)
    const current = (async () => {
      await previous?.catch(() => {})
      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        select: { id: true },
      })
      if (!session) throw new Error('Session not found')
      const cache = await openSessionCache(sessionId, 'read')
      try {
        return await use(cache.storage)
      } finally {
        await cache.storage.close(BACKGROUND_CONTEXT)
      }
    })()
    this.readers.set(sessionId, current)
    try {
      return await current
    } finally {
      if (this.readers.get(sessionId) === current) this.readers.delete(sessionId)
    }
  }

  async listEntries(
    sessionId: string,
    options: { after?: EntryId; limit?: number; cursor?: Cursor } = {},
  ) {
    return this.read(sessionId, async (storage) => {
      if (!(await storage.conversation(ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT)))
        return { items: [], next: undefined }
      return storage.scanEntries(
        {
          conversationId: ROOT_CONVERSATION_ID,
          order: 'ascending',
          ...(options.after === undefined ? {} : { minEntryId: (options.after + 1) as EntryId }),
        },
        options.limit ?? 20,
        options.cursor,
        BACKGROUND_CONTEXT,
      )
    })
  }

  async getEntries(sessionId: string): Promise<EntryRecord[]> {
    return this.read(sessionId, async (storage) => {
      const entries: EntryRecord[] = []
      if (!(await storage.conversation(ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT))) return entries
      let cursor: Cursor | undefined
      do {
        const page = await storage.scanEntries(
          { conversationId: ROOT_CONVERSATION_ID, order: 'ascending' },
          100,
          cursor,
          BACKGROUND_CONTEXT,
        )
        entries.push(...page.items)
        cursor = page.next
      } while (cursor)
      return entries
    })
  }

  async getEntryForRequest(sessionId: string, requestId: string) {
    return this.read(sessionId, async (storage) => {
      const submission = await storage.submissionByRequest(
        ROOT_CONVERSATION_ID,
        requestId,
        BACKGROUND_CONTEXT,
      )
      return submission?.entry === undefined
        ? undefined
        : (await storage.entry(submission.entry, BACKGROUND_CONTEXT))?.entry
    })
  }

  async recordUsage(
    sessionId: string,
    totals: PrismaJson.AgentSessionUsage,
    owner: UsageOwner,
    transaction?: Prisma.TransactionClient,
  ): Promise<PrismaJson.AgentSessionUsage> {
    const account = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM agent_sessions WHERE id = ${sessionId} FOR UPDATE`
      const session = await tx.agentSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: { accountedUsage: true },
      })
      const previous = session.accountedUsage
      const delta = {
        inputTokens: Math.max(0, totals.inputTokens - (previous?.inputTokens ?? 0)),
        outputTokens: Math.max(0, totals.outputTokens - (previous?.outputTokens ?? 0)),
        cacheReadTokens: Math.max(0, totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0)),
        totalTokens: Math.max(0, totals.totalTokens - (previous?.totalTokens ?? 0)),
        cost: Math.max(0, totals.cost - (previous?.cost ?? 0)),
      }
      if (delta.totalTokens || delta.cost) {
        await new AiUsageService(tx).recordUsage({
          teamId: owner.teamId,
          userId: owner.userId,
          ...delta,
        })
        await quotaService.consumeQuota(
          { ...owner, resource: 'agent_total_tokens' },
          delta.totalTokens,
          tx,
        )
        await quotaService.consumeQuota({ ...owner, resource: 'agent_cost' }, delta.cost, tx)
      }
      await tx.agentSession.update({ where: { id: sessionId }, data: { accountedUsage: totals } })
      return delta
    }
    return transaction ? account(transaction) : prisma.$transaction(account)
  }
}

export const agentSessionService = new AgentSessionService()
