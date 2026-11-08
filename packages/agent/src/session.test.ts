import { describe, expect, it } from 'vitest'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import {
  buildSessionContext,
  Session,
  SessionError,
  type SessionMetadata,
  type SessionStats,
  type SessionStorage,
  type SessionTreeEntry,
} from './session'

class InMemorySessionStorage implements SessionStorage<SessionMetadata> {
  private readonly entries: SessionTreeEntry[] = []
  private leafId: string | null = null
  private nextId = 1

  async getMetadata(): Promise<SessionMetadata> {
    return { id: 'session-1', createdAt: '2026-01-01T00:00:00.000Z' }
  }

  async getLeafId(): Promise<string | null> {
    return this.leafId
  }

  async setLeafId(leafId: string | null): Promise<void> {
    this.leafId = leafId
  }

  async createEntryId(): Promise<string> {
    return `entry-${this.nextId++}`
  }

  async appendEntry(entry: SessionTreeEntry): Promise<void> {
    this.entries.push(entry)
    this.leafId = entry.type === 'leaf' ? entry.targetId : entry.id
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    return this.entries.find((e) => e.id === id)
  }

  async findEntries<TType extends SessionTreeEntry['type']>(
    type: TType,
  ): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
    return this.entries.filter(
      (e): e is Extract<SessionTreeEntry, { type: TType }> => e.type === type,
    )
  }

  async getLabel(id: string): Promise<string | undefined> {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i]
      if (e.type === 'label' && e.targetId === id) {
        return e.label
      }
    }
    return undefined
  }

  async getSessionName(): Promise<string | undefined> {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i]
      if (e.type === 'session_info') {
        return e.name
      }
    }
    return undefined
  }

  async getSessionStats(): Promise<SessionStats> {
    return {
      messageCount: this.entries.filter((e) => e.type === 'message').length,
      cachedTokens: 0,
      uncachedTokens: 0,
      totalTokens: 0,
      costTotal: 0,
    }
  }

  async getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]> {
    if (!leafId) return []
    const byId = new Map(this.entries.map((e) => [e.id, e]))
    const path: SessionTreeEntry[] = []
    let current = byId.get(leafId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return path
  }

  async getEntries(): Promise<SessionTreeEntry[]> {
    return [...this.entries]
  }
}

describe('Session', () => {
  it('appends messages and builds session context', async () => {
    const storage = new InMemorySessionStorage()
    const session = new Session(storage)

    expect(await session.getSessionId()).toBe('session-1')
    expect(await session.buildContext()).toEqual({
      messages: [],
      thinkingLevel: 'off',
      model: null,
      activeToolNames: null,
    })

    const userMsg: AgentMessage = {
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }],
      timestamp: 1000,
    }
    const id1 = await session.appendMessage(userMsg)
    expect(await session.getLeafId()).toBe(id1)

    await session.appendThinkingLevelChange('high')
    await session.appendModelChange('anthropic', 'claude-sonnet-4-5')
    await session.appendActiveToolsChange(['read_skill', 'bash'])
    await session.appendCustomMessageEntry('shumai_message', 'Context prompt', true, {
      assetId: 'a1',
    })

    const ctx = await session.buildContext()
    expect(ctx.thinkingLevel).toBe('high')
    expect(ctx.model).toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-4-5' })
    expect(ctx.activeToolNames).toEqual(['read_skill', 'bash'])
    expect(ctx.messages).toHaveLength(2)
    expect(ctx.messages[0]).toEqual(userMsg)
    expect(ctx.messages[1]).toMatchObject({
      role: 'custom',
      customType: 'shumai_message',
      content: 'Context prompt',
      display: true,
      details: { assetId: 'a1' },
    })
  })

  it('supports compaction with firstKeptEntryId and retainedTail', async () => {
    const storage = new InMemorySessionStorage()
    const session = new Session(storage)

    await session.appendMessage({ role: 'user', content: 'm1', timestamp: 1 })
    const keptId = await session.appendMessage({ role: 'user', content: 'm2', timestamp: 2 })
    await session.appendMessage({ role: 'user', content: 'm3', timestamp: 3 })
    await session.appendCompaction('Compacted summary', keptId, 500)
    await session.appendMessage({ role: 'user', content: 'm4', timestamp: 4 })

    const ctx = await session.buildContext()
    expect(ctx.messages.map((m) => m.role)).toEqual(['compactionSummary', 'user', 'user', 'user'])
  })

  it('supports branching, branchWithSummary, and label changes', async () => {
    const storage = new InMemorySessionStorage()
    const session = new Session(storage)

    const id1 = await session.appendMessage({ role: 'user', content: 'root', timestamp: 1 })
    const id2 = await session.appendMessage({ role: 'user', content: 'branch-a', timestamp: 2 })
    expect(await session.getLeafId()).toBe(id2)

    await session.branch(id1)
    expect(await session.getLeafId()).toBe(id1)

    const summaryId = await session.branchWithSummary(id1, 'Switched from branch A')
    expect(await session.getLeafId()).toBe(summaryId)

    const ctx = await session.buildContext()
    expect(ctx.messages).toHaveLength(2)
    expect(ctx.messages[1]).toMatchObject({
      role: 'branchSummary',
      summary: 'Switched from branch A',
      fromId: id1,
    })

    await session.appendLabelChange(id1, 'milestone')
    expect(await session.getLabel(id1)).toBe('milestone')

    await expect(session.branch('missing')).rejects.toThrow(SessionError)
    await expect(session.appendLabelChange('missing', 'tag')).rejects.toThrow(SessionError)
  })

  it('buildSessionContext resolves leaf entries and assistant model changes', () => {
    const entries: SessionTreeEntry[] = [
      {
        type: 'message',
        id: 'e1',
        parentId: null,
        timestamp: '2026-01-01T00:00:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi' }],
          api: 'openai-responses',
          provider: 'openai',
          model: 'gpt-5',
          usage: {
            input: 1,
            output: 1,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 2,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: 'stop',
          timestamp: 10,
        },
      },
      {
        type: 'leaf',
        id: 'e2',
        parentId: 'e1',
        timestamp: '2026-01-01T00:00:01.000Z',
        targetId: 'e1',
      },
    ]

    const ctx = buildSessionContext(entries)
    expect(ctx.model).toEqual({ provider: 'openai', modelId: 'gpt-5' })
    expect(ctx.messages).toHaveLength(1)
  })
})
