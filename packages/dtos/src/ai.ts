import { z } from 'zod'

export enum AiProvider {
  OpenAi = 'openai',
  Google = 'google',
  Anthropic = 'anthropic',
  ElevenLabs = 'elevenlabs',
}

export const aiProviderSettingsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  chatModels: z.array(z.string()).optional(),
})

export type AiProviderSettings = z.infer<typeof aiProviderSettingsSchema>

export const timeframeSchema = z.enum(['1h', '24h', '7d', '30d'])
export type Timeframe = z.infer<typeof timeframeSchema>

export const getTeamAiUsageQuerySchema = z.object({
  timeframe: timeframeSchema.default('30d'),
  userId: z.string().optional(),
})
export type GetTeamAiUsageQuery = z.infer<typeof getTeamAiUsageQuerySchema>

export interface AiUsageMetrics {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
  cost: number
}

export interface MemberAiUsageMetrics extends AiUsageMetrics {
  userId: string
  userName: string
  userEmail: string
  userImage?: string | null
  role: string
}

export interface TeamUsageStatsResponse {
  timeframe: Timeframe
  team?: AiUsageMetrics
  member?: MemberAiUsageMetrics
}
