import { z } from 'zod'
export { z }

// We define a serializable version of ProviderConfig for our API and DB
// as the original ProviderConfig interface includes non-serializable fields (functions)
export const providerModelConfigSchema = z.object({
  api: z.string().optional(),
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
  api: z.string().min(1, 'API Protocol is required'),
  headers: z.record(z.string(), z.string()).optional(),
  authHeader: z.boolean().optional(),
})

export type ProviderConfigSerializable = z.infer<typeof providerConfigSchema>

export const createProviderRequestSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  config: providerConfigSchema,
  models: z.array(providerModelSchema).min(1, 'At least one model is required'),
})

export const updateProviderRequestSchema = z.object({
  config: providerConfigSchema,
  models: z.array(providerModelSchema).min(1, 'At least one model is required'),
})

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
