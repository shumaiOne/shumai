import type { PrismaClient } from '../../../../packages/db/src/generated/prisma/client'

/**
 * Seeds a folder asset directly through the database (fast, no UI). The folder
 * is placed under `parentId` (usually a project's root folder).
 */
export async function seedFolder(
  prisma: PrismaClient,
  projectId: string,
  parentId: string,
  name: string,
) {
  return prisma.asset.create({
    data: { name, type: 'folder', status: 'processed', projectId, parentId },
  })
}

/**
 * Seeds a processed file asset directly through the database (fast, no UI).
 * The file is placed under `parentId` (a folder or a version stack).
 */
export async function seedFile(
  prisma: PrismaClient,
  projectId: string,
  parentId: string,
  name: string,
) {
  return prisma.asset.create({
    data: { name, type: 'file', status: 'processed', sizeByte: 10, projectId, parentId },
  })
}
