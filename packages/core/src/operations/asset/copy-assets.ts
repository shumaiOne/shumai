import { copyAssets } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { asBadRequest } from '../errors'
import { implementOperation } from '../implement'

export const copyAssetsOp = implementOperation(copyAssets, {
  authz: (input) => [
    { permission: Permission.Edit, type: ResourceType.Asset, id: input.newParentId },
    ...[...new Set(input.assetIds)].map((id) => ({
      permission: Permission.Read,
      type: ResourceType.Asset,
      id,
    })),
  ],
  execute: async (input, ctx) => {
    const copiedAssetIds = await asBadRequest(() =>
      assetService.copyAssets({
        assetIds: input.assetIds,
        newParentId: input.newParentId,
        withComments: input.withComments ?? false,
        creatorId: ctx.userId,
      }),
    )
    return { copiedAssetIds, newParentId: input.newParentId }
  },
  // One entry per source asset, recorded in the destination's team and project.
  audit: (input) =>
    input.assetIds.map((assetId) => ({
      action: AuditAction.asset_copy,
      itemId: assetId,
      contextAssetId: input.newParentId,
    })),
})
