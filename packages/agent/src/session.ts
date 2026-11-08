import type { AgentMessage } from '@earendil-works/pi-agent-core'
import type { ImageContent, TextContent, Usage } from '@earendil-works/pi-ai'
import type {
  ActiveToolsChangeEntry,
  BranchSummaryEntry,
  BranchSummaryMessage,
  CompactionEntry,
  CompactionSummaryMessage,
  CustomEntry,
  CustomMessage,
  CustomMessageEntry,
  LabelEntry,
  MessageEntry,
  ModelChangeEntry,
  SessionContext,
  SessionEntryCursorOptions,
  SessionInfoEntry,
  SessionMetadata,
  SessionStats,
  SessionStorage,
  SessionTreeEntry,
  ThinkingLevelChangeEntry,
} from '@shumai/dtos'

export type {
  ActiveToolsChangeEntry,
  BranchSummaryEntry,
  BranchSummaryMessage,
  CompactionEntry,
  CompactionSummaryMessage,
  CustomEntry,
  CustomMessage,
  CustomMessageEntry,
  LabelEntry,
  MessageEntry,
  ModelChangeEntry,
  SessionContext,
  SessionEntryCursorOptions,
  SessionInfoEntry,
  SessionMetadata,
  SessionStats,
  SessionStorage,
  SessionTreeEntry,
  ThinkingLevelChangeEntry,
}

export type SessionErrorCode = 'invalid_input' | 'not_found'

export class SessionError extends Error {
  readonly code: SessionErrorCode

  constructor(code: SessionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.code = code
    this.name = 'SessionError'
  }
}

export type ContextEntryTransform = (entry: SessionTreeEntry) => AgentMessage[]

export interface SessionOptions {
  contextEntryTransform?: ContextEntryTransform
}

export function createBranchSummaryMessage(
  summary: string,
  fromId: string,
  timestamp: string,
): BranchSummaryMessage {
  return {
    role: 'branchSummary',
    summary,
    fromId,
    timestamp: new Date(timestamp).getTime(),
  }
}

export function createCompactionSummaryMessage(
  summary: string,
  tokensBefore: number,
  timestamp: string,
): CompactionSummaryMessage {
  return {
    role: 'compactionSummary',
    summary,
    tokensBefore,
    timestamp: new Date(timestamp).getTime(),
  }
}

export function createCustomMessage<T = unknown>(
  customType: string,
  content: string | (TextContent | ImageContent)[],
  display: boolean,
  details: T | undefined,
  timestamp: string,
): CustomMessage<T> {
  return {
    role: 'custom',
    customType,
    content,
    display,
    details,
    timestamp: new Date(timestamp).getTime(),
  }
}

export function defaultContextEntryTransform(entry: SessionTreeEntry): AgentMessage[] {
  switch (entry.type) {
    case 'message':
      return [entry.message]
    case 'custom_message':
      return [
        createCustomMessage(
          entry.customType,
          entry.content,
          entry.display,
          entry.details,
          entry.timestamp,
        ),
      ]
    case 'branch_summary':
      return [createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp)]
    case 'compaction': {
      const summary = createCompactionSummaryMessage(
        entry.summary,
        entry.tokensBefore,
        entry.timestamp,
      )
      return entry.retainedTail && entry.retainedTail.length > 0
        ? [summary, ...entry.retainedTail]
        : [summary]
    }
    case 'thinking_level_change':
    case 'model_change':
    case 'active_tools_change':
    case 'custom':
    case 'label':
    case 'session_info':
    case 'leaf':
      return []
  }
}

export function buildContextEntries(
  path: SessionTreeEntry[],
  transform: ContextEntryTransform = defaultContextEntryTransform,
): {
  messages: AgentMessage[]
  compaction: CompactionEntry | null
  startIndex: number
} {
  if (path.length === 0) {
    return { messages: [], compaction: null, startIndex: 0 }
  }

  let compactionIndex = -1
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].type === 'compaction') {
      compactionIndex = i
      break
    }
  }

  const messages: AgentMessage[] = []
  const appendFromEntry = (entry: SessionTreeEntry) => {
    messages.push(...transform(entry))
  }

  if (compactionIndex === -1) {
    for (const entry of path) {
      appendFromEntry(entry)
    }
    return { messages, compaction: null, startIndex: 0 }
  }

  const compaction = path[compactionIndex] as CompactionEntry
  appendFromEntry(compaction)

  let startIndex = compactionIndex + 1
  if (compaction.firstKeptEntryId) {
    let foundFirstKept = false
    for (let i = 0; i < compactionIndex; i++) {
      const entry = path[i]
      if (entry.id === compaction.firstKeptEntryId) {
        foundFirstKept = true
      }
      if (foundFirstKept) {
        appendFromEntry(entry)
      }
    }
    startIndex = compactionIndex + 1
  }

  for (let i = startIndex; i < path.length; i++) {
    appendFromEntry(path[i])
  }

  return { messages, compaction, startIndex }
}

