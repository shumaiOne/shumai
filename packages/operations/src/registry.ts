import { createFolder } from './asset/create-folder'
import { deleteAsset } from './asset/delete-asset'
import { listAssets } from './asset/list-assets'
import { moveAssets } from './asset/move-assets'
import { getAssetRender, readAsset } from './asset/read-asset'
import { renameAsset } from './asset/rename-asset'
import type { AnyOperationDefinition, Surface } from './define'
import { listProjects } from './project/list-projects'

/**
 * Every Operation definition. Adding one here requires a matching implementation in
 * `@shumai/core/src/operations/registry.ts` (enforced by the type checker).
 */
export const operationDefinitions = [
  listProjects,
  listAssets,
  createFolder,
  renameAsset,
  moveAssets,
  deleteAsset,
  readAsset,
  getAssetRender,
] as const

export type RegisteredOperationDefinition = (typeof operationDefinitions)[number]
export type OperationName = RegisteredOperationDefinition['name']
export type OperationDefinitionByName<TName extends OperationName> = Extract<
  RegisteredOperationDefinition,
  { name: TName }
>

const definitionsByName = new Map<string, AnyOperationDefinition>()
for (const definition of operationDefinitions) {
  if (definitionsByName.has(definition.name)) {
    throw new Error(`Duplicate operation name "${definition.name}"`)
  }
  definitionsByName.set(definition.name, definition)
}

export function getOperationDefinition(name: string): AnyOperationDefinition | undefined {
  return definitionsByName.get(name)
}

export function getOperationDefinitionsForSurface(surface: Surface): AnyOperationDefinition[] {
  return operationDefinitions.filter((definition) => definition.surfaces.includes(surface))
}
