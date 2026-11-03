import { archiveAssets } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const archiveAssetsOp = implementOperation(archiveAssets, {
  authz: (input) =>
    input.assetIds.map((id) => ({
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id,
    })),
  execute: async (input) => {
    return assetService.archiveAssets(input.assetIds)
  },
  audit: (input) =>
    input.assetIds.map((assetId) => ({
      action: AuditAction.asset_archive,
      itemId: assetId,
      contextAssetId: assetId,
    })),
})
