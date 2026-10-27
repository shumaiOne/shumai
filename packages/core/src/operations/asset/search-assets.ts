import { DEFAULT_PAGE_SIZE, searchAssets } from '@shumai/operations'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { searchService } from '@shumai/core/src/search/search'
import { asBadRequest } from '../errors'
import { implementOperation } from '../implement'
import { toAssetSummary } from './to-asset-summary'

export const searchAssetsOp = implementOperation(searchAssets, {
  authz: (input) => [{ permission: Permission.Read, type: ResourceType.Asset, id: input.parent }],
  execute: async (input) => {
    const semantic = Boolean(input.query && input.semantic)
    const conditions = (input.conditions ?? []).map((c) => ({ ...c, value: c.value ?? null }))
    // Name search is a `name contains` condition (always combined with AND); only
    // semantic search uses the query text itself.
    if (input.query && !semantic) {
      conditions.push({ field: 'name', operator: 'contains', value: input.query })
    }
    const result = await asBadRequest(() =>
      searchService.search(input.parent, {
        query: semantic ? input.query : undefined,
        isSemantic: semantic,
        assetType: input.type,
        recursively: input.recursive ?? true,
        conditions,
        operator: input.matchAny ? 'OR' : 'AND',
        first: input.first ?? DEFAULT_PAGE_SIZE,
        after: input.after,
      }),
    )
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
