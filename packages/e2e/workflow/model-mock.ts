import {
  createModels,
  fauxAssistantMessage,
  fauxToolCall,
  type AssistantMessage,
  type Message,
  type Models,
  type ToolResultMessage,
} from '@earendil-works/pi-ai'
import { getCurrentTools } from '@earendil-works/pi-ai/utils/transcript'
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream'
import type { JsonObject } from '@earendil-works/pi-durable'
import { vi } from 'vitest'

type ModelReply = {
  content: AssistantMessage['content']
  usage?: unknown
  stopReason?: AssistantMessage['stopReason']
}
type ScenarioTool = {
  name: string
  execute(
    id: string,
    args: Record<string, unknown>,
    ...unused: unknown[]
  ): Promise<{ content: ToolResultMessage['content']; details?: unknown }>
}
export interface ModelScenario {
  getTools(): ScenarioTool[]
}
class RequestTool extends Error {
  constructor(
    readonly name: string,
    readonly args: Record<string, unknown>,
    readonly id: string,
  ) {
    super('Model requests a tool')
  }
}

/** Mock the provider boundary. Every requested tool is executed by the real Durable runtime. */
export function mockModelPrompt(
  scenario: (this: ModelScenario, prompt: string) => Promise<ModelReply>,
) {
  return vi
    .spyOn(Object.getPrototypeOf(createModels()) as Models, 'streamSimple')
    .mockImplementation((_model, transcript) => {
      const stream = new AssistantMessageEventStream()
      void (async () => {
        const lastInput = transcript.messages.findLastIndex((message) => message.role === 'user')
        const round = transcript.messages.slice(lastInput + 1)
        const results = round.filter(
          (message): message is ToolResultMessage => message.role === 'toolResult',
        )
        let index = 0
        const host: ModelScenario = {
          getTools: () =>
            getCurrentTools(transcript.messages).map((tool) => ({
              name: tool.name,
              execute: async (id, args) => {
                const position = index++
                const result = results[position]
                if (!result) throw new RequestTool(tool.name, args, `${id}-${position}`)
                if (result.toolName !== tool.name)
                  throw new Error(`Expected result for ${tool.name}, received ${result.toolName}`)
                return { content: result.content, details: result.details }
              },
            })),
        }
        const input = transcript.messages[lastInput]
        const prompt = input?.role === 'user' ? messageText(input) : ''
        let answer: AssistantMessage
        try {
          const reply = await scenario.call(host, prompt)
          answer = {
            ...fauxAssistantMessage(reply.content),
            stopReason: reply.stopReason ?? 'stop',
          }
        } catch (error) {
          if (!(error instanceof RequestTool)) {
            console.error('Model scenario failed', error)
            stream.push({
              type: 'error',
              reason: 'error',
              error: {
                ...fauxAssistantMessage(''),
                stopReason: 'error',
                errorMessage: String(error),
              },
            })
            stream.end()
            return
          }
          answer = fauxAssistantMessage(
            [
              fauxToolCall(error.name, JSON.parse(JSON.stringify(error.args)) as JsonObject, {
                id: error.id,
              }),
            ],
            { stopReason: 'toolUse' },
          )
        }
        stream.push({
          type: 'done',
          reason: answer.stopReason as 'stop' | 'length' | 'toolUse',
          message: answer,
        })
        stream.end()
      })()
      return stream
    })
}
function messageText(message: Message) {
  return typeof message.content === 'string'
    ? message.content
    : message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
}
