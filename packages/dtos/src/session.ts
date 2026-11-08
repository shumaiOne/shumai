import type { ImageContent, TextContent, Usage } from '@earendil-works/pi-ai'
import type { AgentMessage } from '@earendil-works/pi-agent-core'

export interface BashExecutionMessage {
  role: 'bashExecution'
  command: string
  output: string
  exitCode: number | undefined
  cancelled: boolean
  truncated: boolean
  fullOutputPath?: string
  timestamp: number
  excludeFromContext?: boolean
}

export interface CustomMessage<T = unknown> {
  role: 'custom'
  customType: string
  content: string | (TextContent | ImageContent)[]
  display: boolean
  details?: T
  timestamp: number
}

export interface BranchSummaryMessage {
  role: 'branchSummary'
  summary: string
  fromId: string
  timestamp: number
}

export interface CompactionSummaryMessage {
  role: 'compactionSummary'
  summary: string
  tokensBefore: number
  timestamp: number
}

declare module '@earendil-works/pi-agent-core' {
  interface CustomAgentMessages {
    bashExecution: BashExecutionMessage
    custom: CustomMessage
    branchSummary: BranchSummaryMessage
    compactionSummary: CompactionSummaryMessage
  }
}

export interface SessionTreeEntryBase {
  type: string
  id: string
  parentId: string | null
  timestamp: string
}

export interface MessageEntry extends SessionTreeEntryBase {
  type: 'message'
  message: AgentMessage
}

export interface ThinkingLevelChangeEntry extends SessionTreeEntryBase {
  type: 'thinking_level_change'
  thinkingLevel: string
}

export interface ModelChangeEntry extends SessionTreeEntryBase {
  type: 'model_change'
  provider: string
  modelId: string
}

export interface ActiveToolsChangeEntry extends SessionTreeEntryBase {
  type: 'active_tools_change'
  activeToolNames: string[]
}

export interface CompactionEntry<T = unknown> extends SessionTreeEntryBase {
  type: 'compaction'
  summary: string
  firstKeptEntryId?: string
  tokensBefore: number
  retainedTail?: AgentMessage[]
  details?: T
  usage?: Usage
  fromHook?: boolean
}

export interface BranchSummaryEntry<T = unknown> extends SessionTreeEntryBase {
  type: 'branch_summary'
  fromId: string
  summary: string
  details?: T
  usage?: Usage
  fromHook?: boolean
}

export interface CustomEntry<T = unknown> extends SessionTreeEntryBase {
  type: 'custom'
  customType: string
  data?: T
}

export interface CustomMessageEntry<T = unknown> extends SessionTreeEntryBase {
  type: 'custom_message'
  customType: string
  content: string | (TextContent | ImageContent)[]
  details?: T
  display: boolean
}

export interface LabelEntry extends SessionTreeEntryBase {
  type: 'label'
  targetId: string
  label: string | undefined
}

export interface SessionInfoEntry extends SessionTreeEntryBase {
  type: 'session_info'
  name?: string
}

export interface LeafEntry extends SessionTreeEntryBase {
  type: 'leaf'
  targetId: string | null
}

export type SessionTreeEntry =
  | MessageEntry
  | ThinkingLevelChangeEntry
  | ModelChangeEntry
  | ActiveToolsChangeEntry
  | CompactionEntry
  | BranchSummaryEntry
  | CustomEntry
  | CustomMessageEntry
  | LabelEntry
  | SessionInfoEntry
  | LeafEntry

export interface SessionContext {
  messages: AgentMessage[]
  thinkingLevel: string
  model: {
    provider: string
    modelId: string
  } | null
  activeToolNames: string[] | null
}

export interface SessionStats {
  messageCount: number
  cachedTokens: number
  uncachedTokens: number
  totalTokens: number
  costTotal: number
}

export interface SessionMetadata {
  id: string
  createdAt: string
}

export interface SessionEntryCursorOptions {
  afterEntrySeq?: number
  limit?: number
}

export interface SessionStorage<TMetadata extends SessionMetadata = SessionMetadata> {
  getMetadata(): Promise<TMetadata>
  getLeafId(): Promise<string | null>
  setLeafId(leafId: string | null): Promise<void>
  createEntryId(): Promise<string>
  appendEntry(entry: SessionTreeEntry): Promise<void>
  getEntry(id: string): Promise<SessionTreeEntry | undefined>
  findEntries<TType extends SessionTreeEntry['type']>(
    type: TType,
  ): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>>
  getLabel(id: string): Promise<string | undefined>
  getSessionName(): Promise<string | undefined>
  getSessionStats(): Promise<SessionStats>
  getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]>
  getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]>
}
