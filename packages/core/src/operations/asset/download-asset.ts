import { downloadAsset } from '@shumai/operations'
import { assetDownloadService } from '@shumai/core/src/asset-download/asset-download'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const downloadAssetOp = implementOperation(downloadAsset, {
  authz: (input) =>
    [...new Set(input.assetIds)].map((id) => ({
      permission: Permission.Read,
      type: ResourceType.Asset,
      id,
    })),
  execute: (input, ctx) =>
    assetDownloadService.getDownloads(input.assetIds, {
      proxy: input.proxy !== false,
      // The built-in agent saves files into its sandbox straight from storage.
      includeKeys: ctx.via === 'agent',
    }),
})
