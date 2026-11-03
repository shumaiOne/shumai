import { restoreArchivedAssets } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const restoreArchivedAssetsOp = implementOperation(restoreArchivedAssets, {
  authz: (input) =>
    input.assetIds.map((id) => ({
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id,
    })),
  execute: async (input) => {
    return assetService.restoreArchivedAssets(input.assetIds)
  },
  audit: (input) =>
    input.assetIds.map((assetId) => ({
      action: AuditAction.asset_restore_archive,
      itemId: assetId,
      contextAssetId: assetId,
    })),
})
