import { z } from 'zod'

export const signupInfoResponseSchema = z.object({
  userCount: z.number(),
  enablePublicSignup: z.boolean(),
})

export type SignupInfoResponse = z.infer<typeof signupInfoResponseSchema>
