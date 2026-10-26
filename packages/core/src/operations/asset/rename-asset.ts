import { renameAsset } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'
import { toAssetSummary } from './to-asset-summary'

export const renameAssetOp = implementOperation(renameAsset, {
  authz: (input) => [{ permission: Permission.Edit, type: ResourceType.Asset, id: input.assetId }],
  execute: async (input) =>
    toAssetSummary(await assetService.updateAssetName({ id: input.assetId, name: input.name })),
  audit: (input, output) => [
    {
      action: output.type === 'folder' ? AuditAction.folder_update : AuditAction.file_update,
      itemId: input.assetId,
      contextAssetId: input.assetId,
    },
  ],
})
