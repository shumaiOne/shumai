import { z } from 'zod'
export { z }

export const KNOWN_APIS = [
  'openai-completions',
  'mistral-conversations',
  'openai-responses',
  'azure-openai-responses',
  'openai-codex-responses',
  'anthropic-messages',
  'bedrock-converse-stream',
  'google-generative-ai',
  'google-vertex',
] as const

// We define a serializable version of ProviderConfig for our API and DB
// as the original ProviderConfig interface includes non-serializable fields (functions)
export const providerModelConfigSchema = z.object({
  api: z.enum(KNOWN_APIS).optional(),
  reasoning: z.boolean().default(false),
  input: z.array(z.enum(['text', 'image'])).default(['text']),
  contextWindow: z.number().int().positive().default(128000),
  maxTokens: z.number().int().positive().default(4096),
  cost: z.object({
    input: z.number().nonnegative().default(0),
    output: z.number().nonnegative().default(0),
    cacheRead: z.number().nonnegative().default(0),
    cacheWrite: z.number().nonnegative().default(0),
  }),
})

export const providerModelSchema = z.object({
  id: z.string().optional(),
  modelId: z.string().min(1, 'Model ID is required'),
  name: z.string().min(0).default(''),
  config: providerModelConfigSchema,
})

export const providerConfigSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  apiKey: z.string().optional().or(z.literal('')),
  api: z.enum(KNOWN_APIS),
  headers: z.record(z.string(), z.string()).optional(),
  authHeader: z.boolean().optional(),
})

export type ProviderConfigSerializable = z.infer<typeof providerConfigSchema>

export const createProviderRequestSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  config: providerConfigSchema,
  models: z.array(providerModelSchema).default([]),
})

export type CreateProviderRequest = z.infer<typeof createProviderRequestSchema>

export const updateProviderRequestSchema = z.object({
  name: z.string().min(1, 'Provider name is required').optional(),
  config: providerConfigSchema,
  models: z.array(providerModelSchema).optional(),
})

export type UpdateProviderRequest = z.infer<typeof updateProviderRequestSchema>

export const createModelRequestSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
  name: z.string().min(0).default(''),
  config: providerModelConfigSchema,
})

export type CreateModelRequest = z.infer<typeof createModelRequestSchema>

export const updateModelRequestSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required').optional(),
  name: z.string().min(0).optional(),
  config: providerModelConfigSchema.optional(),
})

export type UpdateModelRequest = z.infer<typeof updateModelRequestSchema>

export const providerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  isBuiltin: z.boolean(),
  config: providerConfigSchema,
  models: z.array(providerModelSchema).optional(),
  modelsCount: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type ProviderResponse = z.infer<typeof providerResponseSchema>
