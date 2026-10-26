import { deleteAsset } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const deleteAssetOp = implementOperation(deleteAsset, {
  authz: (input) => [{ permission: Permission.Edit, type: ResourceType.Asset, id: input.assetId }],
  // Resolve type and team before deleting: the audit entry needs them afterwards.
  prepare: (input) => assetService.getAssetMeta(input.assetId),
  execute: async (input) => {
    await assetService.deleteAssets([input.assetId])
    return { deletedAssetId: input.assetId }
  },
  audit: (input, _output, _ctx, asset) => [
    {
      action: asset.type === 'folder' ? AuditAction.folder_delete : AuditAction.file_delete,
      itemId: input.assetId,
      teamId: asset.teamId,
      projectId: asset.projectId,
    },
  ],
})
