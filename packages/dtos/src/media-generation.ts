import { z } from 'zod'

export const mediaModelTypeSchema = z.enum(['image', 'video'])
export type MediaModelType = z.infer<typeof mediaModelTypeSchema>

export const mediaProviderStatusTypeSchema = z.enum([
  'configured_custom',
  'configured_env',
  'not_configured',
])
export type MediaProviderStatusType = z.infer<typeof mediaProviderStatusTypeSchema>

export const updateMediaProviderApiKeySchema = z.object({
  apiKey: z.string().optional().or(z.literal('')),
})
export type UpdateMediaProviderApiKeyRequest = z.infer<typeof updateMediaProviderApiKeySchema>

export const createEnabledMediaModelSchema = z.object({
  type: mediaModelTypeSchema,
  provider: z.string().min(1, 'Provider is required'),
  modelId: z.string().min(1, 'Model ID is required'),
  name: z.string().optional(),
})
export type CreateEnabledMediaModelRequest = z.infer<typeof createEnabledMediaModelSchema>

export const enabledMediaModelSchema = z.object({
  id: z.string(),
  type: mediaModelTypeSchema,
  provider: z.string(),
  modelId: z.string(),
  name: z.string(),
  createdAt: z.string(),
})
export type EnabledMediaModel = z.infer<typeof enabledMediaModelSchema>

export const mediaProviderStatusSchema = z.object({
  provider: z.string(),
  defaultEnvKey: z.string(),
  apiKeyConfigured: z.boolean(),
  status: mediaProviderStatusTypeSchema,
  customApiKeyOrEnv: z.string().optional(),
  supportedTypes: z.array(mediaModelTypeSchema),
})
export type MediaProviderStatus = z.infer<typeof mediaProviderStatusSchema>

export const mediaGenerationSettingsResponseSchema = z.object({
  providers: z.array(mediaProviderStatusSchema),
  enabledModels: z.array(enabledMediaModelSchema),
})
export type MediaGenerationSettingsResponse = z.infer<typeof mediaGenerationSettingsResponseSchema>

export const curatedMediaModelSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  type: mediaModelTypeSchema,
})
export type CuratedMediaModel = z.infer<typeof curatedMediaModelSchema>

export const getCuratedMediaModelsQuerySchema = z.object({
  provider: z.string().optional(),
  type: mediaModelTypeSchema.optional(),
})
export type GetCuratedMediaModelsQuery = z.infer<typeof getCuratedMediaModelsQuerySchema>
