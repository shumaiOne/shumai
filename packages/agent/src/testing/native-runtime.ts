import { fauxAssistantMessage, type AssistantMessage } from '@earendil-works/pi-ai'
import {
  MemoryStorage,
  ROOT_CONVERSATION_ID,
  type Conversation,
  type Harness,
  type Tx,
} from '@earendil-works/pi-durable'
import { vi } from 'vitest'
import type { createAgentSession } from '../runtime'

/** Native conversation fixture for activity orchestration tests; model behavior remains independently scripted. */
export function mockAgentSession(
  model: { prompt: (...args: unknown[]) => Promise<unknown>; abort?: () => void },
  metadata: { getStorage?: () => unknown } = {},
): Awaited<ReturnType<typeof createAgentSession>> {
  let answer = fauxAssistantMessage('')
  const information = metadata.getStorage?.() as { sessionId?: string } | undefined
  const entry = () => ({
    id: 9,
    conversationId: ROOT_CONVERSATION_ID,
    kind: 'pi.assistant',
    model: [answer],
  })
  const session = {
    id: ROOT_CONVERSATION_ID,
    submit: vi.fn(async (draft: { content: string | Array<{ type: string; text?: string }> }) => {
      const text =
        typeof draft.content === 'string'
          ? draft.content
          : draft.content
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('\n')
      const response = (await model.prompt(text, {
        images:
          typeof draft.content === 'string'
            ? []
            : draft.content.filter((block) => block.type === 'image'),
      })) as Partial<AssistantMessage>
      answer = {
        ...fauxAssistantMessage(''),
        ...response,
        usage: { ...fauxAssistantMessage('').usage, ...response.usage },
      }
      return { wait: async () => ({ type: 'input', status: 'done', entry: 7, answer: 9 }) }
    }),
    abort: vi.fn(async () => {
      model.abort?.()
    }),
    commit: vi.fn(async (change: (tx: Tx) => unknown) =>
      change({ entry: async () => entry() } as unknown as Tx),
    ),
  } as unknown as Conversation
  const harness = {
    root: vi.fn(async () => session),
    close: vi.fn(async () => {}),
    usage: vi.fn(async () => ({ models: { faux: answer.usage }, tools: {} })),
  } as unknown as Harness
  return {
    session,
    harness,
    storage: new MemoryStorage(),
    sessionId: information?.sessionId ?? 'mock-session-id',
  }
}
