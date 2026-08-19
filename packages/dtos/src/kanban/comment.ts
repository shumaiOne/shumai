import { z } from 'zod'
import { kanbanUserInfoSchema } from './event'

export const createKanbanCommentSchema = z.object({
  body: z.string().min(1),
})
export type CreateKanbanCommentRequest = z.infer<typeof createKanbanCommentSchema>

export const kanbanCommentInfoSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  author: kanbanUserInfoSchema,
  body: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})
export type KanbanCommentInfo = z.infer<typeof kanbanCommentInfoSchema>

export const listKanbanCommentsResponseSchema = z.object({
  data: z.array(kanbanCommentInfoSchema),
})
export type ListKanbanCommentsResponse = z.infer<typeof listKanbanCommentsResponseSchema>
