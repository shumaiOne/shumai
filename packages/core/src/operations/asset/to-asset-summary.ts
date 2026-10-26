import type { AssetSummary } from '@shumai/operations'
import type { AssetInfo } from '@shumai/dtos'

export function toAssetSummary(asset: AssetInfo): AssetSummary {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    size: Number(asset.sizeByte),
    projectId: asset.projectId ?? null,
  }
}
