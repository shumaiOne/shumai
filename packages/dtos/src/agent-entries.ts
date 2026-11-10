import { defineEntry, type EntryRecord, type JsonObject } from '@earendil-works/pi-durable'
import { z } from 'zod'
import { shumaiMessageContextSchema } from './chat'

export type ShumaiMessageData = {
  displayText: string
  timestamp: number
  context: JsonObject
  sourceCommentId?: string
  sourceKeys?: string[]
  legacyId?: string
}

export const ShumaiMessageEntry = defineEntry<ShumaiMessageData>('shumai.message')

export const shumaiMessageDataSchema = z.object({
  displayText: z.string(),
  timestamp: z.number(),
  context: shumaiMessageContextSchema,
  sourceCommentId: z.string().nullable().optional(),
  sourceKeys: z.array(z.string()).optional(),
  legacyId: z.string().optional(),
})

export function getShumaiMessage(entry: EntryRecord) {
  if (entry.kind !== ShumaiMessageEntry.kind && entry.kind !== 'shumai.optimistic') return undefined
  const parsed = shumaiMessageDataSchema.safeParse(entry.data)
  return parsed.success ? parsed.data : undefined
}
