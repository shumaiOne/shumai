import {
  runAgentLoop,
  type AfterToolCallContext,
  type AfterToolCallResult,
  type AgentContext,
  type AgentEvent,
  type AgentLoopConfig,
  type AgentLoopTurnUpdate,
  type AgentMessage,
  type AgentTool,
  type AgentToolCall,
  type BeforeToolCallContext,
  type BeforeToolCallResult,
  type PrepareNextTurnContext,
  type QueueMode,
  type StreamFn,
  type ThinkingLevel,
  type ToolExecutionMode,
} from '@earendil-works/pi-agent-core'
import {
  clampThinkingLevel,
  contentText,
  createInitialSystemMessage,
  toToolDeclaration,
  type Api,
  type AssistantMessage,
  type ImageContent,
  type Message,
  type Model,
  type Models,
  type SimpleStreamOptions,
  type SystemMessage,
  type TextContent,
  type ToolResultMessage,
  type Usage,
  type UserMessage,
} from '@earendil-works/pi-ai'
import type { BashExecutionMessage } from '@shumai/dtos'
import { Session, type CompactionEntry, type SessionMetadata } from './session'

export type AgentHarnessErrorCode =
  'busy' | 'invalid_input' | 'aborted' | 'compaction_failed' | 'run_failed'

export class AgentHarnessError extends Error {
  readonly code: AgentHarnessErrorCode

  constructor(code: AgentHarnessErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.code = code
    this.name = 'AgentHarnessError'
  }
}

export type AgentHarnessStreamOptions = Omit<SimpleStreamOptions, 'reasoning' | 'signal'>

export interface AgentHarnessPromptOptions {
  images?: ImageContent[]
}

export interface AgentHarnessBeforeAgentStartEvent {
  type: 'before_agent_start'
  prompt: string
  images?: ImageContent[]
  message: UserMessage
  systemPrompt: string
}

export interface AgentHarnessBeforeAgentStartResult {
  message?: UserMessage
  systemPrompt?: string
}

export interface AgentHarnessContextEvent {
  type: 'context'
  messages: AgentMessage[]
}

export interface AgentHarnessContextResult {
  messages?: AgentMessage[]
}

export interface AgentHarnessBeforeProviderRequestEvent {
  type: 'before_provider_request'
  payload: unknown
  model: Model<Api>
}

export type AgentHarnessBeforeProviderRequestResult = unknown

export interface AgentHarnessToolCallEvent {
  type: 'tool_call'
  assistantMessage: AssistantMessage
  toolCall: AgentToolCall
  args: unknown
  context: AgentContext
}

export type AgentHarnessToolCallResult = BeforeToolCallResult

export interface AgentHarnessToolResultEvent {
  type: 'tool_result'
  assistantMessage: AssistantMessage
  toolCall: AgentToolCall
  args: unknown
  result: AfterToolCallContext['result']
  isError: boolean
  context: AgentContext
}

export type AgentHarnessToolResultOverride = AfterToolCallResult

export interface AgentHarnessTurnStartEvent {
  type: 'turn_start'
  turnIndex: number
  timestamp: number
}

export interface AgentHarnessTurnEndEvent {
  type: 'turn_end'
  turnIndex: number
  message: AgentMessage
  toolResults: ToolResultMessage[]
}

export interface AgentHarnessAgentStartEvent {
  type: 'agent_start'
}

export interface AgentHarnessAgentEndEvent {
  type: 'agent_end'
  messages: AgentMessage[]
}

export interface AgentHarnessMessageStartEvent {
  type: 'message_start'
  message: AgentMessage
}

export interface AgentHarnessMessageUpdateEvent {
  type: 'message_update'
  message: AgentMessage
  assistantMessageEvent: Extract<AgentEvent, { type: 'message_update' }>['assistantMessageEvent']
}

export interface AgentHarnessMessageEndEvent {
  type: 'message_end'
  message: AgentMessage
}

export interface AgentHarnessToolExecutionStartEvent {
  type: 'tool_execution_start'
  toolCallId: string
  toolName: string
  args: unknown
}

export interface AgentHarnessToolExecutionUpdateEvent {
  type: 'tool_execution_update'
  toolCallId: string
  toolName: string
  args: unknown
  partialResult: unknown
}

