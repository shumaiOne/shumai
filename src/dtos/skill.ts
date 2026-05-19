import { z } from 'zod'

export interface SkillInfo {
  id: string
  name: string
  description: string | null
  config: PrismaJson.SkillConfig | null
  assetId: string
  hash: string
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

export interface ListSkillsResponse {
  skills: SkillInfo[]
}
