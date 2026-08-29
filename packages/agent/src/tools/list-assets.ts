import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { encodeCursor } from '@shumai/core/src/pagination'
import { type User } from '@shumai/db'

const listAssetsSchema = Type.Object({
  parent: Type.String({
    description: 'The parent folder ID to list assets from. This parameter is required.',
  }),
  page: Type.Optional(
    Type.Number({
      description: 'The page number to retrieve, default is 1.',
      default: 1,
    }),
  ),
  pageSize: Type.Optional(
    Type.Number({
      description: 'The number of assets per page, default is 20.',
      default: 20,
    }),
  ),
  type: Type.Optional(
    Type.String({
      description: "Filter assets by type: 'file', 'folder', or 'all'. Default is 'all'.",
      enum: ['file', 'folder', 'all'],
      default: 'all',
    }),
  ),
})

export function createListAssetsTool(userId: string): AgentTool<typeof listAssetsSchema> {
  return {
    name: 'list_assets',
    label: 'List Assets',
    description: 'List the assets (files and folders) inside a parent folder with pagination.',
    parameters: listAssetsSchema,
    execute: async (_toolCallId, params) => {
      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: params.parent,
      })

      const page = params.page || 1
      const pageSize = params.pageSize || 20
      const type = params.type || 'all'

      const result = await assetService.listChildren({
        assetId: params.parent,
        assetType: type,
        first: pageSize,
        after: page > 1 ? encodeCursor((page - 1) * pageSize) : undefined,
      })

      const assets = result.data.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: Number(a.sizeByte),
      }))

      const output = {
        assets,
        pageInfo: result.pageInfo,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        details: output,
      }
    },
  }
}
