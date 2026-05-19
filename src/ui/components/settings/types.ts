import type { AiProviderSettings } from '@/dtos/ai'

export const AiProvider = {
  GEMINI: 'google',
  openAi: 'openai',
  ANTHROPIC: 'anthropic',
  ELEVEN: 'elevenlabs',
} as const
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider]

export const GeminiModel = {
  FLASH: 'gemini-3-flash-preview',
  PRO: 'gemini-3-pro-preview',
  FLASH_LITE: 'gemini-flash-lite-latest',
} as const
export type GeminiModel = (typeof GeminiModel)[keyof typeof GeminiModel]

export const FileType = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  TEXT: 'text',
} as const
export type FileType = (typeof FileType)[keyof typeof FileType]

export const ThinkingLevel = {
  DISABLED: 'disabled',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const
export type ThinkingLevel = (typeof ThinkingLevel)[keyof typeof ThinkingLevel]

import type { AgentInfo } from '@/dtos/agent'

export type ProviderSettings = AiProviderSettings
export type Agent = AgentInfo