export interface AgentHarnessToolExecutionEndEvent {
  type: 'tool_execution_end'
  toolCallId: string
  toolName: string
  result: unknown
  isError: boolean
  durationMs?: number
}

/* eslint-disable @typescript-eslint/naming-convention -- hook event names follow snake_case event identifiers */
export interface AgentHarnessHookMap {
  before_agent_start: {
    event: AgentHarnessBeforeAgentStartEvent
    result: AgentHarnessBeforeAgentStartResult | void
  }
  context: {
    event: AgentHarnessContextEvent
    result: AgentHarnessContextResult | void
  }
  before_provider_request: {
    event: AgentHarnessBeforeProviderRequestEvent
    result: AgentHarnessBeforeProviderRequestResult | void
  }
  tool_call: {
    event: AgentHarnessToolCallEvent
    result: AgentHarnessToolCallResult | void
  }
  tool_result: {
    event: AgentHarnessToolResultEvent
    result: AgentHarnessToolResultOverride | void
  }
  agent_start: {
    event: AgentHarnessAgentStartEvent
    result: void
  }
  agent_end: {
    event: AgentHarnessAgentEndEvent
    result: void
  }
  turn_start: {
    event: AgentHarnessTurnStartEvent
    result: void
  }
  turn_end: {
    event: AgentHarnessTurnEndEvent
    result: void
  }
  message_start: {
    event: AgentHarnessMessageStartEvent
    result: void
  }
  message_update: {
    event: AgentHarnessMessageUpdateEvent
    result: void
  }
  message_end: {
    event: AgentHarnessMessageEndEvent
    result: void
  }
  tool_execution_start: {
    event: AgentHarnessToolExecutionStartEvent
    result: void
  }
  tool_execution_update: {
    event: AgentHarnessToolExecutionUpdateEvent
    result: void
  }
  tool_execution_end: {
    event: AgentHarnessToolExecutionEndEvent
    result: void
  }
}
/* eslint-enable @typescript-eslint/naming-convention */

export type AgentHarnessHookType = keyof AgentHarnessHookMap

export interface AgentHarnessHookContext<TMetadata extends SessionMetadata = SessionMetadata> {
  harness: AgentHarness<TMetadata>
  session: Session<TMetadata>
  model: Model<Api>
  thinkingLevel: ThinkingLevel
  signal?: AbortSignal
}

export type AgentHarnessHookHandler<
  TType extends AgentHarnessHookType,
  TMetadata extends SessionMetadata = SessionMetadata,
> = (
  event: AgentHarnessHookMap[TType]['event'],
  context: AgentHarnessHookContext<TMetadata>,
) => Promise<AgentHarnessHookMap[TType]['result']> | AgentHarnessHookMap[TType]['result']

export type AgentHarnessEvent =
  | AgentEvent
  | { type: 'compaction_start'; reason: 'manual' | 'overflow' }
  | {
      type: 'compaction_end'
      reason: 'manual' | 'overflow'
      entry?: CompactionEntry
      aborted: boolean
      errorMessage?: string
    }

