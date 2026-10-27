import { HTTPException } from 'hono/http-exception'
import { updateAssetMetadata } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { notificationService } from '@shumai/core/src/notification/notification'
import { asBadRequest, badRequest } from '../errors'
import { implementOperation } from '../implement'

export const updateAssetMetadataOp = implementOperation(updateAssetMetadata, {
  authz: (input) => [{ permission: Permission.Edit, type: ResourceType.Asset, id: input.assetId }],
  // Check every key before writing anything: unknown keys would otherwise fail halfway.
  prepare: async (input) => {
    const keys = Object.keys(input.values)
    if (keys.length === 0) throw badRequest('values must set at least one field')

    const asset = await assetService.getAssetMeta(input.assetId)
    if (!asset.projectId) throw badRequest('This asset does not belong to a project')

    const fields = new Map(
      (await metadataService.listProjectFields(null, asset.projectId)).map((f) => [
        f.field.key,
        f.field,
      ]),
    )
    const unknown = keys.filter((key) => !fields.has(key))
    if (unknown.length > 0) {
      throw badRequest(
        `Unknown metadata field(s): ${unknown.join(', ')}. Use list_metadata_fields to get the field keys.`,
      )
    }
    const readOnly = keys.filter((key) => fields.get(key)?.readOnly)
    if (readOnly.length > 0) {
      throw new HTTPException(422, { message: `Field ${readOnly.join(', ')} is read-only` })
    }
    return asset
  },
  execute: async (input, ctx, asset) => {
    const updates = Object.entries(input.values).map(([key, value]) => ({ key, value }))
    await asBadRequest(() => metadataService.updateAssetMetadata(input.assetId, updates))

    if ('status' in input.values) {
      await notificationService.create({
        type: 'metadata_field_updated_status',
        teamId: asset.teamId,
        creatorId: ctx.userId,
        assetId: input.assetId,
      })
    }
    return { assetId: input.assetId, updatedKeys: updates.map((u) => u.key) }
  },
  audit: (input, _output, _ctx, asset) => [
    {
      action: asset.type === 'folder' ? AuditAction.folder_update : AuditAction.file_update,
      itemId: input.assetId,
      teamId: asset.teamId,
      projectId: asset.projectId,
    },
  ],
})
