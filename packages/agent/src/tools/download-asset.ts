// Storage-key helpers shared by download_asset (operation-extensions) and the media generation tools.
import { prisma, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'

export async function resolveAssetIdFromKey(key: string): Promise<string> {
  if (!key.startsWith('files/') || key.includes('..')) {
    throw new Error(
      'Invalid storage key format: key must start with "files/" and cannot contain "..".',
    )
  }

  const segments = key.split('/')
  if (segments.length < 3) {
    throw new Error(
      'Invalid storage key format: key must follow "files/<identifier>/<path>" structure.',
    )
  }

  const identifier = segments[1]

  // 1. Check if identifier is directly an Asset ID (Derived Artifacts: screenshots, pdf_pages, annotations, proxies)
  const assetById = await prisma.asset.findUnique({
    where: { id: identifier, isDeleted: false },
    select: { id: true },
  })
  if (assetById) {
    return assetById.id
  }

  // 2. Check if identifier is a StorageKey directory prefix (Original uploads / agent-created files)
  const storageKeyByPrefix = await prisma.storageKey.findFirst({
    where: { key: { startsWith: `files/${identifier}/` } },
    include: {
      assets: {
        where: { isDeleted: false },
        select: { id: true },
      },
    },
  })
  if (storageKeyByPrefix?.assets && storageKeyByPrefix.assets.length > 0) {
    return storageKeyByPrefix.assets[0].id
  }

  // 3. Exact StorageKey fallback
  const exactStorageKey = await prisma.storageKey.findUnique({
    where: { key },
    include: {
      assets: {
        where: { isDeleted: false },
        select: { id: true },
      },
    },
  })
  if (exactStorageKey?.assets && exactStorageKey.assets.length > 0) {
    return exactStorageKey.assets[0].id
  }

  throw new Error(
    `Storage key "${key}" does not belong to any valid asset or the asset has been deleted.`,
  )
}

export async function resolveS3MediaBuffer(
  key: string,
  userId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!userId) {
    throw new Error('User ID is required for authorization.')
  }
  const owningAssetId = await resolveAssetIdFromKey(key)

  await authzService.hasPermission({
    user: { id: userId } as User,
    permission: Permission.Read,
    type: ResourceType.Asset,
    id: owningAssetId,
  })

  const bucket = process.env.S3_BUCKET || 'shumai'
  const { buffer, contentType } = await s3Service.getObject(bucket, key)
  const mimeType = getFileMimeType(
    buffer,
    key,
    contentType && contentType !== 'application/octet-stream'
      ? contentType
      : 'application/octet-stream',
  )

  if (!mimeType.startsWith('image/')) {
    throw new Error(`Storage key "${key}" has MIME type "${mimeType}", but an image is required.`)
  }

  return { buffer, mimeType }
}
