import { z } from 'zod'

export const userMetadataItemSchema = z.object({
  key: z.string(),
  value: z.unknown(),
})
export type UserMetadataItem = z.infer<typeof userMetadataItemSchema>

export const updateUserMetadataRequestSchema = z.object({
  value: z.unknown(),
})
export type UpdateUserMetadataRequest = z.infer<typeof updateUserMetadataRequestSchema>

export const listUserMetadataResponseSchema = z.array(userMetadataItemSchema)
export type ListUserMetadataResponse = z.infer<typeof listUserMetadataResponseSchema>
