import { prisma } from '@/db'
import { s3Service } from '@/services/s3/s3'
import { SessionEntry, SessionManager } from '@mariozechner/pi-coding-agent'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class DatabaseSessionManager extends (SessionManager as any) {
  private dbSessionId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private writeQueue: Promise<any> = Promise.resolve()

  private constructor(sessionId: string, cwd: string) {
    super(cwd, '', undefined, false) // persist = false, we handle it manually
    this.dbSessionId = sessionId
  }

  static async create(params: {
    agentId: string
    userId?: string
    sessionId?: string
    cwd?: string
  }): Promise<DatabaseSessionManager> {
    const sessionId = params.sessionId
    const cwd = params.cwd || process.cwd()

    if (sessionId) {
      const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        include: { entries: { orderBy: { id: 'asc' } } },
      })
      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }
      const manager = new DatabaseSessionManager(sessionId, session.cwd)
      // Load entries into in-memory SessionManager
      for (const e of session.entries) {
        const entry = e.entry

        // Dynamically re-inject image data if it was stripped
        if (entry.type === 'message' && entry.message.role === 'toolResult') {
          const msg = entry.message
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

        manager._appendEntry(entry, false) // false to avoid re-saving
      }
      return manager
    } else {
      const session = await prisma.agentSession.create({
        data: {
          agentId: params.agentId,
          userId: params.userId,
          cwd: cwd,
        },
      })
      return new DatabaseSessionManager(session.id, cwd)
    }
  }

  // Override _appendEntry to save to database
  // Note: we use (manager as any)._appendEntry = ... in static factory if needed,
  // but since we extend it, we can just define it here.
  // We need to match the signature of the base class.
  protected _appendEntry(entry: SessionEntry, shouldSave = true) {
    // Call super._appendEntry (which is private, so we use the prototype)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const superAppendEntry = (SessionManager.prototype as any)['_appendEntry']
    superAppendEntry.call(this, entry)

    if (shouldSave) {
      this.saveEntryToDb(entry)
    }
  }

  private saveEntryToDb(entry: SessionEntry) {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        // Deep clone to avoid stripping data from the in-memory session manager
        const strippedEntry = JSON.parse(JSON.stringify(entry)) as SessionEntry

        // Strip image data before saving to DB
        if (strippedEntry.type === 'message' && strippedEntry.message.role === 'toolResult') {
          const msg = strippedEntry.message
          const details = msg.details as { sourceKeys?: string[] } | undefined
          if (Array.isArray(msg.content) && details?.sourceKeys) {
            const sourceKeys = details.sourceKeys
            let keyIdx = 0
            msg.content.forEach((item) => {
              if (item.type === 'image' && sourceKeys[keyIdx]) {
                item.data = '__S3_DATA__'
                keyIdx++
              }
            })
          }
        }

        await prisma.agentSessionEntry.create({
          data: {
            id: strippedEntry.id,
            sessionId: this.dbSessionId,
            entry: strippedEntry,
          },
        })
        await prisma.agentSession.update({
          where: { id: this.dbSessionId },
          data: { leafId: strippedEntry.id },
        })
      } catch (err) {
        console.error('Failed to save session entry to DB:', err)
      }
    })
  }

  async waitForSync() {
    await this.writeQueue
  }

  getDbSessionId() {
    return this.dbSessionId
  }
}
