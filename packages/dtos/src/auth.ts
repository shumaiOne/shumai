import { z } from 'zod'

export const signupInfoResponseSchema = z.object({
  userCount: z.number(),
})

export type SignupInfoResponse = z.infer<typeof signupInfoResponseSchema>

export const createApiTokenRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
})
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>

export const apiTokenResponseSchema = z.object({
  id: z.string(),
  token: z.string(),
  name: z.string(),
  createdAt: z.string(),
})
export type ApiTokenResponse = z.infer<typeof apiTokenResponseSchema>
