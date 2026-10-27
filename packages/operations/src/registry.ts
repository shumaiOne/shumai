import { copyAssets } from './asset/copy-assets'
import { createFolder } from './asset/create-folder'
import { deleteAsset } from './asset/delete-asset'
import { downloadAsset } from './asset/download-asset'
import { getFolderInstructions } from './asset/get-folder-instructions'
import { listAssets } from './asset/list-assets'
import { moveAssets } from './asset/move-assets'
import { getAssetRender, readAsset } from './asset/read-asset'
import { renameAsset } from './asset/rename-asset'
import { searchAssets } from './asset/search-assets'
import { createComment } from './comment/create-comment'
import { listComments } from './comment/list-comments'
import { resolveComment } from './comment/resolve-comment'
import type { AnyOperationDefinition, Surface } from './define'
import { listMetadataFields } from './metadata/list-metadata-fields'
import { updateAssetMetadata } from './metadata/update-asset-metadata'
import { listProjects } from './project/list-projects'
import { completeUpload } from './upload/complete-upload'
import { createFile } from './upload/create-file'
import { createVersion } from './upload/create-version'
import { createVersionStack } from './version/create-version-stack'
import { listVersions } from './version/list-versions'
import { removeVersion } from './version/remove-version'

/**
 * Every Operation definition. Adding one here requires a matching implementation in
 * `@shumai/core/src/operations/registry.ts` (enforced by the type checker).
 */
export const operationDefinitions = [
  listProjects,
  listAssets,
  searchAssets,
  createFolder,
  renameAsset,
  moveAssets,
  copyAssets,
  deleteAsset,
  readAsset,
  getAssetRender,
  downloadAsset,
  getFolderInstructions,
  createFile,
  createVersion,
  completeUpload,
  listComments,
  createComment,
  resolveComment,
  listMetadataFields,
  updateAssetMetadata,
  createVersionStack,
  listVersions,
  removeVersion,
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
