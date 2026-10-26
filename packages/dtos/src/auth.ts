import { z } from 'zod'

export const signupInfoResponseSchema = z.object({
  userCount: z.number(),
})

export type SignupInfoResponse = z.infer<typeof signupInfoResponseSchema>

export const createApiTokenRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
})
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>

/** An API token as listed in settings. The plaintext is never returned after creation. */
export const apiTokenResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Last characters of the token, used to identify it in the UI. */
  tokenHint: z.string(),
  createdAt: z.string(),
})
export type ApiTokenResponse = z.infer<typeof apiTokenResponseSchema>

/** Returned once when a token is created; `token` is the only time the plaintext is exposed. */
export const createApiTokenResponseSchema = apiTokenResponseSchema.extend({
  token: z.string(),
})
export type CreateApiTokenResponse = z.infer<typeof createApiTokenResponseSchema>
