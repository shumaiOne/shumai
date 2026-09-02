import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { prisma, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import * as fs from 'fs'
import * as path from 'path'

export const downloadAssetSchema = Type.Object(
  {
    assetId: Type.Union([
      Type.String({
        description:
          'The asset ID of the workspace asset to download to local disk, or null if providing "key".',
      }),
      Type.Null(),
    ]),
    key: Type.Union([
      Type.String({
        description:
          'The storage S3 key of a specific media artifact (e.g. a screenshot or transcode key from read_asset) to download to local disk, or null if providing "assetId".',
      }),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
)

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

export function createDownloadAssetTool(userId: string): AgentTool<typeof downloadAssetSchema> {
  return {
    name: 'download_asset',
    label: 'Download Asset',
    description:
      'Downloads a workspace asset or specific storage S3 key to the local .pi directory for processing with local scripts or bash commands. ' +
      'Provide exactly one of "assetId" (for full assets) or "key" (for intermediate artifacts like screenshots from read_asset). ' +
      'Remember to delete the temporary downloaded file when finished.',
    parameters: downloadAssetSchema,
    execute: async (_toolCallId, params) => {
      const { assetId, key } = params

      if (!userId) {
        throw new Error('User ID is required for authorization.')
      }

      const hasAssetId = assetId !== null
      const hasKey = key !== null

      if (hasAssetId === hasKey) {
        throw new Error(
          'Provide exactly one of "assetId" (to download a workspace asset) or "key" (to download a specific S3 storage key). Set the unused parameter to null.',
        )
      }

      const piDir = path.join(process.cwd(), '.pi')
      if (!fs.existsSync(piDir)) {
        fs.mkdirSync(piDir, { recursive: true })
      }

      const bucket = process.env.S3_BUCKET || 'shumai'

      // Branch A: Download by assetId
      if (assetId) {
        await authzService.hasPermission({
          user: { id: userId } as User,
          permission: Permission.Read,
          type: ResourceType.Asset,
          id: assetId,
        })

        let asset = await prisma.asset.findUnique({
          where: { id: assetId },
          include: { storageKey: true },
        })

        if (!asset) {
          throw new Error(`Asset with ID ${assetId} not found.`)
        }

        if (asset.type === 'version_stack') {
          const latestVersion = await prisma.asset.findFirst({
            where: { parentId: asset.id, isDeleted: false },
            orderBy: { sortIndex: 'asc' },
            include: { storageKey: true },
          })
          if (latestVersion) {
            asset = latestVersion
          }
        }

        let mediaKey = asset.storageKey?.key

        if (asset.media) {
          const mediaInfo = asset.media as unknown as PrismaJson.MediaInfo
          if (
            mediaInfo.proxyType === 'image' ||
            (mediaInfo.imageTranscodes && mediaInfo.imageTranscodes.length > 0)
          ) {
            if (mediaInfo.imageTranscodes && mediaInfo.imageTranscodes.length > 0) {
              mediaKey = mediaInfo.imageTranscodes[0].key || mediaKey
            }
          } else if (
            mediaInfo.proxyType === 'video' ||
            (mediaInfo.videoTranscodes && mediaInfo.videoTranscodes.length > 0) ||
            mediaInfo.videoPreview?.key
          ) {
            if (mediaInfo.videoTranscodes && mediaInfo.videoTranscodes.length > 0) {
              mediaKey = mediaInfo.videoTranscodes[0].key || mediaKey
            } else if (mediaInfo.videoPreview?.key) {
              mediaKey = mediaInfo.videoPreview.key
            }
          } else if (mediaInfo.original?.key) {
            mediaKey = mediaInfo.original.key || mediaKey
          }
        }

        if (!mediaKey) {
          throw new Error(`No media content found for asset ${assetId}.`)
        }

        const safeName = sanitizeFilename(asset.name || 'file')
        const filename = `${asset.id}_${safeName}`
        const targetFilePath = path.join(piDir, filename)
        const relativePath = path.join('.pi', filename)

        const { buffer, contentType } = await s3Service.getObject(bucket, mediaKey)
        fs.writeFileSync(targetFilePath, buffer)

        return {
          content: [
            {
              type: 'text',
              text: `Downloaded asset "${asset.name}" (ID: ${assetId}) to "${relativePath}". Remember to delete this temporary file when finished.`,
            },
          ],
          details: {
            assetId,
            name: asset.name,
            filePath: relativePath,
            absolutePath: targetFilePath,
            contentType: contentType || 'application/octet-stream',
            size: buffer.length,
          },
        }
      }

      // Branch B: Download by S3 storage key
      if (key) {
        const owningAssetId = await resolveAssetIdFromKey(key)

        await authzService.hasPermission({
          user: { id: userId } as User,
          permission: Permission.Read,
          type: ResourceType.Asset,
          id: owningAssetId,
        })

        const rawBasename = path.basename(key)
        const safeBasename = sanitizeFilename(rawBasename) || 'downloaded_file'
        const filename = safeBasename
        const targetFilePath = path.join(piDir, filename)
        const relativePath = path.join('.pi', filename)

        const { buffer, contentType } = await s3Service.getObject(bucket, key)
        fs.writeFileSync(targetFilePath, buffer)

        return {
          content: [
            {
              type: 'text',
              text: `Downloaded storage key "${key}" to "${relativePath}". Remember to delete this temporary file when finished.`,
            },
          ],
          details: {
            key,
            assetId: owningAssetId,
            filePath: relativePath,
            absolutePath: targetFilePath,
            contentType: contentType || 'application/octet-stream',
            size: buffer.length,
          },
        }
      }

      throw new Error('Invalid download_asset parameters.')
    },
  }
}
