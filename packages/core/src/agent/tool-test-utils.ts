import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context'
import { OutputBuffer } from '@earendil-works/chord/output'
import type {
  Harness,
  JsonObject,
  ToolExecutionApi,
  ToolExecutionResult,
  ToolRegistration,
} from '@earendil-works/pi-durable'

/** Exercise a tool with the native execution API while keeping assertions focused on its result. */
export async function invokeTool<T extends ToolRegistration>(
  tool: T,
  callId: string,
  args: Parameters<T['execute']>[0],
  signal?: AbortSignal,
  onUpdate?: (update: {
    content: NonNullable<ToolExecutionResult['output']>
    details?: unknown
  }) => void,
) {
  const buffer = new OutputBuffer({
    maxBytes: tool.outputLimits?.maxBytes ?? 50000,
    maxLines: tool.outputLimits?.maxLines ?? 2000,
    retain: tool.outputLimits?.retain ?? 'head',
  })
  let details: unknown
  const notify = () =>
    onUpdate?.({
      content: buffer.snapshot().text ? [{ type: 'text', text: buffer.snapshot().text }] : [],
      details,
    })
  const api = {
    callId,
    output: (chunk: string | Uint8Array) => {
      buffer.push(chunk)
      notify()
    },
    details: async (value: unknown) => {
      details = value
      notify()
    },
    retainedOutput: () => ({ text: buffer.snapshot().text, truncated: false }),
    diagnostic: () => {},
  } as unknown as ToolExecutionApi
  const result = await tool.execute(args, api, { ...BACKGROUND_CONTEXT, abortSignal: signal })
  return {
    ...result,
    details: result.details as Awaited<ReturnType<T['execute']>>['details'],
    content: result.output ?? [{ type: 'text' as const, text: buffer.snapshot().text }],
  }
}

export async function getAgentTools(harness: Harness) {
  return (await (await harness.root(BACKGROUND_CONTEXT)).agent(BACKGROUND_CONTEXT)).tools
}

export async function getAgentPrompt(harness: Harness) {
  return (
    (await (await harness.root(BACKGROUND_CONTEXT)).agent(BACKGROUND_CONTEXT)).instructions ?? ''
  )
}

export function jsonData(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}