export interface AgentHarnessOptions<TMetadata extends SessionMetadata = SessionMetadata> {
  session: Session<TMetadata>
  models: Models
  model: Model<Api>
  thinkingLevel?: ThinkingLevel
  systemPrompt?: string | (() => string | Promise<string>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
  tools?: AgentTool<any>[]
  activeToolNames?: string[]
  convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>
  streamFn?: StreamFn
  streamOptions?: AgentHarnessStreamOptions
  toolExecution?: ToolExecutionMode
  steeringMode?: QueueMode
  followUpMode?: QueueMode
}

export const COMPACTION_SUMMARY_PREFIX =
  'The conversation history before this point was compacted into the following summary:\n\n<summary>\n'
export const COMPACTION_SUMMARY_SUFFIX = '\n</summary>'
export const BRANCH_SUMMARY_PREFIX =
  'The following is a summary of a branch that this conversation came back from:\n\n<summary>\n'
export const BRANCH_SUMMARY_SUFFIX = '</summary>'

export function bashExecutionToText(msg: BashExecutionMessage): string {
  let text = `Ran \`${msg.command}\`\n`
  if (msg.output) {
    text += `\`\`\`\n${msg.output}\n\`\`\``
  } else {
    text += '(no output)'
  }
  if (msg.cancelled) {
    text += '\n\n(command cancelled)'
  } else if (msg.exitCode !== null && msg.exitCode !== undefined && msg.exitCode !== 0) {
    text += `\n\nCommand exited with code ${msg.exitCode}`
  }
  if (msg.truncated && msg.fullOutputPath) {
    text += `\n\n[Output truncated. Full output: ${msg.fullOutputPath}]`
  }
  return text
}

export function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages
    .map((m): Message | undefined => {
      switch (m.role) {
        case 'bashExecution':
          if (m.excludeFromContext) {
            return undefined
          }
          return {
            role: 'user',
            content: [{ type: 'text', text: bashExecutionToText(m) }],
            timestamp: m.timestamp,
          }
        case 'custom': {
          const content =
            typeof m.content === 'string' ? [{ type: 'text' as const, text: m.content }] : m.content
          return {
            role: 'user',
            content,
            timestamp: m.timestamp,
          }
        }
        case 'branchSummary':
          return {
            role: 'user',
            content: [
              {
                type: 'text',
                text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX,
              },
            ],
            timestamp: m.timestamp,
          }
        case 'compactionSummary':
          return {
            role: 'user',
            content: [
              {
                type: 'text',
                text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX,
              },
            ],
            timestamp: m.timestamp,
          }
        case 'system':
        case 'user':
        case 'assistant':
        case 'toolResult':
          return m
        default: {
          const _exhaustiveCheck: never = m
          return _exhaustiveCheck
        }
      }
    })
    .filter((m): m is Message => m !== undefined)
}

function createZeroUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

