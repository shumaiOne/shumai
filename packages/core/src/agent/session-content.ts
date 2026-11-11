import type { ImageContent, Message, ToolResultMessage } from '@earendil-works/pi-ai'
import type { Cursor, EntryRecord, HookApi, StorageWrite } from '@earendil-works/pi-durable'
import { serializeContextToXml, shumaiMessageContextSchema } from '@shumai/dtos'
import { s3Service } from '../s3/s3'
import { agentService } from './agent'

export const S3_PLACEHOLDER = '__S3_DATA__'
export const SKILL_PLACEHOLDER = '__SKILL_CONTENT__'

function contentReferences(value: unknown): { sourceKeys: string[]; skillId?: string } {
  if (!value || typeof value !== 'object') return { sourceKeys: [] }
  const record = value as Record<string, unknown>
  return {
    sourceKeys: Array.isArray(record.sourceKeys)
      ? record.sourceKeys.filter((key): key is string => typeof key === 'string')
      : [],
    skillId: typeof record.skillId === 'string' ? record.skillId : undefined,
  }
}

function compactMessage(message: Message, entryData: unknown): Message {
  if (message.role !== 'toolResult' && message.role !== 'user') return message
  const refs = contentReferences(message.role === 'toolResult' ? message.details : entryData)
  if (typeof message.content === 'string') return message
  let imageIndex = 0
  return {
    ...message,
    content: message.content.map((block) => {
      if (block.type === 'image') {
        const key = refs.sourceKeys[imageIndex++]
        return key ? { ...block, data: S3_PLACEHOLDER } : block
      }
      if (
        message.role === 'toolResult' &&
        message.toolName === 'read_skill' &&
        !message.isError &&
        refs.skillId &&
        block.type === 'text'
      )
        return { ...block, text: SKILL_PLACEHOLDER }
      return block
    }),
  }
}

/** Only immutable entries are rewritten. Durable's document deltas keep their original bases. */
export function compactSessionWrites(writes: readonly StorageWrite[]): StorageWrite[] {
  return writes.map((write) =>
    write.type === 'entry'
      ? {
          ...write,
          value: {
            ...write.value,
            model: write.value.model?.map((m) => compactMessage(m, write.value.data)),
          },
        }
      : write,
  )
}

export async function hydrateMessages(
  messages: readonly Message[],
  entryData?: unknown,
): Promise<Message[]> {
  return Promise.all(
    messages.map(async (message): Promise<Message> => {
      if (message.role !== 'toolResult' && message.role !== 'user') return message
      if (typeof message.content === 'string') return message
      const refs = contentReferences(message.role === 'toolResult' ? message.details : entryData)
      let imageIndex = 0
      const skillText =
        message.role === 'toolResult' &&
        message.toolName === 'read_skill' &&
        !message.isError &&
        refs.skillId
          ? await agentService.getSkillContent(refs.skillId)
          : undefined
      const content = await Promise.all(
        message.content.map(async (block) => {
          if (block.type === 'image') {
            const key = refs.sourceKeys[imageIndex++]
            if (block.data === S3_PLACEHOLDER && key) {
              const { buffer } = await s3Service.getObject(process.env.S3_BUCKET || 'shumai', key)
              return { ...block, data: buffer.toString('base64') } satisfies ImageContent
            }
          }
          if (block.type === 'text' && skillText !== undefined) return { ...block, text: skillText }
          return block
        }),
      )
      return { ...message, content } as ToolResultMessage | Extract<Message, { role: 'user' }>
    }),
  )
}

export async function hydrateEntry(entry: EntryRecord): Promise<EntryRecord> {
  if (!entry.model) return entry
  let model = await hydrateMessages(entry.model, entry.data)
  if (
    entry.kind === 'shumai.message' &&
    entry.data &&
    typeof entry.data === 'object' &&
    !Array.isArray(entry.data)
  ) {
    const parsed = shumaiMessageContextSchema.safeParse(entry.data.context)
    if (parsed.success) {
      const xml = serializeContextToXml(parsed.data)
      model = model.map((message) => {
        if (message.role !== 'user') return message
        const content =
          typeof message.content === 'string'
            ? message.content
            : message.content
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('\n')
        if (!xml || content.includes('<context>')) return message
        return {
          ...message,
          content:
            typeof message.content === 'string'
              ? `${message.content}\n\n${xml}`
              : [...message.content, { type: 'text' as const, text: xml }],
        }
      })
    }
  }
  return { ...entry, model }
}

/** An admitted input may still be in Durable's warm context before its first storage read. */
export async function hydrateRequest(
  messages: readonly Message[],
  api: HookApi,
  context: import('@earendil-works/chord/context').Context,
) {
  const waiting = new Set(
    messages
      .filter(
        (m) =>
          m.role === 'user' &&
          Array.isArray(m.content) &&
          m.content.some((b) => b.type === 'image' && b.data === S3_PLACEHOLDER),
      )
      .map((m) => m.timestamp),
  )
  const references = new Map<number, unknown>()
  let cursor: Cursor | undefined
  while (waiting.size) {
    const page = await api.entries({ order: 'descending' }, 100, cursor, context)
    for (const entry of page.items) {
      for (const message of entry.model ?? []) {
        if (message.role === 'user' && waiting.delete(message.timestamp))
          references.set(message.timestamp, entry.data)
      }
    }
    if (!page.next) break
    cursor = page.next
  }
  return (
    await Promise.all(
      messages.map((message) => hydrateMessages([message], references.get(message.timestamp))),
    )
  ).flat()
}