export function sessionEntryToContextMessages(entry: SessionTreeEntry): AgentMessage[] {
  return defaultContextEntryTransform(entry)
}

export function buildSessionContext(
  entries: SessionTreeEntry[],
  leafId?: string | null,
  byId?: Map<string, SessionTreeEntry>,
  transform: ContextEntryTransform = defaultContextEntryTransform,
): SessionContext {
  if (!byId) {
    byId = new Map<string, SessionTreeEntry>()
    for (const entry of entries) {
      byId.set(entry.id, entry)
    }
  }

  let leaf: SessionTreeEntry | undefined
  if (leafId === null) {
    return { messages: [], thinkingLevel: 'off', model: null, activeToolNames: null }
  }
  if (leafId) {
    leaf = byId.get(leafId)
  }
  if (!leaf) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (entry.type === 'leaf') {
        leaf = entry.targetId ? byId.get(entry.targetId) : undefined
        break
      }
      if (entry.type !== 'label' && entry.type !== 'session_info') {
        leaf = entry
        break
      }
    }
  }

  if (!leaf) {
    return { messages: [], thinkingLevel: 'off', model: null, activeToolNames: null }
  }

  const path: SessionTreeEntry[] = []
  let current: SessionTreeEntry | undefined = leaf
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }

  let thinkingLevel = 'off'
  let model: { provider: string; modelId: string } | null = null
  let activeToolNames: string[] | null = null

  for (const entry of path) {
    if (entry.type === 'thinking_level_change') {
      thinkingLevel = entry.thinkingLevel
    } else if (entry.type === 'model_change') {
      model = { provider: entry.provider, modelId: entry.modelId }
    } else if (entry.type === 'active_tools_change') {
      activeToolNames = [...entry.activeToolNames]
    } else if (entry.type === 'message' && entry.message.role === 'assistant') {
      model = { provider: entry.message.provider, modelId: entry.message.model }
    }
  }

  const { messages } = buildContextEntries(path, transform)
  return { messages, thinkingLevel, model, activeToolNames }
}

export class Session<TMetadata extends SessionMetadata = SessionMetadata> {
  private readonly storage: SessionStorage<TMetadata>
  private readonly contextEntryTransform: ContextEntryTransform

  constructor(storage: SessionStorage<TMetadata>, options: SessionOptions = {}) {
    this.storage = storage
    this.contextEntryTransform = options.contextEntryTransform ?? defaultContextEntryTransform
  }

  getStorage(): SessionStorage<TMetadata> {
    return this.storage
  }

  async getMetadata(): Promise<TMetadata> {
    return await this.storage.getMetadata()
  }

  async getSessionId(): Promise<string> {
    return (await this.storage.getMetadata()).id
  }

  async getLeafId(): Promise<string | null> {
    return await this.storage.getLeafId()
  }

  async getLeafEntry(): Promise<SessionTreeEntry | undefined> {
    const leafId = await this.storage.getLeafId()
    return leafId ? await this.storage.getEntry(leafId) : undefined
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    return await this.storage.getEntry(id)
  }

