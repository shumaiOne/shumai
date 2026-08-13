import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'

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
      const result = await executeAgentToolWorkflow({
        toolName: 'list_assets',
        args: params,
        userId,
        assetId: params.parent,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
    },
  }
}
