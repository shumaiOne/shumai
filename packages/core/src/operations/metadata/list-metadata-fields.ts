import { listMetadataFields, type MetadataFieldSummary } from '@shumai/operations'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { implementOperation } from '../implement'

interface FieldRecord {
  key: string
  readOnly: boolean
  description: string | null
  config: PrismaJson.FieldConfig | null
}

export function toMetadataFieldSummary(field: FieldRecord): MetadataFieldSummary {
  const config = field.config
  const choices =
    config?.type === 'select'
      ? config.select?.options
      : config?.type === 'selectMulti'
        ? config.selectMulti?.options
        : undefined
  return {
    key: field.key,
    name: config?.name ?? field.key,
    type: config?.type ?? 'text',
    description: field.description ?? '',
    readOnly: field.readOnly,
    creationContext: config?.autofillSource === 'CREATION_CONTEXT',
    ...(choices ? { options: choices.map((o) => ({ id: o.id, name: o.displayName })) } : {}),
  }
}

export const listMetadataFieldsOp = implementOperation(listMetadataFields, {
  authz: (input) => [
    { permission: Permission.Read, type: ResourceType.Project, id: input.projectId },
  ],
  execute: async (input, ctx) => {
    const fields = await metadataService.listProjectFields(ctx.userId, input.projectId)
    return { fields: fields.map((f) => toMetadataFieldSummary(f.field)) }
  },
})
