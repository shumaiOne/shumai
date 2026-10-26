import { DEFAULT_PAGE_SIZE, listAssets } from '@shumai/operations'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'
import { toAssetSummary } from './to-asset-summary'

export const listAssetsOp = implementOperation(listAssets, {
  authz: (input) => [{ permission: Permission.Read, type: ResourceType.Asset, id: input.parent }],
  execute: async (input) => {
    const result = await assetService.listChildren({
      assetId: input.parent,
      assetType: input.type ?? 'all',
      first: input.first ?? DEFAULT_PAGE_SIZE,
      after: input.after,
    })
    return {
      data: result.data.map(toAssetSummary),
      pageInfo: {
        hasNextPage: Boolean(result.pageInfo.cursor),
        endCursor: result.pageInfo.cursor ?? null,
      },
      total: result.pageInfo.total ?? result.data.length,
    }
  },
})
