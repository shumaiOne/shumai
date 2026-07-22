import { z } from 'zod'

export interface SkillEnvironmentVariable {
  name: string
  default?: string
}

export interface SkillConfig {
  environmentVariables: SkillEnvironmentVariable[]
}

export interface SkillInfo {
  id: string
  name: string
  description: string | null
  config: SkillConfig | null
  assetId: string
  hash: string
  permission: 'owner' | 'editor' | 'reviewer'
  createdAt: string
  updatedAt: string
}

export const upsertSkillRequestSchema = z.object({
  assetId: z.string().optional(),
  githubUrl: z.string().optional(),
  override: z.boolean().optional(),
})

export type UpsertSkillRequest = z.infer<typeof upsertSkillRequestSchema>

export const updateSkillConfigRequestSchema = z.object({
  config: z.object({
    environmentVariables: z.array(
      z.object({
        name: z.string(),
        default: z.string().optional(),
      }),
    ),
  }),
})

export type UpdateSkillConfigRequest = z.infer<typeof updateSkillConfigRequestSchema>

export const updateSkillPermissionRequestSchema = z.object({
  permission: z.enum(['owner', 'editor', 'reviewer']),
})

export type UpdateSkillPermissionRequest = z.infer<typeof updateSkillPermissionRequestSchema>

export interface ListSkillsResponse {
  skills: SkillInfo[]
}
