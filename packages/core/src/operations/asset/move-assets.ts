import { moveAssets } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const moveAssetsOp = implementOperation(moveAssets, {
  authz: (input) => [
    { permission: Permission.Edit, type: ResourceType.Asset, id: input.newParentId },
    ...input.assetIds.map((id) => ({
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id,
    })),
  ],
  execute: async (input, ctx) => {
    await assetService.reparentAssets({
      assetIds: input.assetIds,
      newParentId: input.newParentId,
      creatorId: ctx.userId,
    })
    return { movedAssetIds: input.assetIds, newParentId: input.newParentId }
  },
  audit: (input) =>
    input.assetIds.map((assetId) => ({
      action: AuditAction.asset_reparent,
      itemId: assetId,
      contextAssetId: input.newParentId,
    })),
})
