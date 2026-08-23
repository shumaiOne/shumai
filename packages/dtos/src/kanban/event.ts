import { z } from 'zod'
import { KanbanTaskEventType, KanbanTaskStatus } from '@shumai/db/enums'

export const kanbanUserInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().optional(),
})
export type KanbanUserInfo = z.infer<typeof kanbanUserInfoSchema>

export const kanbanEventPayloadSchema = z
  .object({
    summary: z.string().optional(),
    blockReason: z.string().optional(),
    blockKind: z.string().optional(),
    reason: z.string().optional(),
    assets: z
      .array(
        z.object({
          id: z.string(),
          type: z.string().optional(),
          name: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough()
export type KanbanEventPayload = z.infer<typeof kanbanEventPayloadSchema>

export const kanbanEventInfoSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  actor: kanbanUserInfoSchema.nullable().optional(),
  type: z.nativeEnum(KanbanTaskEventType),
  fromStatus: z.nativeEnum(KanbanTaskStatus).nullable().optional(),
  toStatus: z.nativeEnum(KanbanTaskStatus).nullable().optional(),
  data: kanbanEventPayloadSchema.nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
})
export type KanbanEventInfo = z.infer<typeof kanbanEventInfoSchema>

export const listKanbanEventsResponseSchema = z.object({
  data: z.array(kanbanEventInfoSchema),
})
export type ListKanbanEventsResponse = z.infer<typeof listKanbanEventsResponseSchema>
