import { prisma } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { ulid } from 'ulid'
import {
  type AgentMessage,
  type SessionMetadata,
  type SessionStorage,
  type SessionTreeEntry,
  type SessionTreeEntryBase,
} from '@earendil-works/pi-agent-core'
import { agentService } from '@shumai/core/src/agent/agent'

export interface DatabaseSessionMetadata extends SessionMetadata {
  agentId: string
  userId?: string
  cwd: string
}

export class DatabaseSessionStorage implements SessionStorage<DatabaseSessionMetadata> {
  constructor(public readonly sessionId: string) {}

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

    // Strip image data and skill content before saving to DB
    if (strippedEntry.type === 'message') {
      const msg = strippedEntry.message
      if (msg.role === 'toolResult') {
        const details = msg.details as { sourceKeys?: string[]; skillId?: string } | undefined

        // Strip S3 image data
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

        // Strip skill content
        if (msg.toolName === 'read_skill' && !msg.isError) {
          if (details?.skillId && Array.isArray(msg.content)) {
            msg.content.forEach((item: { type: string; text?: string }) => {
              if (
                item.type === 'text' &&
                item.text &&
                !item.text.startsWith('Skill with ID') &&
                !item.text.startsWith('Skill downloaded but') &&
                !item.text.startsWith('Error reading skill')
              ) {
                item.text = '__SKILL_CONTENT__'
              }
            })
          }
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
    await this.reinjectSkillContentAsync(entry)
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
      await this.reinjectSkillContentAsync(entry)
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

    // Fetch all entries for this session in a single query to avoid N+1 problem
    const records = await prisma.agentSessionEntry.findMany({
      where: { sessionId: this.sessionId },
    })

    // Build a map for fast lookup
    const entryMap = new Map<string, SessionTreeEntry>()
    for (const record of records) {
      entryMap.set(record.id, record.entry as unknown as SessionTreeEntry)
    }

    const pathEntries: SessionTreeEntry[] = []
    let currentId: string | null = leafId

    while (currentId) {
      const entry = entryMap.get(currentId)
      if (!entry) break
      pathEntries.unshift(entry)
      currentId = (entry as SessionTreeEntryBase).parentId
    }

    // Only reinject image data (which may involve S3 calls) for the entries in the path
    for (const entry of pathEntries) {
      await this.reinjectImageDataAsync(entry)
      await this.reinjectSkillContentAsync(entry)
    }

    return pathEntries
  }

  async getEntries(): Promise<SessionTreeEntry[]> {
    const records = await prisma.agentSessionEntry.findMany({
      where: { sessionId: this.sessionId },
      orderBy: { id: 'asc' },
    })
    const entries = records.map((r) => r.entry as unknown as SessionTreeEntry)
    for (const entry of entries) {
      await this.reinjectImageDataAsync(entry)
      await this.reinjectSkillContentAsync(entry)
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

  private async reinjectSkillContentAsync(entry: SessionTreeEntry) {
    if (entry.type === 'message') {
      const msg = entry.message as AgentMessage
      if (msg.role === 'toolResult' && msg.toolName === 'read_skill') {
        const details = msg.details as { skillId?: string } | undefined
        if (details?.skillId && Array.isArray(msg.content)) {
          for (const item of msg.content) {
            if (item.type === 'text' && item.text === '__SKILL_CONTENT__') {
              try {
                const content = await agentService.getSkillContent(details.skillId)
                item.text = content
              } catch (err) {
                console.error(
                  `Failed to re-inject skill content for skill ${details.skillId}:`,
                  err,
                )
              }
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
