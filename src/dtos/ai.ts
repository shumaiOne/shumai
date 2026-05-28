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
