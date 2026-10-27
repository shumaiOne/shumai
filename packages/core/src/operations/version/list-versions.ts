import { HTTPException } from 'hono/http-exception'
import { listVersions } from '@shumai/operations'
import { assetService } from '@shumai/core/src/asset/asset'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { implementOperation } from '../implement'

export const listVersionsOp = implementOperation(listVersions, {
  authz: (input) => [{ permission: Permission.Read, type: ResourceType.Asset, id: input.stackId }],
  prepare: async (input) => {
    const stack = await assetService.getAssetMeta(input.stackId)
    if (stack.type !== 'version_stack') {
      throw new HTTPException(400, {
        message: 'This asset is not a version stack. Pass the ID of a version stack.',
      })
    }
  },
  execute: async (input) => {
    // Sorted latest first: the first entry is the current version.
    const versions = await assetService.getStackVersions(input.stackId)
    return {
      versions: versions.map((v, index) => ({
        id: v.id,
        version: v.version,
        name: v.name,
        current: index === 0,
        createdAt: v.createdAt,
        creator: v.creator ? { id: v.creator.id, name: v.creator.name } : null,
        agent: v.agent ?? null,
      })),
    }
  },
})
