import { prisma } from '@/db'
import { s3Service } from '@/services/s3/s3'
import { ulid } from 'ulid'
import {
  type AgentMessage,
  type SessionMetadata,
  type SessionStorage,
  type SessionTreeEntry,
  type SessionTreeEntryBase,
} from '@earendil-works/pi-agent-core'

export interface DatabaseSessionMetadata extends SessionMetadata {
  agentId: string
  userId?: string
  cwd: string
}

export class DatabaseSessionStorage implements SessionStorage<DatabaseSessionMetadata> {
  constructor(private sessionId: string) {}

  async getMetadata(): Promise<DatabaseSessionMetadata> {
    const session = await prisma.agentSession.findUnique({
      where: { id: this.sessionId },
    })
    if (!session) throw new Error(`Session ${this.sessionId} not found`)
    return {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      agentId: session.agentId,
      userId: session.userId || undefined,
      cwd: session.cwd,
    }
  }

  async getLeafId(): Promise<string | null> {
    const session = await prisma.agentSession.findUnique({
      where: { id: this.sessionId },
      select: { leafId: true },
    })
    return session?.leafId || null
  }

  async setLeafId(leafId: string | null): Promise<void> {
    await prisma.agentSession.update({
      where: { id: this.sessionId },
      data: { leafId },
    })
  }

  async createEntryId(): Promise<string> {
    return ulid()
  }

  async appendEntry(entry: SessionTreeEntry): Promise<void> {
    const strippedEntry = structuredClone(entry)

    // Strip image data before saving to DB
    if (strippedEntry.type === 'message') {
      const msg = strippedEntry.message
      if (msg.role === 'toolResult') {
        const details = msg.details as { sourceKeys?: string[] } | undefined
        if (Array.isArray(msg.content) && details?.sourceKeys) {
          const sourceKeys = details.sourceKeys
          let keyIdx = 0
          msg.content.forEach((item: { type: string; data?: string }) => {
            if (item.type === 'image' && sourceKeys[keyIdx]) {
              item.data = '__S3_DATA__'
              keyIdx++
            }
          })
        }
      }
    }

    await prisma.agentSessionEntry.create({
      data: {
        id: entry.id,
        sessionId: this.sessionId,
        entry: strippedEntry,
      },
    })

    // Auto-update leafId on append
    await this.setLeafId(entry.id)
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    const record = await prisma.agentSessionEntry.findUnique({
      where: { id },
    })
    if (!record) return undefined
    const entry = record.entry as unknown as SessionTreeEntry
    await this.reinjectImageDataAsync(entry)
    return entry
  }

  async findEntries<TType extends SessionTreeEntry['type']>(
    type: TType,
  ): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
    const records = await prisma.agentSessionEntry.findMany({
      where: {
        sessionId: this.sessionId,
        entry: {
          path: ['type'],
          equals: type,
        },
      },
      orderBy: { id: 'asc' },
    })
    const entries = records.map((r) => r.entry as unknown as SessionTreeEntry) as Array<
      Extract<SessionTreeEntry, { type: TType }>
    >
    for (const entry of entries) {
      await this.reinjectImageDataAsync(entry)
    }
    return entries
  }

  async getLabel(id: string): Promise<string | undefined> {
    const record = await prisma.agentSessionEntry.findFirst({
      where: {
        sessionId: this.sessionId,
        entry: {
          path: ['id'],
          equals: id,
        },
      },
    })
    // Entry is generic Json
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (record?.entry as any)?.label
  }

  async getPathToRoot(leafId: string | null): Promise<SessionTreeEntry[]> {
    if (!leafId) return []
    const entries: SessionTreeEntry[] = []
    let currentId: string | null = leafId

    while (currentId) {
      const record = await prisma.agentSessionEntry.findUnique({
        where: { id: currentId },
      })
      if (!record) break
      const entry = record.entry as unknown as SessionTreeEntry
      await this.reinjectImageDataAsync(entry)
      entries.unshift(entry)
      currentId = (entry as SessionTreeEntryBase).parentId
    }

    return entries
  }

  async getEntries(): Promise<SessionTreeEntry[]> {
    const records = await prisma.agentSessionEntry.findMany({
      where: { sessionId: this.sessionId },
      orderBy: { id: 'asc' },
    })
    const entries = records.map((r) => r.entry as unknown as SessionTreeEntry)
    for (const entry of entries) {
      await this.reinjectImageDataAsync(entry)
    }
    return entries
  }

  private async reinjectImageDataAsync(entry: SessionTreeEntry) {
    if (entry.type === 'message') {
      const msg = entry.message as AgentMessage
      if (msg.role === 'toolResult') {
        const details = msg.details as { sourceKeys?: string[] } | undefined
        if (Array.isArray(msg.content) && details?.sourceKeys) {
          const sourceKeys = details.sourceKeys
          let keyIdx = 0
          for (const item of msg.content) {
            if (item.type === 'image' && item.data === '__S3_DATA__' && sourceKeys[keyIdx]) {
              const key = sourceKeys[keyIdx]
              try {
                const { buffer } = await s3Service.getObject(process.env.S3_BUCKET || 'shumai', key)
                item.data = buffer.toString('base64')
              } catch (err) {
                console.error(`Failed to re-inject image data for key ${key}:`, err)
              }
              keyIdx++
            }
          }
        }
      }
    }
  }

  static async create(params: {
    agentId: string
    userId?: string
    sessionId?: string
    cwd?: string
  }): Promise<DatabaseSessionStorage> {
    if (params.sessionId) {
      return new DatabaseSessionStorage(params.sessionId)
    } else {
      const session = await prisma.agentSession.create({
        data: {
          agentId: params.agentId,
          userId: params.userId,
          cwd: params.cwd || process.cwd(),
        },
      })
      return new DatabaseSessionStorage(session.id)
    }
  }
}
