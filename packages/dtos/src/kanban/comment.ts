import { z } from 'zod'
import { kanbanUserInfoSchema } from './event'

export const kanbanAttachmentPayloadSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  sizeByte: z.number(),
  contentType: z.string().nullable().optional(),
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
})
export type KanbanAttachmentPayload = z.infer<typeof kanbanAttachmentPayloadSchema>

export const kanbanAttachmentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  sizeByte: z.number(),
  contentType: z.string().nullable().optional(),
  url: z.string(),
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
})
export type KanbanAttachmentInfo = z.infer<typeof kanbanAttachmentInfoSchema>

export const postKanbanAttachmentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  sizeByte: z.number(),
  contentType: z.string().nullable().optional(),
  uploadUrl: z.string(),
  proxyType: z.enum(['image', 'video', 'audio', 'pdf']).nullable().optional(),
})
export type PostKanbanAttachmentResponse = z.infer<typeof postKanbanAttachmentResponseSchema>

export const createKanbanCommentSchema = z
  .object({
    body: z.string().default(''),
    attachments: z.array(kanbanAttachmentPayloadSchema).optional(),
  })
  .refine(
    (data) => data.body.trim().length > 0 || (data.attachments && data.attachments.length > 0),
    {
      message: 'Comment body or attachments required',
    },
  )
export type CreateKanbanCommentRequest = z.infer<typeof createKanbanCommentSchema>

export const kanbanCommentInfoSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  author: kanbanUserInfoSchema,
  body: z.string(),
  attachments: z.array(kanbanAttachmentInfoSchema).default([]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})
export type KanbanCommentInfo = z.infer<typeof kanbanCommentInfoSchema>

export const listKanbanCommentsResponseSchema = z.object({
  data: z.array(kanbanCommentInfoSchema),
})
export type ListKanbanCommentsResponse = z.infer<typeof listKanbanCommentsResponseSchema>
