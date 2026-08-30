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

  nextEntryId?: string | null
  currentMessageContext?: PrismaJson.ShumaiMessageContext

  async createEntryId(): Promise<string> {
    if (this.nextEntryId) {
      const id = this.nextEntryId
      this.nextEntryId = null
      return id
    }
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
    let type = (record.type || 'message') as SessionTreeEntry['type']
    if (type === 'message' && payload.customType === 'shumai_message') {
      type = 'custom_message'
    }
    return {
      id: record.id,
      type,
      parentId: record.parentId,
      timestamp: record.createdAt.toISOString(),
      ...payload,
    } as unknown as SessionTreeEntry
  }

  async appendEntry(entry: SessionTreeEntry): Promise<void> {
    let entryToProcess = entry
    if (
      entryToProcess.type === 'message' &&
      entryToProcess.message &&
      entryToProcess.message.role === 'user' &&
      this.currentMessageContext
    ) {
      let contentText = ''
      if (typeof entryToProcess.message.content === 'string') {
        contentText = entryToProcess.message.content
      } else if (Array.isArray(entryToProcess.message.content)) {
        contentText = entryToProcess.message.content
          .map((c) =>
            typeof c === 'object' && c && 'text' in c && typeof c.text === 'string' ? c.text : '',
          )
          .join('')
      }

      entryToProcess = {
        type: 'custom_message',
        id: entryToProcess.id,
        parentId: entryToProcess.parentId,
        timestamp: entryToProcess.timestamp,
        customType: 'shumai_message',
        content: contentText,
        display: true,
        details: this.currentMessageContext,
      } as unknown as SessionTreeEntry
      this.currentMessageContext = undefined
    }

    const strippedEntry = structuredClone(entryToProcess)

    // Strip image data and skill content before saving to DB
    if (strippedEntry.type === 'message' && strippedEntry.message) {
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

    const targetLeafId =
      strippedEntry.type === 'leaf'
        ? (strippedEntry as unknown as { targetId?: string }).targetId || strippedEntry.id
        : strippedEntry.id

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
      prisma.agentSessionEntry.upsert({
        where: { id: strippedEntry.id },
        create: {
          id: strippedEntry.id,
          sessionId: this.sessionId,
          assetId: session?.assetId || null,
          type: strippedEntry.type,
          parentId: strippedEntry.parentId || null,
          createdAt: strippedEntry.timestamp ? new Date(strippedEntry.timestamp) : new Date(),
          data: payload as PrismaJson.PiSessionEntryData,
        },
        update: {
          type: strippedEntry.type,
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

  async getSessionName(): Promise<string | undefined> {
    const session = await prisma.agentSession.findUnique({
      where: { id: this.sessionId },
      select: { name: true },
    })
    return session?.name || undefined
  }

  async getSessionStats(): Promise<{
    messageCount: number
    cachedTokens: number
    uncachedTokens: number
    totalTokens: number
    costTotal: number
  }> {
    const entries = await this.getEntries()

    let messageCount = 0
    let cachedTokens = 0
    let uncachedTokens = 0
    let totalTokens = 0
    let costTotal = 0

    for (const entry of entries) {
      if (entry.type === 'custom_message' && entry.customType === 'shumai_message') {
        messageCount++
      } else if (entry.type === 'message' && entry.message) {
        const msg = entry.message
        if (msg.role === 'user' || msg.role === 'assistant') {
          messageCount++
        }
        if (msg.role === 'assistant' && msg.usage) {
          cachedTokens += msg.usage.cacheRead || 0
          uncachedTokens += (msg.usage.input || 0) + (msg.usage.output || 0)
          totalTokens +=
            msg.usage.totalTokens ||
            (msg.usage.input || 0) + (msg.usage.output || 0) + (msg.usage.cacheRead || 0)
          if (msg.usage.cost) {
            costTotal += msg.usage.cost.total || 0
          }
        }
      } else if (entry.type === 'compaction' || entry.type === 'branch_summary') {
        const usage = entry.usage
        if (usage) {
          cachedTokens += usage.cacheRead || 0
          uncachedTokens += (usage.input || 0) + (usage.output || 0)
          totalTokens +=
            usage.totalTokens || (usage.input || 0) + (usage.output || 0) + (usage.cacheRead || 0)
          if (usage.cost) {
            costTotal += usage.cost.total || 0
          }
        }
      }
    }

    return {
      messageCount,
      cachedTokens,
      uncachedTokens,
      totalTokens,
      costTotal,
    }
  }

  async getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]> {
    return this.getPathToRoot(leafId)
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
    const entryIds = pathEntries.map((e) => e.id)
    if (entryIds.length > 0) {
      const threadCounts = await prisma.assetComment.groupBy({
        by: ['replyToId'],
        where: {
          replyToId: { in: entryIds },
          message: { not: '__CHAT__' },
        },
        _count: {
          id: true,
        },
      })
      const threadReplyCountMap = new Map<string, number>()
      for (const tc of threadCounts) {
        if (tc.replyToId) {
          threadReplyCountMap.set(tc.replyToId, tc._count.id)
        }
      }

      if (threadReplyCountMap.size > 0) {
        for (let i = 0; i < pathEntries.length; i++) {
          const entry = pathEntries[i]
          const count = threadReplyCountMap.get(entry.id)
          if (count !== undefined && count > 0) {
            if (entry.type === 'message' && entry.message) {
              const cloned = structuredClone(entry)
              const msg = cloned.message as unknown as {
                content?: Array<{ type: string; text: string }>
              }
              if (Array.isArray(msg.content) && msg.content[0] && msg.content[0].type === 'text') {
                const threadTag = `[Thread ID: ${entry.id}] [Replies: ${count}]`
                if (!msg.content[0].text.includes(`[Thread ID: ${entry.id}]`)) {
                  msg.content[0].text = `${threadTag} ${msg.content[0].text}`
                }
              }
              pathEntries[i] = cloned
            } else if (entry.type === 'custom_message') {
              const cloned = structuredClone(entry)
              const threadTag = `[Thread ID: ${entry.id}] [Replies: ${count}]`
              if (typeof cloned.content === 'string') {
                if (!cloned.content.includes(`[Thread ID: ${entry.id}]`)) {
                  cloned.content = `${threadTag} ${cloned.content}`
                }
              }
              pathEntries[i] = cloned
            }
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
    if (entry.type === 'message' && entry.message) {
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
    if (entry.type === 'message' && entry.message) {
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
