import { z } from 'zod'

export const watermarkBlockTextSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
  rotation: z.number().min(-180).max(180),
  text: z.string(),
  // size is a FRACTION (0..1) of the canvas width, so the watermark scales
  // proportionally with the output resolution.
  size: z.number().positive().max(1),
  color: z.string(),
})

export type WatermarkBlockText = z.infer<typeof watermarkBlockTextSchema>

export const watermarkBlockImageSchema = z.object({
  id: z.string(),
  type: z.literal('image'),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
  rotation: z.number().min(-180).max(180),
  imageAssetKey: z.string().min(1),
  imageAssetUrl: z.string().optional(),
  // size is a FRACTION (0..1) of the canvas width, same as text blocks.
  size: z.number().positive().max(1),
})

export type WatermarkBlockImage = z.infer<typeof watermarkBlockImageSchema>

export const watermarkBlockSchema = z.discriminatedUnion('type', [
  watermarkBlockTextSchema,
  watermarkBlockImageSchema,
])

export type WatermarkBlock = z.infer<typeof watermarkBlockSchema>

export const watermarkConfigSpecSchema = z.object({
  blocks: z.array(watermarkBlockSchema),
})

export type WatermarkConfigSpec = z.infer<typeof watermarkConfigSpecSchema>

export interface WatermarkConfigInfo {
  id: string
  config: WatermarkConfigSpec
  hash: string
  createdAt: string
  updatedAt: string
}

export interface WatermarkTemplateInfo {
  id: string
  name: string
  config: WatermarkConfigSpec
  teamId?: string | null
  createdAt: string
  updatedAt: string
}

export const createWatermarkTemplateRequestSchema = z.object({
  name: z.string().min(1),
  teamId: z.string().optional(),
  config: watermarkConfigSpecSchema,
})

export type CreateWatermarkTemplateRequest = z.infer<typeof createWatermarkTemplateRequestSchema>

export const updateWatermarkTemplateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  config: watermarkConfigSpecSchema.optional(),
})

export type UpdateWatermarkTemplateRequest = z.infer<typeof updateWatermarkTemplateRequestSchema>

export const updateShareLinkWatermarkRequestSchema = z
  .object({
    enabled: z.boolean(),
    config: watermarkConfigSpecSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.enabled && (!val.config || val.config.blocks.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['config'],
        message: 'Watermark configuration is required when enabling watermark',
      })
    }
  })

export type UpdateShareLinkWatermarkRequest = z.infer<typeof updateShareLinkWatermarkRequestSchema>
