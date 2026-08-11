import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { prisma, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import * as fs from 'fs'
import * as path from 'path'

const downloadAssetSchema = Type.Object({
  assetId: Type.String({
    description:
      'The asset ID of the workspace asset to download to local disk. This parameter is required.',
  }),
})

export function createDownloadAssetTool(userId: string): AgentTool<typeof downloadAssetSchema> {
  return {
    name: 'download_asset',
    label: 'Download Asset',
    description:
      'Downloads a workspace asset (proxy version if available) to the local .pi directory for processing with local scripts or bash commands. Remember to delete the temporary downloaded file when finished.',
    parameters: downloadAssetSchema,
    execute: async (_toolCallId, params) => {
      const assetId = params.assetId

      if (!userId) {
        throw new Error('User ID is required for authorization.')
      }

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

      const piDir = path.join(process.cwd(), '.pi')
      if (!fs.existsSync(piDir)) {
        fs.mkdirSync(piDir, { recursive: true })
      }

      const safeName = sanitizeFilename(asset.name || 'file')
      const filename = `${asset.id}_${safeName}`
      const targetFilePath = path.join(piDir, filename)
      const relativePath = path.join('.pi', filename)

      const bucket = process.env.S3_BUCKET || 'shumai'
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
    },
  }
}
