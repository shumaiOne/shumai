import * as path from 'path'
import type { DownloadAssetOutput } from '@shumai/operations'
import { AssetType, prisma, type Prisma } from '@shumai/db'
import { HTTPException } from 'hono/http-exception'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { READ_URL_EXPIRES_SECONDS } from '@shumai/core/src/asset-read/asset-read'
import { storageBucket } from '@shumai/core/src/asset-read/types'

const assetWithStorage = { storageKey: true } satisfies Prisma.AssetInclude
type AssetRecord = Prisma.AssetGetPayload<{ include: typeof assetWithStorage }>

const FOLDER_TYPES: ReadonlySet<string> = new Set([
  AssetType.folder,
  AssetType.root,
  AssetType.share_root,
  AssetType.share,
])

/**
 * The web preview version of a file: the web image for images (and the 4-view image for 3D
 * models), the transcoded video for videos, otherwise none. Matches what the built-in agent
 * has always downloaded by default.
 */
export function proxyKeyOf(media: PrismaJson.MediaInfo | null): string | undefined {
  if (!media) return undefined
  if (media.proxyType === 'image' || media.imageTranscodes?.length) {
    return media.imageTranscodes?.[0]?.key || undefined
  }
  if (media.proxyType === 'video' || media.videoTranscodes?.length || media.videoPreview?.key) {
    return media.videoTranscodes?.[0]?.key || media.videoPreview?.key || undefined
  }
  return media.original?.key || undefined
}

/** `clip.mov` downloaded as its `.mp4` proxy is saved as `clip.mp4`. */
function nameForKey(assetName: string, key: string, isOriginal: boolean): string {
  if (isOriginal) return assetName
  const ext = path.extname(key)
  if (!ext) return assetName
  const current = path.extname(assetName)
  return `${current ? assetName.slice(0, -current.length) : assetName}${ext}`
}

export class AssetDownloadService {
  /**
   * Download links for files and version stacks. The caller checks Read on every ID first.
   * Folders are rejected; version stacks resolve to their latest version and symlinks to
   * their target.
   */
  async getDownloads(
    assetIds: string[],
    opts: { proxy: boolean; includeKeys: boolean },
  ): Promise<DownloadAssetOutput> {
    const files: DownloadAssetOutput['files'] = []
    for (const assetId of [...new Set(assetIds)]) {
      const asset = await this.resolveFile(assetId)
      const originalKey = asset.storageKey?.key
      const proxyKey = opts.proxy
        ? proxyKeyOf(asset.media as PrismaJson.MediaInfo | null)
        : undefined
      const key = proxyKey || originalKey
      if (!key) {
        throw new HTTPException(400, {
          message: `Asset ${assetId} ("${asset.name}") has no file to download.`,
        })
      }
      const isOriginal = key === originalKey
      const name = nameForKey(asset.name || 'file', key, isOriginal)

      const bucket = storageBucket()
      const info = await s3Service.headObject(bucket, key).catch(() => null)
      if (!info) {
        throw new HTTPException(404, {
          message: `The file for asset ${assetId} ("${asset.name}") is missing from storage.`,
        })
      }
      const mimeType =
        info.contentType && info.contentType !== 'application/octet-stream'
          ? info.contentType
          : getFileMimeType(null, key, 'application/octet-stream')

      files.push({
        assetId: asset.id,
        name,
        kind: isOriginal ? 'original' : 'proxy',
        size: info.size,
        mimeType,
        url: await s3Service.presign(
          bucket,
          key,
          'GET',
          true,
          name,
          false,
          READ_URL_EXPIRES_SECONDS,
        ),
        ...(opts.includeKeys ? { key } : {}),
      })
    }
    return { files }
  }

  private async resolveFile(assetId: string): Promise<AssetRecord> {
    let asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: assetWithStorage,
    })
    if (asset?.type === AssetType.symlink && asset.targetId) {
      asset = await prisma.asset.findUnique({
        where: { id: asset.targetId },
        include: assetWithStorage,
      })
    }
    if (!asset || asset.isDeleted) {
      throw new HTTPException(404, { message: `Asset with ID ${assetId} not found.` })
    }
    if (FOLDER_TYPES.has(asset.type)) {
      throw new HTTPException(400, {
        message: `Asset ${assetId} ("${asset.name}") is a folder. Download the files inside it instead.`,
      })
    }
    if (asset.type === AssetType.version_stack) {
      const latest = await prisma.asset.findFirst({
        where: { parentId: asset.id, isDeleted: false },
        orderBy: { sortIndex: 'asc' },
        include: assetWithStorage,
      })
      if (!latest) {
        throw new HTTPException(400, {
          message: `Version stack ${assetId} ("${asset.name}") has no versions to download.`,
        })
      }
      asset = latest
    }
    return asset
  }
}

export const assetDownloadService = new AssetDownloadService()
