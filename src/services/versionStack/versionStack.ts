import { generateKeyBetween } from 'jittered-fractional-indexing'
import { prisma } from '@shumai/db'
import { Asset, AssetType } from '@/generated/prisma/client.ts'
import { ChangeStackFileVersionParams, CreateVersionStackParams } from '@shumai/dtos'

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
        totalSize += f.sizeByte
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

      const stack = await tx.asset.create({
        data: {
          type: AssetType.version_stack,
          fileCount: files.length,
          sizeByte: totalSize,
          status: 'uploaded', // all existing files are already uploaded in the legacy go logic
          projectId: projectId,
          creatorId: creatorId,
          parentId: parentId,
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
          where: { parentId: stackId },
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
}

export const versionStackService = new VersionStackService()
