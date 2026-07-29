import { prisma } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { ulid } from 'ulid'
import {
  type AgentMessage,
  type SessionMetadata,
  type SessionStorage,
  type SessionTreeEntry,
} from '@earendil-works/pi-agent-core'
import { agentService } from '@shumai/core/src/agent/agent'

export interface DatabaseSessionMetadata extends SessionMetadata {
  agentId: string
  userId?: string
  cwd: string
  assetId?: string
  userCommentId?: string
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
      assetId: session.assetId || undefined,
      userCommentId: session.userCommentId || undefined,
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
    if (leafId === null) {
      await prisma.agentSession.update({
        where: { id: this.sessionId },
        data: { leafId: null },
      })
      return
    }

    const existing = await prisma.agentSessionEntry.findFirst({
      where: { id: leafId },
    })
    if (!existing) {
      throw new Error(`Entry ${leafId} not found`)
    }

    const currentLeafId = await this.getLeafId()
    const leafEntry: SessionTreeEntry = {
      type: 'leaf',
      id: await this.createEntryId(),
      parentId: currentLeafId,
      timestamp: new Date().toISOString(),
      targetId: leafId,
    }
    await this.appendEntry(leafEntry)
  }

  async createEntryId(): Promise<string> {
    return ulid()
  }

  private recordToEntry(record: {
    id: string
    type: string | null
    parentId: string | null
    createdAt: Date
    data: unknown
  }): SessionTreeEntry {
    const payload = (record.data as Record<string, unknown>) || {}
    return {
      id: record.id,
      type: (record.type || 'message') as SessionTreeEntry['type'],
      parentId: record.parentId,
      timestamp: record.createdAt.toISOString(),
      ...payload,
    } as unknown as SessionTreeEntry
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

    const targetLeafId = entry.type === 'leaf' ? entry.targetId : entry.id

    // Extract base fields and store type-specific properties in data payload
    const payload = { ...strippedEntry } as Record<string, unknown>
    delete payload.id
    delete payload.type
    delete payload.parentId
    delete payload.timestamp

    const session = await prisma.agentSession.findUnique({
      where: { id: this.sessionId },
      select: { assetId: true },
    })

    await prisma.$transaction([
      prisma.agentSessionEntry.create({
        data: {
          id: entry.id,
          sessionId: this.sessionId,
          assetId: session?.assetId || null,
          type: entry.type,
          parentId: entry.parentId || null,
          createdAt: entry.timestamp ? new Date(entry.timestamp) : new Date(),
          data: payload as PrismaJson.PiSessionEntryData,
        },
      }),
      prisma.agentSession.update({
        where: { id: this.sessionId },
        data: { leafId: targetLeafId },
      }),
    ])
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    const record = await prisma.agentSessionEntry.findUnique({
      where: { id },
    })
    if (!record) return undefined
    const entry = this.recordToEntry(record)
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
        type,
      },
      orderBy: { id: 'asc' },
    })
    const entries = records.map((r) => this.recordToEntry(r)) as Array<
      Extract<SessionTreeEntry, { type: TType }>
    >
    for (const entry of entries) {
      await this.reinjectImageDataAsync(entry)
      await this.reinjectSkillContentAsync(entry)
    }
    return entries
  }

  async getLabel(id: string): Promise<string | undefined> {
    const entry = await this.getEntry(id)
    return (entry as { label?: string } | undefined)?.label
  }

  async getPathToRoot(leafId: string | null): Promise<SessionTreeEntry[]> {
    if (!leafId) return []

    interface EntryRow {
      id: string
      type: string | null
      // eslint-disable-next-line @typescript-eslint/naming-convention
      parent_id: string | null
      // eslint-disable-next-line @typescript-eslint/naming-convention
      created_at: Date
      data: unknown
    }

    const rows = await prisma.$queryRaw<EntryRow[]>`
      WITH RECURSIVE entry_path AS (
        SELECT id, type, parent_id, created_at, data, 1 AS depth
        FROM agent_session_entries
        WHERE id = ${leafId}

        UNION ALL

        SELECT e.id, e.type, e.parent_id, e.created_at, e.data, ep.depth + 1
        FROM agent_session_entries e
        INNER JOIN entry_path ep ON e.id = ep.parent_id
      )
      SELECT id, type, parent_id, created_at, data
      FROM entry_path
      ORDER BY depth DESC;
    `

    const pathEntries: SessionTreeEntry[] = rows.map((r) =>
      this.recordToEntry({
        id: r.id,
        type: r.type,
        parentId: r.parent_id,
        createdAt: r.created_at,
        data: r.data,
      }),
    )

    // Only reinject image data (which may involve S3 calls) for the entries in the path
    for (const entry of pathEntries) {
      await this.reinjectImageDataAsync(entry)
      await this.reinjectSkillContentAsync(entry)
    }

    // Dynamically tag comments that currently have reply threads
    const commentIds = Array.from(new Set(pathEntries.map((e) => e.id.split('_')[0])))
    if (commentIds.length > 0) {
      const threadCounts = await prisma.assetComment.groupBy({
        by: ['replyToId'],
        where: {
          replyToId: { in: commentIds },
        },
      })
      const commentIdsWithThreads = new Set<string>()
      for (const tc of threadCounts) {
        if (tc.replyToId) commentIdsWithThreads.add(tc.replyToId)
      }

      if (commentIdsWithThreads.size > 0) {
        for (let i = 0; i < pathEntries.length; i++) {
          const entry = pathEntries[i]
          const baseCommentId = entry.id.split('_')[0]
          if (commentIdsWithThreads.has(baseCommentId) && entry.type === 'message') {
            const cloned = structuredClone(entry)
            const msg = cloned.message as unknown as {
              content?: Array<{ type: string; text: string }>
            }
            if (Array.isArray(msg.content) && msg.content[0] && msg.content[0].type === 'text') {
              if (!msg.content[0].text.startsWith(`[Thread ID: ${baseCommentId}]`)) {
                msg.content[0].text = `[Thread ID: ${baseCommentId}] ${msg.content[0].text}`
              }
            }
            pathEntries[i] = cloned
          }
        }
      }
    }

    return pathEntries
  }

  async getEntries(): Promise<SessionTreeEntry[]> {
    const records = await prisma.agentSessionEntry.findMany({
      where: { sessionId: this.sessionId },
      orderBy: { id: 'asc' },
    })
    const entries = records.map((r) => this.recordToEntry(r))
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
    assetId?: string
    userCommentId?: string
  }): Promise<DatabaseSessionStorage> {
    if (params.sessionId) {
      return new DatabaseSessionStorage(params.sessionId)
    } else {
      const session = await prisma.agentSession.create({
        data: {
          agentId: params.agentId,
          userId: params.userId,
          cwd: params.cwd || process.cwd(),
          assetId: params.assetId || null,
          userCommentId: params.userCommentId || null,
        },
      })
      return new DatabaseSessionStorage(session.id)
    }
  }
}
