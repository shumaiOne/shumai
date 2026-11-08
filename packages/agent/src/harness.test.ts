import { describe, expect, it } from 'vitest'
import type { AgentEvent, AgentTool } from '@earendil-works/pi-agent-core'
import {
  createAssistantMessageEventStream,
  createModels,
  getCurrentSystemPrompt,
  getCurrentTools,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
} from '@earendil-works/pi-ai'
import { Type } from 'typebox'
import { AgentHarness, convertToLlm } from './harness'
import {
  Session,
  type SessionMetadata,
  type SessionStats,
  type SessionStorage,
  type SessionTreeEntry,
} from './session'

class InMemorySessionStorage implements SessionStorage<SessionMetadata> {
  readonly entries: SessionTreeEntry[] = []
  private leafId: string | null = null
  private nextId = 1

  async getMetadata(): Promise<SessionMetadata> {
    return { id: 'session-test', createdAt: '2026-01-01T00:00:00.000Z' }
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

  async getLabel(): Promise<string | undefined> {
    return undefined
  }

  async getSessionName(): Promise<string | undefined> {
    return undefined
  }

  async getSessionStats(): Promise<SessionStats> {
    return {
      messageCount: 0,
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

const baseModel: Model<Api> = {
  id: 'test-model',
  name: 'Test Model',
  provider: 'test-provider',
  api: 'openai-responses',
  baseUrl: 'https://api.example.com/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 4096,
}

function makeAssistantStream(message: AssistantMessage): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream()
  queueMicrotask(() => {
    stream.push({ type: 'start', partial: message })
    stream.push({ type: 'done', reason: 'stop', message })
    stream.end(message)
  })
  return stream
}

describe('AgentHarness', () => {
  it('streams prompt, executes tools, updates active tools mid-run, and suppresses system message persistence', async () => {
    const storage = new InMemorySessionStorage()
    const session = new Session(storage)
    const models = createModels()

    const capturedContexts: TranscriptContext[] = []
    const capturedOptions: Array<SimpleStreamOptions | undefined> = []

    const dynamicBashTool: AgentTool = {
      name: 'bash',
      label: 'Bash',
      description: 'Execute bash',
      parameters: Type.Object({ command: Type.String() }),
      execute: async () => ({
        content: [{ type: 'text', text: 'bash output' }],
        details: {},
      }),
    }

    const harnessHolder: { current?: AgentHarness } = {}
    const readSkillTool: AgentTool = {
      name: 'read_skill',
      label: 'Read Skill',
      description: 'Read skill content',
      parameters: Type.Object({ skillId: Type.String() }),
      execute: async () => {
        if (harnessHolder.current) {
          const nextTools = [...harnessHolder.current.getTools(), dynamicBashTool]
          await harnessHolder.current.setTools(
            nextTools,
            nextTools.map((t) => t.name),
          )
        }
        return {
          content: [{ type: 'text', text: '# Skill loaded' }],
          details: { skillId: 's1' },
        }
      },
    }

    let callIndex = 0
    const harness = new AgentHarness({
      session,
      models,
      model: baseModel,
      thinkingLevel: 'max',
      systemPrompt: async () => 'You are a helpful agent.',
      tools: [readSkillTool],
      streamFn: (_model, context, options) => {
        capturedContexts.push(structuredClone(context))
        capturedOptions.push(options)
        callIndex++
        if (callIndex === 1) {
          return makeAssistantStream({
            role: 'assistant',
            content: [
              {
                type: 'toolCall',
                id: 'tc-1',
                name: 'read_skill',
                arguments: { skillId: 's1' },
              },
            ],
            api: baseModel.api,
            provider: baseModel.provider,
            model: baseModel.id,
            usage: {
              input: 10,
              output: 5,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 15,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: 'toolUse',
            timestamp: 100,
          })
        }
        return makeAssistantStream({
          role: 'assistant',
          content: [{ type: 'text', text: 'Final answer' }],
          api: baseModel.api,
          provider: baseModel.provider,
          model: baseModel.id,
          usage: {
            input: 20,
            output: 10,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 30,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: 'stop',
          timestamp: 200,
        })
      },
    })
    harnessHolder.current = harness

    const emittedEvents: AgentEvent['type'][] = []
    harness.subscribe((ev) => {
      if (ev.type !== 'compaction_start' && ev.type !== 'compaction_end') {
        emittedEvents.push(ev.type)
      }
    })

    // Configured thinking level is preserved on getThinkingLevel(), but clamped to 'high' at request time
    expect(harness.getThinkingLevel()).toBe('max')

    const finalMsg = await harness.prompt('Load skill s1')
    expect(finalMsg.content).toEqual([{ type: 'text', text: 'Final answer' }])

    // Turn 1 had only read_skill; Turn 2 had read_skill + bash
    expect(capturedContexts).toHaveLength(2)
    expect(getCurrentSystemPrompt(capturedContexts[0].messages)).toBe('You are a helpful agent.')
    expect(getCurrentTools(capturedContexts[0].messages).map((t) => t.name)).toEqual(['read_skill'])
    expect(getCurrentTools(capturedContexts[1].messages).map((t) => t.name)).toEqual([
      'read_skill',
      'bash',
    ])

    // Reasoning clamped from 'max' to 'high' because baseModel has no thinkingLevelMap for 'max'
    expect(capturedOptions[0]?.reasoning).toBe('high')
    // Client attribution suppressed
    expect(capturedOptions[0]?.identity).toEqual({ attribution: null })

    // Verify Session persisted user, assistant, toolResult, active_tools_change, assistant — and NO system messages
    const savedEntries = await session.getEntries()
    const messageRoles = savedEntries
      .filter((e): e is Extract<SessionTreeEntry, { type: 'message' }> => e.type === 'message')
      .map((e) => e.message.role)
    expect(messageRoles).toEqual(['user', 'assistant', 'toolResult', 'assistant'])
    expect(savedEntries.some((e) => e.type === 'active_tools_change')).toBe(true)
  })

  it('runs context hooks and converts custom/summary/bashExecution messages in convertToLlm', async () => {
    const converted = convertToLlm([
      {
        role: 'custom',
        customType: 'shumai_message',
        content: 'Hello custom',
        display: true,
        timestamp: 1,
      },
      {
        role: 'branchSummary',
        summary: 'branch info',
        fromId: 'e1',
        timestamp: 2,
      },
      {
        role: 'compactionSummary',
        summary: 'compact info',
        tokensBefore: 100,
        timestamp: 3,
      },
      {
        role: 'bashExecution',
        command: 'ls',
        output: 'file.txt',
        exitCode: 0,
        cancelled: false,
        truncated: false,
        timestamp: 4,
      },
      {
        role: 'bashExecution',
        command: 'secret',
        output: 'hidden',
        exitCode: 0,
        cancelled: false,
        truncated: false,
        excludeFromContext: true,
        timestamp: 5,
      },
    ])

    expect(converted).toHaveLength(4)
    expect(converted.every((m) => m.role === 'user')).toBe(true)
  })
})