  async getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]> {
    return await this.storage.getEntries(options)
  }

  async findEntries<TType extends SessionTreeEntry['type']>(
    type: TType,
  ): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
    return await this.storage.findEntries(type)
  }

  async getLabel(id: string): Promise<string | undefined> {
    return await this.storage.getLabel(id)
  }

  async getSessionName(): Promise<string | undefined> {
    return await this.storage.getSessionName()
  }

  async getSessionStats(): Promise<SessionStats> {
    return await this.storage.getSessionStats()
  }

  async getBranch(fromId?: string): Promise<SessionTreeEntry[]> {
    const startId = fromId !== undefined ? fromId : await this.storage.getLeafId()
    return await this.storage.getPathToRootOrCompaction(startId)
  }

  async buildContext(leafId?: string | null): Promise<SessionContext> {
    const targetLeafId = leafId !== undefined ? leafId : await this.storage.getLeafId()
    if (targetLeafId === null) {
      return { messages: [], thinkingLevel: 'off', model: null, activeToolNames: null }
    }

    const path = await this.storage.getPathToRootOrCompaction(targetLeafId)
    if (path.length === 0) {
      return { messages: [], thinkingLevel: 'off', model: null, activeToolNames: null }
    }

    const byId = new Map(path.map((entry) => [entry.id, entry]))
    return buildSessionContext(
      path,
      path[path.length - 1]?.id ?? null,
      byId,
      this.contextEntryTransform,
    )
  }

  private async appendLeafEntry<TEntry extends SessionTreeEntry>(
    createEntry: (base: { id: string; parentId: string | null; timestamp: string }) => TEntry,
  ): Promise<string> {
    const id = await this.storage.createEntryId()
    const parentId = await this.storage.getLeafId()
    const timestamp = new Date().toISOString()
    const entry = createEntry({ id, parentId, timestamp })
    await this.storage.appendEntry(entry)
    return id
  }

  async appendMessage(message: AgentMessage): Promise<string> {
    return await this.appendLeafEntry(({ id, parentId, timestamp }): MessageEntry => ({
      type: 'message',
      id,
      parentId,
      timestamp,
      message,
    }))
  }

  async appendThinkingLevelChange(thinkingLevel: string): Promise<string> {
    return await this.appendLeafEntry(({ id, parentId, timestamp }): ThinkingLevelChangeEntry => ({
      type: 'thinking_level_change',
      id,
      parentId,
      timestamp,
      thinkingLevel,
    }))
  }

  async appendModelChange(provider: string, modelId: string): Promise<string> {
    return await this.appendLeafEntry(({ id, parentId, timestamp }): ModelChangeEntry => ({
      type: 'model_change',
      id,
      parentId,
      timestamp,
      provider,
      modelId,
    }))
  }

  async appendActiveToolsChange(activeToolNames: string[]): Promise<string> {
    return await this.appendLeafEntry(({ id, parentId, timestamp }): ActiveToolsChangeEntry => ({
      type: 'active_tools_change',
      id,
      parentId,
      timestamp,
      activeToolNames: [...activeToolNames],
    }))
  }

  async appendCompaction<T = unknown>(
    summary: string,
    firstKeptEntryIdOrTokensBefore?: string | number,
    tokensBeforeOrDetails?: number | T,
    details?: T,
    fromHook?: boolean,
    retainedTail?: AgentMessage[],
    usage?: Usage,
  ): Promise<string> {
    const isLegacySignature = typeof firstKeptEntryIdOrTokensBefore === 'string'
    const firstKeptEntryId = isLegacySignature ? firstKeptEntryIdOrTokensBefore : undefined
    const tokensBefore = isLegacySignature
      ? (tokensBeforeOrDetails as number)
      : (firstKeptEntryIdOrTokensBefore ?? 0)
    const resolvedDetails = isLegacySignature ? details : (tokensBeforeOrDetails as T | undefined)

    return await this.appendLeafEntry(({ id, parentId, timestamp }): CompactionEntry<T> => ({
      type: 'compaction',
      id,
      parentId,
      timestamp,
      summary,
      firstKeptEntryId,
      tokensBefore,
      retainedTail,
      details: resolvedDetails,
      usage,
      fromHook,
    }))
  }

  async appendCustomEntry<T = unknown>(customType: string, data?: T): Promise<string> {
    return await this.appendLeafEntry(({ id, parentId, timestamp }): CustomEntry<T> => ({
      type: 'custom',
      id,
      parentId,
      timestamp,
      customType,
      data,
    }))
  }

  async appendSessionInfo(name: string): Promise<string> {
    const id = await this.storage.createEntryId()
    const parentId = await this.storage.getLeafId()
    const entry: SessionInfoEntry = {
      type: 'session_info',
      id,
      parentId,
      timestamp: new Date().toISOString(),
      name: name.trim(),
    }
    await this.storage.appendEntry(entry)
    return id
  }

  async appendCustomMessageEntry<T = unknown>(
    customType: string,
    content: string | (TextContent | ImageContent)[],
    display: boolean,
    details?: T,
  ): Promise<string> {
    return await this.appendLeafEntry(({ id, parentId, timestamp }): CustomMessageEntry<T> => ({
      type: 'custom_message',
      id,
      parentId,
      timestamp,
      customType,
      content,
      display,
      details,
    }))
  }

  async appendLabelChange(targetId: string, label: string | undefined): Promise<string> {
    const target = await this.storage.getEntry(targetId)
    if (!target) {
      throw new SessionError('not_found', `Entry ${targetId} not found`)
    }

    const id = await this.storage.createEntryId()
    const parentId = await this.storage.getLeafId()
    const entry: LabelEntry = {
      type: 'label',
      id,
      parentId,
      timestamp: new Date().toISOString(),
      targetId,
      label,
    }
    await this.storage.appendEntry(entry)
    return id
  }

  async branch(branchFromId: string): Promise<void> {
    const target = await this.storage.getEntry(branchFromId)
    if (!target) {
      throw new SessionError('not_found', `Entry ${branchFromId} not found`)
    }
    await this.storage.setLeafId(branchFromId)
  }

  async resetLeaf(): Promise<void> {
    await this.storage.setLeafId(null)
  }

  async branchWithSummary<T = unknown>(
    branchFromId: string | null,
    summary: string,
    details?: T,
    fromHook?: boolean,
    usage?: Usage,
  ): Promise<string> {
    if (branchFromId !== null) {
      const target = await this.storage.getEntry(branchFromId)
      if (!target) {
        throw new SessionError('not_found', `Entry ${branchFromId} not found`)
      }
    }

    const currentLeafId = await this.storage.getLeafId()
    await this.storage.setLeafId(branchFromId)
    const id = await this.storage.createEntryId()
    const entry: BranchSummaryEntry<T> = {
      type: 'branch_summary',
      id,
      parentId: branchFromId,
      timestamp: new Date().toISOString(),
      fromId: currentLeafId ?? 'root',
      summary,
      details,
      usage,
      fromHook,
    }
    await this.storage.appendEntry(entry)
    return id
  }
}
