import { getAssetRenderMcpExtension, readAssetMcpExtension } from './read-asset'
import type { McpToolExtension } from './types'

export type { McpToolExtension } from './types'

/** MCP-specific presentation for Operations, by Operation name. */
export const mcpExtensions: ReadonlyMap<string, McpToolExtension> = new Map([
  ['read_asset', readAssetMcpExtension],
  ['get_asset_render', getAssetRenderMcpExtension],
])
