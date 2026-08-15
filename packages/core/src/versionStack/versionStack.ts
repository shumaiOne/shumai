import { generateKeyBetween } from 'jittered-fractional-indexing'
import { prisma } from '@shumai/db'
import { type Asset, AssetType } from '@shumai/db'
import {
  ChangeStackFileVersionParams,
  CreateVersionStackParams,
  RemoveStackVersionParams,
} from '@shumai/dtos'

function generateSortIndex(previous?: string | null): string {
  if (!previous) return generateKeyBetween(null, null)
  return generateKeyBetween(previous, null)
}

export class VersionStackService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async createVersionStack(params: CreateVersionStackParams): Promise<Asset> {
    const { fileIds, projectId, creatorId } = params

    if (!fileIds || fileIds.length === 0) {
      throw new Error('no file ids provided')
    }

    return await this.prismaClient.$transaction(async (tx) => {
      const files = await tx.asset.findMany({
        where: { id: { in: fileIds } },
        include: { parent: true },
      })

      if (files.length !== fileIds.length) {
        throw new Error('some files not found')
      }

      let parentId: string | undefined = undefined
      let totalSize = 0

      for (const f of files) {
        if (f.type !== AssetType.file) {
          throw new Error(`asset ${f.id} is not a file`)
        }
        if (!f.parentId) {
          throw new Error(`file ${f.id} does not have a parent`)
        }

        if (parentId === undefined) {
          parentId = f.parentId
        } else if (f.parentId !== parentId) {
          throw new Error('files do not have the same parent')
        }
        totalSize += Number(f.sizeByte)
      }

      if (!parentId) {
        throw new Error('files do not have a parent')
      }

      const parent = await tx.asset.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        throw new Error('parent not found')
      }

      const firstFile = files.find((f) => f.id === fileIds[0])
      const sortIndex = firstFile?.sortIndex || null

      const stack = await tx.asset.create({
        data: {
          type: AssetType.version_stack,
          fileCount: files.length,
          sizeByte: totalSize,
          status: 'uploaded', // all existing files are already uploaded in the legacy go logic
          projectId: projectId,
          creatorId: creatorId,
          parentId: parentId,
          sortIndex: sortIndex,
        },
      })

      let currentSortIndex: string | null = null
      for (const fileId of fileIds) {
        currentSortIndex = generateSortIndex(currentSortIndex)
        await tx.asset.update({
          where: { id: fileId },
          data: {
            parentId: stack.id,
            sortIndex: currentSortIndex,
          },
        })
      }

      await tx.asset.update({
        where: { id: parentId },
        data: {
          fileCount: {
            decrement: files.length - 1,
          },
        },
      })

      // Update existing symlinks pointing to any of the stacked files
      const existingSymlinks = await tx.asset.findMany({
        where: { targetId: { in: fileIds }, type: AssetType.symlink },
      })
      const processedParentIds = new Set<string>()
      for (const symlink of existingSymlinks) {
        if (!symlink.parentId) continue
        if (processedParentIds.has(symlink.parentId)) {
          await tx.asset.delete({ where: { id: symlink.id } })
          await tx.asset.update({
            where: { id: symlink.parentId },
            data: { fileCount: { decrement: 1 } },
          })
        } else {
          processedParentIds.add(symlink.parentId)
          await tx.asset.update({
            where: { id: symlink.id },
            data: { targetId: stack.id },
          })
        }
      }

      return stack
    })
  }

  async changeStackFileVersion(params: ChangeStackFileVersionParams): Promise<void> {
    const { stackId, fileId, beforeId } = params

    await this.prismaClient.$transaction(async (tx) => {
      const stack = await tx.asset.findUnique({
        where: { id: stackId },
      })
      if (!stack) {
        throw new Error('stack not found')
      }
      if (stack.type !== AssetType.version_stack) {
        throw new Error('asset is not a version stack')
      }

      const fileToMove = await tx.asset.findUnique({
        where: { id: fileId },
      })
      if (!fileToMove) {
        throw new Error('file not found')
      }
      if (fileToMove.parentId !== stackId) {
        throw new Error('file is not in the stack')
      }

      let newSortIndex: string

      if (beforeId === '-1') {
        const lastFile = await tx.asset.findFirst({
          where: { parentId: stackId, id: { not: fileId } },
          orderBy: { sortIndex: 'desc' },
        })
        newSortIndex = generateKeyBetween(lastFile?.sortIndex || null, null)
      } else {
        const beforeFile = await tx.asset.findUnique({
          where: { id: beforeId },
        })
        if (!beforeFile) {
          throw new Error('before_id file not found')
        }
        if (beforeFile.parentId !== stackId) {
          throw new Error('before_id file is not in the stack')
        }

        const prevFile = await tx.asset.findFirst({
          where: {
            parentId: stackId,
            id: { not: fileId },
            sortIndex: {
              lt: beforeFile.sortIndex!,
            },
          },
          orderBy: { sortIndex: 'desc' },
        })

        let prevSortIndex = prevFile?.sortIndex || null
        if (prevSortIndex && prevSortIndex >= beforeFile.sortIndex!) {
          prevSortIndex = null
        }

        newSortIndex = generateKeyBetween(prevSortIndex, beforeFile.sortIndex!)
      }

      await tx.asset.update({
        where: { id: fileId },
        data: {
          sortIndex: newSortIndex,
        },
      })
    })
  }

  async removeVersionFromStack(params: RemoveStackVersionParams): Promise<void> {
    const { stackId, fileId } = params

    await this.prismaClient.$transaction(async (tx) => {
      const stack = await tx.asset.findUnique({
        where: { id: stackId },
      })
      if (!stack) {
        throw new Error('stack not found')
      }
      if (stack.type !== AssetType.version_stack) {
        throw new Error('asset is not a version stack')
      }
      if (!stack.parentId) {
        throw new Error('stack has no parent')
      }

      const fileToRemove = await tx.asset.findUnique({
        where: { id: fileId },
      })
      if (!fileToRemove) {
        throw new Error('file not found')
      }
      if (fileToRemove.parentId !== stackId) {
        throw new Error('file is not in the stack')
      }

      // Find next sibling in parent folder after the stack to insert the removed file adjacent to the stack
      const nextSibling = await tx.asset.findFirst({
        where: {
          parentId: stack.parentId,
          id: { not: stack.id },
          sortIndex: {
            gt: stack.sortIndex || '',
          },
        },
        orderBy: { sortIndex: 'asc' },
      })

      let newSortIndex: string
      try {
        newSortIndex = generateKeyBetween(stack.sortIndex || null, nextSibling?.sortIndex || null)
      } catch {
        newSortIndex = generateKeyBetween(null, null)
      }

      await tx.asset.update({
        where: { id: fileId },
        data: {
          parentId: stack.parentId,
          sortIndex: newSortIndex,
        },
      })

      // Increment parent folder fileCount for the newly standalone file
      await tx.asset.update({
        where: { id: stack.parentId },
        data: {
          fileCount: { increment: 1 },
        },
      })

      // Remaining files in stack
      const remainingFiles = await tx.asset.findMany({
        where: { parentId: stackId, isDeleted: false, id: { not: fileId } },
        orderBy: { sortIndex: 'asc' },
      })

      if (remainingFiles.length > 1) {
        let totalSize = 0
        for (const f of remainingFiles) {
          totalSize += Number(f.sizeByte)
        }
        await tx.asset.update({
          where: { id: stack.id },
          data: {
            fileCount: remainingFiles.length,
            sizeByte: totalSize,
          },
        })
      } else if (remainingFiles.length === 1) {
        const lastChild = remainingFiles[0]

        // Update symlinks pointing to stack.id to point to the single remaining child
        await tx.asset.updateMany({
          where: { targetId: stack.id, type: AssetType.symlink },
          data: { targetId: lastChild.id },
        })

        // Reparent the single remaining child to stack.parentId, keeping stack's sortIndex
        await tx.asset.update({
          where: { id: lastChild.id },
          data: {
            parentId: stack.parentId,
            sortIndex: stack.sortIndex,
          },
        })

        // Delete the stack asset (parent folder file count is unchanged: -1 stack, +1 remaining child)
        await tx.asset.delete({
          where: { id: stack.id },
        })
      } else {
        await tx.asset.deleteMany({
          where: { targetId: stack.id, type: AssetType.symlink },
        })
        await tx.asset.delete({
          where: { id: stack.id },
        })
        await tx.asset.update({
          where: { id: stack.parentId },
          data: { fileCount: { decrement: 1 } },
        })
      }
    })
  }
}

export const versionStackService = new VersionStackService()
