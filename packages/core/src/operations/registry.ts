import type { OperationName, Surface } from '@shumai/operations'
import { createFolderOp } from './asset/create-folder'
import { deleteAssetOp } from './asset/delete-asset'
import { listAssetsOp } from './asset/list-assets'
import { moveAssetsOp } from './asset/move-assets'
import { getAssetRenderOp, readAssetOp } from './asset/read-asset'
import { renameAssetOp } from './asset/rename-asset'
import type { Operation } from './implement'
import { listProjectsOp } from './project/list-projects'

type ImplementedName<TOps extends readonly Operation[]> = TOps[number]['definition']['name']
type MissingNames<TOps extends readonly Operation[]> = Exclude<OperationName, ImplementedName<TOps>>

/**
 * Type-level guard: compiling fails with `missingImplementations` listing any definition in
 * `@shumai/operations` that has no implementation here.
 */
function defineRegistry<const TOps extends readonly Operation[]>(
  ops: TOps &
    ([MissingNames<TOps>] extends [never]
      ? unknown
      : { missingImplementations: MissingNames<TOps> }),
): TOps {
  return ops
}

/** Every implemented Operation. Each definition in `@shumai/operations` must appear exactly once. */
export const operations = defineRegistry([
  listProjectsOp,
  listAssetsOp,
  createFolderOp,
  renameAssetOp,
  moveAssetsOp,
  deleteAssetOp,
  readAssetOp,
  getAssetRenderOp,
] as const)

const operationsByName = new Map<string, Operation>()
for (const op of operations) {
  if (operationsByName.has(op.definition.name)) {
    throw new Error(`Duplicate operation implementation "${op.definition.name}"`)
  }
  operationsByName.set(op.definition.name, op)
}

export function getOperation(name: string): Operation | undefined {
  return operationsByName.get(name)
}

export function getOperationsForSurface(surface: Surface): Operation[] {
  return operations.filter((op) => op.definition.surfaces.includes(surface))
}
