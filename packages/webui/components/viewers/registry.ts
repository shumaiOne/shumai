import type { AssetInfo } from '@shumai/dtos'
import { FileTypeDefinition } from './types'
import { videoTypeDefinition } from './video'
import { imageTypeDefinition } from './image'
import { defaultTypeDefinition } from './default'

const registry: FileTypeDefinition[] = [videoTypeDefinition, imageTypeDefinition]

export function getViewerForFile(file: AssetInfo | null | undefined): FileTypeDefinition {
  if (!file) return defaultTypeDefinition
  const match = registry.find((viewer) => viewer.match(file))
  return match || defaultTypeDefinition
}

export function getAllViewers(): FileTypeDefinition[] {
  return registry
}
