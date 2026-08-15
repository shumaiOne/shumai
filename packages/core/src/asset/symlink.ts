import { Prisma } from '@shumai/db'
import { AssetType } from '@shumai/db'

interface DedupeSymlinksParams {
  /** Files being merged into a version stack — symlinks pointing at them are the candidates. */
  targetIds: string[]
  /** The version stack the files are moving into. */
  newTargetId: string
  /** Optional name to set on repointed symlinks ('' for stacks — display name comes from the latest version). */
  name?: string
}

/**
 * When files are merged into a version stack, symlinks in share folders that
 * pointed at those files must either be repointed to the stack (one per parent)
 * or deleted as duplicates. Per parent folder: if the parent already shows the
 * stack (either before this call or after the first repoint), delete the
 * incoming symlink and decrement the parent's fileCount; otherwise repoint the
 * first symlink to the stack.
 */
export async function dedupeSymlinksToTarget(
  tx: Prisma.TransactionClient,
  { targetIds, newTargetId, name }: DedupeSymlinksParams,
): Promise<void> {
  const existingSymlinks = await tx.asset.findMany({
    where: { targetId: { in: targetIds }, type: AssetType.symlink },
  })
  if (existingSymlinks.length === 0) return

  // Parents that already display the stack (or will after the first repoint).
  const stackSymlinkParents = new Set(
    (
      await tx.asset.findMany({
        where: { targetId: newTargetId, type: AssetType.symlink },
        select: { parentId: true },
      })
    )
      .map((s) => s.parentId)
      .filter((id): id is string => !!id),
  )

  for (const symlink of existingSymlinks) {
    if (!symlink.parentId) continue
    if (stackSymlinkParents.has(symlink.parentId)) {
      await tx.asset.delete({ where: { id: symlink.id } })
      await tx.asset.update({
        where: { id: symlink.parentId },
        data: { fileCount: { decrement: 1 } },
      })
    } else {
      stackSymlinkParents.add(symlink.parentId)
      await tx.asset.update({
        where: { id: symlink.id },
        data: { targetId: newTargetId, ...(name !== undefined ? { name } : {}) },
      })
    }
  }
}
