import type { CliCommandExtension } from '../generate'
import { downloadAssetExtension } from './download-asset'
import { getAssetRenderExtension, readAssetExtension } from './read-asset'

/** CLI-specific behavior for generated commands, by Operation name. */
export const cliExtensions: ReadonlyMap<string, CliCommandExtension> = new Map([
  ['read_asset', readAssetExtension],
  ['get_asset_render', getAssetRenderExtension],
  ['download_asset', downloadAssetExtension],
])
