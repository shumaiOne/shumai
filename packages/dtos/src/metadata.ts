import { z } from 'zod'
import { MetadataFieldScope } from '@shumai/db/enums'

export { MetadataFieldScope }

export const FieldType = {
  text: 'text',
  longText: 'longText',
  select: 'select',
  selectMulti: 'selectMulti',
  rating: 'rating',
  number: 'number',
  toggle: 'toggle',
  date: 'date',
  user: 'user',
  userMulti: 'userMulti',
} as const

export type FieldType = (typeof FieldType)[keyof typeof FieldType]

export const AutofillSource = {
  NONE: 'NONE',
  CONTENT: 'CONTENT',
  CREATION_CONTEXT: 'CREATION_CONTEXT',
} as const

export type AutofillSource = (typeof AutofillSource)[keyof typeof AutofillSource]

export const selectOptionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  color: z.string().optional(),
})
export type SelectOption = z.infer<typeof selectOptionSchema>

export const fieldConfigSchema = z.object({
  name: z.string(),
  type: z.enum([
    'text',
    'longText',
    'select',
    'selectMulti',
    'rating',
    'number',
    'toggle',
    'date',
    'user',
    'userMulti',
  ]),
  autofillSource: z.nativeEnum(AutofillSource).optional(),
  text: z.any().optional(),
  longText: z.any().optional(),
  select: z.any().optional(),
  selectMulti: z.any().optional(),
  rating: z.any().optional(),
  number: z.any().optional(),
  toggle: z.any().optional(),
  date: z.any().optional(),
  user: z.any().optional(),
  userMulti: z.any().optional(),
})

export const createFieldRequestSchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  scope: z.string().optional(),
  config: fieldConfigSchema,
  description: z.string().default(''),
})
export type CreateFieldRequest = z.infer<typeof createFieldRequestSchema>

export const updateFieldRequestSchema = z.object({
  label: z.string().optional(),
  config: fieldConfigSchema,
  description: z.string().optional(),
})
export type UpdateFieldRequest = z.infer<typeof updateFieldRequestSchema>

export const projectFieldOrderSchema = z.object({
  fieldId: z.string(),
  visible: z.boolean(),
})
export type ProjectFieldOrder = z.infer<typeof projectFieldOrderSchema>

export const updateProjectFieldsOrderRequestSchema = z.array(projectFieldOrderSchema)
export type UpdateProjectFieldsOrderRequest = z.infer<typeof updateProjectFieldsOrderRequestSchema>

export const updateAssetMetadataRequestSchema = z.object({
  key: z.string(),
  value: z.any(),
})
export type UpdateAssetMetadataRequest = z.infer<typeof updateAssetMetadataRequestSchema>

export const updateAssetMetadataRequestListSchema = z.array(updateAssetMetadataRequestSchema)

export const fieldInfoSchema = z.object({
  id: z.string(),
  config: fieldConfigSchema,
  scope: z.string(),
  readOnly: z.boolean(),
  visible: z.boolean(),
  description: z.string(),
})
export type FieldInfo = z.infer<typeof fieldInfoSchema>
