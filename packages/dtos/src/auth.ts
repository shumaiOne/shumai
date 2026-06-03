import { z } from 'zod'

export const signupInfoResponseSchema = z.object({
  userCount: z.number(),
})

export type SignupInfoResponse = z.infer<typeof signupInfoResponseSchema>
