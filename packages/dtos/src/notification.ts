import { z } from 'zod'
import type { NotificationType } from '@shumai/db'

export const teamUserInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  role: z.string().optional(),
})

export type TeamUserInfo = z.infer<typeof teamUserInfoSchema>

export const entityInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
})

export type EntityInfo = z.infer<typeof entityInfoSchema>

export const assetPreviewSchema = z.object({
  id: z.string().optional(),
  mediaType: z.string().optional(),
  name: z.string().optional(),
  preview: z.string().optional(),
})

export type AssetPreview = z.infer<typeof assetPreviewSchema>

export const notificationInfoSchema = z.object({
  id: z.string().optional(),
  creator: teamUserInfoSchema.optional(),
  type: z.string().optional(),
  team: entityInfoSchema.optional(),
  project: entityInfoSchema.optional(),
  asset: assetPreviewSchema.optional(),
  user: teamUserInfoSchema.optional(),
  createdAt: z.string().optional(),
  isRead: z.boolean().optional(),
})

export type NotificationInfo = z.infer<typeof notificationInfoSchema>

export const listNotificationsRequestSchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  after: z.string().optional(),
  pageSize: z.coerce.number().optional(),
})

export type ListNotificationsRequest = z.infer<typeof listNotificationsRequestSchema>

export const markNotificationReadRequestSchema = z.object({
  notificationId: z.string().min(1),
})

export type MarkNotificationReadRequest = z.infer<typeof markNotificationReadRequestSchema>

// Service types
export interface CreateNotificationRequest {
  type: NotificationType
  teamId: string
  projectId?: string
  creatorId?: string
  assetId?: string
  taskId?: string
  userId?: string
  commentMessage?: string // For parsing mentions
}

export interface ListNotificationParams {
  unreadOnly?: boolean
  after?: string
  pageSize?: number
}

export const notificationSettingsSchema = z.object({
  comments: z.boolean().default(true),
  replies: z.boolean().default(true),
  mentions: z.boolean().default(true),
  yourUploads: z.boolean().default(false),
  otherUploads: z.boolean().default(true),
  statusUpdates: z.boolean().default(true),
})

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>