function buildPromptMessage(text: string, images?: ImageContent[]): UserMessage {
  const content: (TextContent | ImageContent)[] = [{ type: 'text', text }]
  if (images && images.length > 0) {
    content.push(...images)
  }
  return {
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

export class AgentHarness<TMetadata extends SessionMetadata = SessionMetadata> {
  private readonly session: Session<TMetadata>
  private readonly models: Models
  private model: Model<Api>
  private thinkingLevel: ThinkingLevel
  private hasExplicitThinkingLevel: boolean
  private systemPrompt: string | (() => string | Promise<string>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
  private toolRegistry = new Map<string, AgentTool<any>>()
  private activeToolNames: string[] | null
  private readonly convertToLlmFn: (messages: AgentMessage[]) => Message[] | Promise<Message[]>
  private readonly streamFn: StreamFn
  private streamOptions: AgentHarnessStreamOptions | undefined
  private toolExecution: ToolExecutionMode
  private steeringMode: QueueMode
  private followUpMode: QueueMode
  private steeringQueue: AgentMessage[] = []
  private followUpQueue: AgentMessage[] = []
  private listeners = new Set<(event: AgentHarnessEvent) => void | Promise<void>>()
  private hooks = new Map<
    AgentHarnessHookType,
    Set<AgentHarnessHookHandler<AgentHarnessHookType, TMetadata>>
  >()
  private runningPrompt: Promise<void> | undefined
  private abortController: AbortController | undefined
  private pendingSessionWrites: Array<() => Promise<void>> = []

  constructor(options: AgentHarnessOptions<TMetadata>) {
    this.session = options.session
    this.models = options.models
    this.model = options.model
    this.thinkingLevel = options.thinkingLevel ?? 'off'
    this.hasExplicitThinkingLevel = options.thinkingLevel !== undefined
    this.systemPrompt = options.systemPrompt ?? ''
    this.convertToLlmFn = options.convertToLlm ?? convertToLlm
    this.streamFn =
      options.streamFn ??
      ((model, context, streamOpts) => this.models.streamSimple(model, context, streamOpts))
    this.streamOptions = options.streamOptions
    this.toolExecution = options.toolExecution ?? 'parallel'
    this.steeringMode = options.steeringMode ?? 'one-at-a-time'
    this.followUpMode = options.followUpMode ?? 'one-at-a-time'
    for (const tool of options.tools ?? []) {
      this.toolRegistry.set(tool.name, tool)
    }
    this.activeToolNames = options.activeToolNames ? [...options.activeToolNames] : null
  }

  getSession(): Session<TMetadata> {
    return this.session
  }

  getModel(): Model<Api> {
    return this.model
  }

  async setModel(model: Model<Api>): Promise<void> {
    this.model = model
    await this.recordOrQueueSessionWrite(async () => {
      await this.session.appendModelChange(model.provider, model.id)
    })
  }

  getThinkingLevel(): ThinkingLevel {
    return this.thinkingLevel
  }

  async setThinkingLevel(thinkingLevel: ThinkingLevel): Promise<void> {
    this.thinkingLevel = thinkingLevel
    this.hasExplicitThinkingLevel = true
    await this.recordOrQueueSessionWrite(async () => {
      await this.session.appendThinkingLevelChange(thinkingLevel)
    })
  }

  getSystemPrompt(): string | (() => string | Promise<string>) {
    return this.systemPrompt
  }

  setSystemPrompt(systemPrompt: string | (() => string | Promise<string>)): void {
    this.systemPrompt = systemPrompt
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
  getTools(): AgentTool<any>[] {
    return Array.from(this.toolRegistry.values())
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
  async setTools(tools: AgentTool<any>[], activeToolNames?: string[]): Promise<void> {
    this.toolRegistry = new Map(tools.map((tool) => [tool.name, tool]))
    if (activeToolNames !== undefined) {
      await this.setActiveTools(activeToolNames)
    } else if (this.activeToolNames !== null) {
      this.activeToolNames = this.activeToolNames.filter((name) => this.toolRegistry.has(name))
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
  getActiveTools(): AgentTool<any>[] {
    return this.resolveActiveTools()
  }

  async setActiveTools(toolNames: string[]): Promise<void> {
    const validNames = toolNames.filter((name) => this.toolRegistry.has(name))
    this.activeToolNames = [...validNames]
    await this.recordOrQueueSessionWrite(async () => {
      await this.session.appendActiveToolsChange(validNames)
    })
  }

  getStreamOptions(): AgentHarnessStreamOptions | undefined {
    return this.streamOptions ? { ...this.streamOptions } : undefined
  }

  setStreamOptions(streamOptions: AgentHarnessStreamOptions | undefined): void {
    this.streamOptions = streamOptions ? { ...streamOptions } : undefined
  }

  subscribe(listener: (event: AgentHarnessEvent) => void | Promise<void>): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  on<TType extends AgentHarnessHookType>(
    type: TType,
    handler: AgentHarnessHookHandler<TType, TMetadata>,
  ): () => void {
    let handlers = this.hooks.get(type)
    if (!handlers) {
      handlers = new Set()
      this.hooks.set(type, handlers)
    }
    const typedHandler = handler as unknown as AgentHarnessHookHandler<
      AgentHarnessHookType,
      TMetadata
    >
    handlers.add(typedHandler)
    return () => {
      handlers?.delete(typedHandler)
    }
  }

  steer(message: AgentMessage): void {
    this.steeringQueue.push(message)
  }

  followUp(message: AgentMessage): void {
    this.followUpQueue.push(message)
  }

  clearSteeringQueue(): void {
    this.steeringQueue = []
  }

  clearFollowUpQueue(): void {
    this.followUpQueue = []
  }

  clearAllQueues(): void {
    this.clearSteeringQueue()
    this.clearFollowUpQueue()
  }

  isRunning(): boolean {
    return this.runningPrompt !== undefined
  }

  abort(): void {
    this.abortController?.abort()
  }

  async waitForIdle(): Promise<void> {
    if (this.runningPrompt) {
      await this.runningPrompt
    }
  }

  async prompt(text: string, options?: AgentHarnessPromptOptions): Promise<AssistantMessage> {
    if (this.runningPrompt) {
      throw new AgentHarnessError(
        'busy',
        'AgentHarness is already running. Wait for completion or abort first.',
      )
    }
    let resolveRun: (() => void) | undefined
    this.runningPrompt = new Promise<void>((resolve) => {
      resolveRun = resolve
    })
    try {
      return await this.runPromptInternal(text, options)
    } finally {
      this.abortController = undefined
      this.pendingSessionWrites = []
      this.runningPrompt = undefined
      resolveRun?.()
    }
  }

  private async runPromptInternal(
    text: string,
    options?: AgentHarnessPromptOptions,
  ): Promise<AssistantMessage> {
    const abortController = new AbortController()
    this.abortController = abortController
    await this.syncStateFromSession()

    let promptMessage = buildPromptMessage(text, options?.images)
    let systemPrompt = await this.resolveSystemPrompt()

    const beforeStartResult = await this.runBeforeAgentStartHooks(
      {
        type: 'before_agent_start',
        prompt: text,
        images: options?.images,
        message: promptMessage,
        systemPrompt,
      },
      abortController.signal,
    )
    if (beforeStartResult.message) {
      promptMessage = beforeStartResult.message
    }
    if (beforeStartResult.systemPrompt !== undefined) {
      systemPrompt = beforeStartResult.systemPrompt
    }

    const sessionContext = await this.session.buildContext()
    const initialActiveTools = this.resolveActiveTools()
    const initialSystemMessage = createInitialSystemMessage(
      systemPrompt,
      initialActiveTools.map(toToolDeclaration),
    )
    const contextMessages: AgentMessage[] = initialSystemMessage
      ? [initialSystemMessage, ...sessionContext.messages]
      : [...sessionContext.messages]

    const context: AgentContext = {
      messages: contextMessages,
      tools: initialActiveTools,
    }

    const turnState = {
      model: this.model,
      thinkingLevel: this.thinkingLevel,
      turnIndex: -1,
    }

    let lastAssistantMessage: AssistantMessage | undefined
    const loopConfig = this.createLoopConfig({
      initialModel: this.model,
      initialThinkingLevel: this.thinkingLevel,
      signal: abortController.signal,
      turnState,
    })

    try {
      await runAgentLoop(
        [promptMessage],
        context,
        loopConfig,
        async (event) => {
          if (event.type === 'message_end' && event.message.role === 'assistant') {
            lastAssistantMessage = event.message
          }
          await this.handleAgentEvent(event, turnState, abortController.signal)
        },
        abortController.signal,
        this.streamFn,
      )
    } catch (error) {
      lastAssistantMessage = await this.emitRunFailure(
        turnState.model,
        error,
        abortController.signal.aborted,
        abortController.signal,
      )
    } finally {
      await this.flushPendingSessionWrites()
    }

    if (!lastAssistantMessage) {
      throw new AgentHarnessError('run_failed', 'Agent run finished without an assistant message')
    }
    return lastAssistantMessage
  }

  private createLoopConfig(params: {
    initialModel: Model<Api>
    initialThinkingLevel: ThinkingLevel
    signal: AbortSignal
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    }
  }): AgentLoopConfig {
    const { initialModel, initialThinkingLevel, signal, turnState } = params
    const effectiveInitialReasoning = clampThinkingLevel(initialModel, initialThinkingLevel)

    return {
      ...this.streamOptions,
      identity: this.streamOptions?.identity ?? { attribution: null },
      model: initialModel,
      reasoning: effectiveInitialReasoning === 'off' ? undefined : effectiveInitialReasoning,
      toolExecution: this.toolExecution,
      convertToLlm: async (messages) => await this.convertToLlmFn(messages),
      transformContext: async (messages, transformSignal) => {
        return await this.runContextHooks(messages, transformSignal ?? signal, turnState)
      },
      onPayload: async (payload, model) => {
        let currentPayload = payload
        if (this.streamOptions?.onPayload) {
          const updated = await this.streamOptions.onPayload(currentPayload, model)
          if (updated !== undefined) {
            currentPayload = updated
          }
        }
        return await this.runBeforeProviderRequestHooks(currentPayload, model, signal, turnState)
      },
      beforeToolCall: async (ctx, hookSignal) => {
        return await this.runToolCallHooks(ctx, hookSignal ?? signal, turnState)
      },
      afterToolCall: async (ctx, hookSignal) => {
        return await this.runToolResultHooks(ctx, hookSignal ?? signal, turnState)
      },
      prepareNextTurn: async (
        lastCompletedTurn: PrepareNextTurnContext,
      ): Promise<AgentLoopTurnUpdate> => {
        await this.flushPendingSessionWrites()
        const nextActiveTools = this.resolveActiveTools()
        const nextSystemPrompt = await this.resolveSystemPrompt()
        const nextMessages = [...lastCompletedTurn.context.messages]
        const firstMsg = nextMessages[0]
        if (firstMsg && firstMsg.role === 'system') {
          const currentPromptText = contentText(firstMsg.content)
          if (currentPromptText !== nextSystemPrompt) {
            nextMessages[0] = {
              ...firstMsg,
              content: nextSystemPrompt,
            }
          }
        } else if (nextSystemPrompt.length > 0 || nextActiveTools.length > 0) {
          const seeded = createInitialSystemMessage(
            nextSystemPrompt,
            nextActiveTools.map(toToolDeclaration),
          )
          if (seeded) {
            nextMessages.unshift(seeded)
          }
        }

        turnState.model = this.model
        turnState.thinkingLevel = this.thinkingLevel
        const clampedNextThinking = clampThinkingLevel(this.model, this.thinkingLevel)

        return {
          context: {
            messages: nextMessages,
            tools: nextActiveTools,
          },
          model: this.model,
          thinkingLevel: clampedNextThinking,
        }
      },
      getSteeringMessages: async () => this.dequeueSteeringMessages(),
      getFollowUpMessages: async () => this.dequeueFollowUpMessages(),
    }
  }

  private async handleAgentEvent(
    event: AgentEvent,
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
    signal: AbortSignal,
  ): Promise<void> {
    if (event.type === 'message_end' && event.message.role !== 'system') {
      await this.session.appendMessage(event.message)
    }

    await this.emitEvent(event)

    switch (event.type) {
      case 'agent_start':
        await this.runVoidHooks('agent_start', { type: 'agent_start' }, signal, turnState)
        break
      case 'agent_end':
        await this.runVoidHooks(
          'agent_end',
          { type: 'agent_end', messages: event.messages },
          signal,
          turnState,
        )
        break
      case 'turn_start':
        turnState.turnIndex += 1
        await this.runVoidHooks(
          'turn_start',
          { type: 'turn_start', turnIndex: turnState.turnIndex, timestamp: Date.now() },
          signal,
          turnState,
        )
        break
      case 'turn_end':
        await this.runVoidHooks(
          'turn_end',
          {
            type: 'turn_end',
            turnIndex: Math.max(0, turnState.turnIndex),
            message: event.message,
            toolResults: event.toolResults,
          },
          signal,
          turnState,
        )
        break
      case 'message_start':
        await this.runVoidHooks(
          'message_start',
          { type: 'message_start', message: event.message },
          signal,
          turnState,
        )
        break
      case 'message_update':
        await this.runVoidHooks(
          'message_update',
          {
            type: 'message_update',
            message: event.message,
            assistantMessageEvent: event.assistantMessageEvent,
          },
          signal,
          turnState,
        )
        break
      case 'message_end':
        await this.runVoidHooks(
          'message_end',
          { type: 'message_end', message: event.message },
          signal,
          turnState,
        )
        break
      case 'tool_execution_start':
        await this.runVoidHooks(
          'tool_execution_start',
          {
            type: 'tool_execution_start',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          },
          signal,
          turnState,
        )
        break
      case 'tool_execution_update':
        await this.runVoidHooks(
          'tool_execution_update',
          {
            type: 'tool_execution_update',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            partialResult: event.partialResult,
          },
          signal,
          turnState,
        )
        break
      case 'tool_execution_end':
        await this.runVoidHooks(
          'tool_execution_end',
          {
            type: 'tool_execution_end',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            result: event.result,
            isError: event.isError,
            durationMs: event.durationMs,
          },
          signal,
          turnState,
        )
        break
    }
  }

  private async emitRunFailure(
    model: Model<Api>,
    error: unknown,
    aborted: boolean,
    signal: AbortSignal,
  ): Promise<AssistantMessage> {
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? 'Agent run failed')
    const assistantMessage: AssistantMessage = {
      role: 'assistant',
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: createZeroUsage(),
      stopReason: aborted ? 'aborted' : 'error',
      errorMessage,
      timestamp: Date.now(),
    }
    const turnState = {
      model,
      thinkingLevel: this.thinkingLevel,
      turnIndex: 0,
    }
    await this.handleAgentEvent(
      { type: 'message_start', message: assistantMessage },
      turnState,
      signal,
    )
    await this.handleAgentEvent(
      { type: 'message_end', message: assistantMessage },
      turnState,
      signal,
    )
    await this.handleAgentEvent(
      { type: 'turn_end', message: assistantMessage, toolResults: [] },
      turnState,
      signal,
    )
    await this.handleAgentEvent(
      { type: 'agent_end', messages: [assistantMessage] },
      turnState,
      signal,
    )
    return assistantMessage
  }

  private async syncStateFromSession(): Promise<void> {
    const sessionContext = await this.session.buildContext()
    if (
      !this.hasExplicitThinkingLevel &&
      sessionContext.thinkingLevel &&
      sessionContext.thinkingLevel !== this.thinkingLevel
    ) {
      if (this.isThinkingLevel(sessionContext.thinkingLevel)) {
        this.thinkingLevel = sessionContext.thinkingLevel
      }
    }
    if (this.activeToolNames === null && sessionContext.activeToolNames !== null) {
      this.activeToolNames = sessionContext.activeToolNames.filter((name) =>
        this.toolRegistry.has(name),
      )
    }
  }

  private isThinkingLevel(value: string): value is ThinkingLevel {
    return (
      value === 'off' ||
      value === 'minimal' ||
      value === 'low' ||
      value === 'medium' ||
      value === 'high' ||
      value === 'xhigh' ||
      value === 'max'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
  private resolveActiveTools(): AgentTool<any>[] {
    if (this.activeToolNames === null) {
      return Array.from(this.toolRegistry.values())
    }
    const active: AgentTool<any>[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any -- AgentTool uses contravariant schema generics
    for (const name of this.activeToolNames) {
      const tool = this.toolRegistry.get(name)
      if (tool) {
        active.push(tool)
      }
    }
    return active
  }

  private async resolveSystemPrompt(): Promise<string> {
    if (typeof this.systemPrompt === 'function') {
      return await this.systemPrompt()
    }
    return this.systemPrompt
  }

  private dequeueSteeringMessages(): AgentMessage[] {
    if (this.steeringQueue.length === 0) {
      return []
    }
    if (this.steeringMode === 'one-at-a-time') {
      const first = this.steeringQueue.shift()
      return first ? [first] : []
    }
    const all = [...this.steeringQueue]
    this.steeringQueue = []
    return all
  }

  private dequeueFollowUpMessages(): AgentMessage[] {
    if (this.followUpQueue.length === 0) {
      return []
    }
    if (this.followUpMode === 'one-at-a-time') {
      const first = this.followUpQueue.shift()
      return first ? [first] : []
    }
    const all = [...this.followUpQueue]
    this.followUpQueue = []
    return all
  }

  private async recordOrQueueSessionWrite(write: () => Promise<void>): Promise<void> {
    if (this.runningPrompt) {
      this.pendingSessionWrites.push(write)
      return
    }
    await write()
  }

  private async flushPendingSessionWrites(): Promise<void> {
    if (this.pendingSessionWrites.length === 0) {
      return
    }
    const writes = [...this.pendingSessionWrites]
    this.pendingSessionWrites = []
    for (const write of writes) {
      await write()
    }
  }

  private createHookContext(
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
    signal?: AbortSignal,
  ): AgentHarnessHookContext<TMetadata> {
    return {
      harness: this,
      session: this.session,
      model: turnState.model,
      thinkingLevel: turnState.thinkingLevel,
      signal,
    }
  }

  private getHookHandlers<TType extends AgentHarnessHookType>(
    type: TType,
  ): Array<AgentHarnessHookHandler<TType, TMetadata>> {
    const handlers = this.hooks.get(type)
    if (!handlers || handlers.size === 0) {
      return []
    }
    return Array.from(handlers) as unknown as Array<AgentHarnessHookHandler<TType, TMetadata>>
  }

  private async runBeforeAgentStartHooks(
    initialEvent: AgentHarnessBeforeAgentStartEvent,
    signal?: AbortSignal,
  ): Promise<AgentHarnessBeforeAgentStartResult> {
    const handlers = this.getHookHandlers('before_agent_start')
    if (handlers.length === 0) {
      return {}
    }
    let currentMessage = initialEvent.message
    let currentSystemPrompt = initialEvent.systemPrompt
    const context = this.createHookContext(
      { model: this.model, thinkingLevel: this.thinkingLevel, turnIndex: 0 },
      signal,
    )
    for (const handler of handlers) {
      const result = await handler(
        {
          ...initialEvent,
          message: currentMessage,
          systemPrompt: currentSystemPrompt,
        },
        context,
      )
      if (result?.message) {
        currentMessage = result.message
      }
      if (result?.systemPrompt !== undefined) {
        currentSystemPrompt = result.systemPrompt
      }
    }
    return {
      message: currentMessage,
      systemPrompt: currentSystemPrompt,
    }
  }

  private async runContextHooks(
    messages: AgentMessage[],
    signal: AbortSignal | undefined,
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
  ): Promise<AgentMessage[]> {
    const handlers = this.getHookHandlers('context')
    if (handlers.length === 0) {
      return messages
    }
    const leadingSystem: SystemMessage | undefined =
      messages[0]?.role === 'system' ? messages[0] : undefined
    let currentMessages = [...messages]
    const context = this.createHookContext(turnState, signal)
    for (const handler of handlers) {
      const result = await handler(
        {
          type: 'context',
          messages: currentMessages,
        },
        context,
      )
      if (result?.messages) {
        currentMessages = [...result.messages]
      }
    }
    if (leadingSystem && currentMessages[0]?.role !== 'system') {
      return [leadingSystem, ...currentMessages]
    }
    return currentMessages
  }

  private async runBeforeProviderRequestHooks(
    payload: unknown,
    model: Model<Api>,
    signal: AbortSignal | undefined,
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
  ): Promise<unknown> {
    const handlers = this.getHookHandlers('before_provider_request')
    if (handlers.length === 0) {
      return payload
    }
    let currentPayload = payload
    const context = this.createHookContext({ ...turnState, model }, signal)
    for (const handler of handlers) {
      const result = await handler(
        {
          type: 'before_provider_request',
          payload: currentPayload,
          model,
        },
        context,
      )
      if (result !== undefined) {
        currentPayload = result
      }
    }
    return currentPayload
  }

  private async runToolCallHooks(
    ctx: BeforeToolCallContext,
    signal: AbortSignal | undefined,
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
  ): Promise<BeforeToolCallResult | undefined> {
    const handlers = this.getHookHandlers('tool_call')
    if (handlers.length === 0) {
      return undefined
    }
    const hookContext = this.createHookContext(turnState, signal)
    for (const handler of handlers) {
      const result = await handler(
        {
          type: 'tool_call',
          assistantMessage: ctx.assistantMessage,
          toolCall: ctx.toolCall,
          args: ctx.args,
          context: ctx.context,
        },
        hookContext,
      )
      if (result?.block) {
        return result
      }
    }
    return undefined
  }

  private async runToolResultHooks(
    ctx: AfterToolCallContext,
    signal: AbortSignal | undefined,
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
  ): Promise<AfterToolCallResult | undefined> {
    const handlers = this.getHookHandlers('tool_result')
    if (handlers.length === 0) {
      return undefined
    }
    let currentResult = ctx.result
    let currentIsError = ctx.isError
    let hasOverride = false
    const hookContext = this.createHookContext(turnState, signal)
    for (const handler of handlers) {
      const override = await handler(
        {
          type: 'tool_result',
          assistantMessage: ctx.assistantMessage,
          toolCall: ctx.toolCall,
          args: ctx.args,
          result: currentResult,
          isError: currentIsError,
          context: ctx.context,
        },
        hookContext,
      )
      if (!override) {
        continue
      }
      hasOverride = true
      currentResult = {
        content: override.content ?? currentResult.content,
        details: override.details !== undefined ? override.details : currentResult.details,
      }
      if (override.isError !== undefined) {
        currentIsError = override.isError
      }
    }
    if (!hasOverride) {
      return undefined
    }
    return {
      content: currentResult.content,
      details: currentResult.details,
      isError: currentIsError,
    }
  }

  private async runVoidHooks<TType extends AgentHarnessHookType>(
    type: TType,
    event: AgentHarnessHookMap[TType]['event'],
    signal: AbortSignal | undefined,
    turnState: {
      model: Model<Api>
      thinkingLevel: ThinkingLevel
      turnIndex: number
    },
  ): Promise<void> {
    const handlers = this.getHookHandlers(type)
    if (handlers.length === 0) {
      return
    }
    const context = this.createHookContext(turnState, signal)
    for (const handler of handlers) {
      await handler(event, context)
    }
  }

  private async emitEvent(event: AgentHarnessEvent): Promise<void> {
    for (const listener of this.listeners) {
      await listener(event)
    }
  }
}
