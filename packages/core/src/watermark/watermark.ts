import { prisma, WorkflowTaskStatus, WorkflowTaskType, WatermarkStatus } from '@shumai/db'
import {
  computeWatermarkConfigHash,
  WatermarkConfigSpec,
  WatermarkConfigInfo,
  WatermarkTemplateInfo,
  ShareLinkInfo,
} from '@shumai/dtos'
import { s3Service } from '@shumai/core/src/s3/s3'
import {
  ShareLinkNotFoundError,
  ShareLinkWatermarkProcessingError,
} from '@shumai/core/src/share/errors'
import { shareService } from '@shumai/core/src/share/share'
import { logger } from '@shumai/core/src/logger'

export class WatermarkService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async upsertConfig(config: WatermarkConfigSpec) {
    const hash = computeWatermarkConfigHash(config)
    const existing = await this.prismaClient.watermarkConfig.findUnique({
      where: { hash },
    })

    if (existing) {
      return existing
    }

    return await this.prismaClient.watermarkConfig.create({
      data: {
        hash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: config as any,
      },
    })
  }

  // ----------------------------------------------------------------------
  // Watermark Template CRUD
  // ----------------------------------------------------------------------

  async createTemplate(
    teamId: string | null,
    name: string,
    config: WatermarkConfigSpec,
  ): Promise<WatermarkTemplateInfo> {
    const tpl = await this.prismaClient.watermarkTemplate.create({
      data: {
        name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: config as any,
        teamId,
      },
    })
    return this.toWatermarkTemplateInfo(tpl)
  }

  async updateTemplate(
    templateId: string,
    name?: string,
    config?: WatermarkConfigSpec,
  ): Promise<WatermarkTemplateInfo> {
    const existing = await this.prismaClient.watermarkTemplate.findUnique({
      where: { id: templateId },
    })
    if (!existing) {
      throw new Error('Watermark template not found')
    }

    const tpl = await this.prismaClient.watermarkTemplate.update({
      where: { id: templateId },
      data: {
        name: name ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: config ? (config as any) : undefined,
      },
    })
    return this.toWatermarkTemplateInfo(tpl)
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const existing = await this.prismaClient.watermarkTemplate.findUnique({
      where: { id: templateId },
    })
    if (!existing) {
      throw new Error('Watermark template not found')
    }
    await this.prismaClient.watermarkTemplate.delete({
      where: { id: templateId },
    })
  }

  async listTemplates(teamId?: string | null): Promise<WatermarkTemplateInfo[]> {
    const tpls = await this.prismaClient.watermarkTemplate.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return tpls.map((t) => this.toWatermarkTemplateInfo(t))
  }

  async getTemplate(templateId: string): Promise<WatermarkTemplateInfo> {
    const tpl = await this.prismaClient.watermarkTemplate.findUnique({
      where: { id: templateId },
    })
    if (!tpl) {
      throw new Error('Watermark template not found')
    }
    return this.toWatermarkTemplateInfo(tpl)
  }

  // ----------------------------------------------------------------------
  // ShareLink Watermark Management
  // ----------------------------------------------------------------------

  async updateShareLinkWatermark(
    shareLinkId: string,
    enabled: boolean,
    config?: WatermarkConfigSpec,
  ): Promise<ShareLinkInfo> {
    return await this.prismaClient.$transaction(async (tx) => {
      // Lock the sharelink record SELECT FOR UPDATE
      const lockedRows = await tx.$queryRaw<
        {
          id: string
          watermarkStatus: WatermarkStatus
          watermarkConfigId: string | null
        }[]
      >`SELECT id, watermark_status AS "watermarkStatus", watermark_config_id AS "watermarkConfigId" FROM share_links WHERE id = ${shareLinkId} FOR UPDATE`

      if (lockedRows.length === 0) {
        throw new ShareLinkNotFoundError('Share link not found')
      }

      const currentStatus = lockedRows[0].watermarkStatus

      if (currentStatus === WatermarkStatus.processing) {
        throw new ShareLinkWatermarkProcessingError(
          'Watermark transcoding is currently in progress',
        )
      }

      if (!enabled) {
        await tx.shareLink.update({
          where: { id: shareLinkId },
          data: {
            watermarkConfigId: null,
            watermarkStatus: WatermarkStatus.disabled,
          },
        })
        return await shareService.getShareLink(shareLinkId)
      }

      if (!config || !config.blocks || config.blocks.length === 0) {
        throw new Error('Watermark configuration is required when enabling watermark')
      }

      // Upsert watermark config based on hash
      const hash = computeWatermarkConfigHash(config)
      let watermarkConfig = await tx.watermarkConfig.findUnique({ where: { hash } })
      if (!watermarkConfig) {
        watermarkConfig = await tx.watermarkConfig.create({
          data: {
            hash,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            config: config as any,
          },
        })
      }

      await tx.shareLink.update({
        where: { id: shareLinkId },
        data: {
          watermarkConfigId: watermarkConfig.id,
          watermarkStatus: WatermarkStatus.processing,
        },
      })

      // Dispatch transcode tasks for all video/image assets in the sharelink
      await this.triggerWatermarkTranscodeForShareLink(shareLinkId, watermarkConfig.id, tx)

      return await shareService.getShareLink(shareLinkId)
    })
  }

  async getShareLinkWatermark(shareLinkId: string): Promise<{
    watermarkStatus: WatermarkStatus
    watermarkConfig: WatermarkConfigInfo | null
  }> {
    const shareLink = await this.prismaClient.shareLink.findUnique({
      where: { id: shareLinkId },
      include: { watermarkConfig: true },
    })

    if (!shareLink) {
      throw new ShareLinkNotFoundError('Share link not found')
    }

    return {
      watermarkStatus: shareLink.watermarkStatus,
      watermarkConfig: shareLink.watermarkConfig
        ? this.toWatermarkConfigInfo(shareLink.watermarkConfig)
        : null,
    }
  }

  /**
   * Finds all media file asset IDs (videos and images) contained in the sharelink,
   * including files within symlinked folders, and enqueues transcode workflow tasks.
   */
  async triggerWatermarkTranscodeForShareLink(
    shareLinkId: string,
    watermarkConfigId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txClient?: any,
  ): Promise<number> {
    const client = txClient || this.prismaClient
    const shareLink = await client.shareLink.findUnique({
      where: { id: shareLinkId },
    })
    if (!shareLink) return 0

    const targetMediaAssets = await this.getMediaAssetIdsInShareLink(shareLink.rootFolderId, client)

    if (targetMediaAssets.length === 0) {
      // If no media assets in sharelink, mark sharelink watermark as ready immediately
      await client.shareLink.update({
        where: { id: shareLinkId },
        data: { watermarkStatus: WatermarkStatus.ready },
      })
      return 0
    }

    let dispatchedCount = 0
    for (const assetId of targetMediaAssets) {
      await client.workflowTask.create({
        data: {
          assetId,
          type: WorkflowTaskType.transcode_watermark,
          status: WorkflowTaskStatus.pending,
          projectId: shareLink.projectId,
          payload: {
            watermark: {
              watermarkConfigId,
              shareLinkId,
            },
          },
        },
      })
      dispatchedCount++
    }

    return dispatchedCount
  }

  /**
   * Recursively resolves real media file asset IDs (video and image) under a sharelink root folder.
   */
  async getMediaAssetIdsInShareLink(
    rootFolderId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txClient?: any,
  ): Promise<string[]> {
    const client = txClient || this.prismaClient

    // Fetch symlinks under root folder
    const symlinks = await client.asset.findMany({
      where: {
        parentId: rootFolderId,
        type: 'symlink',
        isDeleted: false,
      },
      select: { targetId: true },
    })

    const targetIds = symlinks
      .map((s: { targetId: string | null }) => s.targetId)
      .filter(Boolean) as string[]

    if (targetIds.length === 0) return []

    // Fetch targets and resolve tree recursively
    const mediaAssetIds: string[] = []
    const queue = [...targetIds]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const currentId = queue.shift()!
      if (visited.has(currentId)) continue
      visited.add(currentId)

      const asset = await client.asset.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          type: true,
          mediaType: true,
          media: true,
          isDeleted: true,
        },
      })

      if (!asset || asset.isDeleted) continue

      if (asset.type === 'file') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaInfo = asset.media as any
        const proxyType = mediaInfo?.proxyType
        const isVideo = proxyType === 'video' || asset.mediaType?.startsWith('video/')
        const isImage = proxyType === 'image' || asset.mediaType?.startsWith('image/')

        if (isVideo || isImage) {
          mediaAssetIds.push(asset.id)
        }
      } else if (asset.type === 'folder') {
        const children = await client.asset.findMany({
          where: { parentId: asset.id, isDeleted: false },
          select: { id: true },
        })
        for (const child of children) {
          queue.push(child.id)
        }
      }
    }

    return mediaAssetIds
  }

  /**
   * Checks if all required media assets in a sharelink have completed watermark transcodes.
   * If all are completed, sets ShareLink.watermarkStatus to 'ready'.
   * If any failed, sets ShareLink.watermarkStatus to 'failed'.
   */
  async checkAndUpdateShareLinkStatus(shareLinkId: string): Promise<WatermarkStatus> {
    const shareLink = await this.prismaClient.shareLink.findUnique({
      where: { id: shareLinkId },
    })
    if (!shareLink || !shareLink.watermarkConfigId) {
      return WatermarkStatus.disabled
    }

    const watermarkConfigId = shareLink.watermarkConfigId
    const mediaAssetIds = await this.getMediaAssetIdsInShareLink(shareLink.rootFolderId)

    if (mediaAssetIds.length === 0) {
      await this.prismaClient.shareLink.update({
        where: { id: shareLinkId },
        data: { watermarkStatus: WatermarkStatus.ready },
      })
      return WatermarkStatus.ready
    }

    const watermarkFiles = await this.prismaClient.watermarkFile.findMany({
      where: {
        assetId: { in: mediaAssetIds },
        watermarkConfigId,
      },
    })

    const statusMap = new Map(watermarkFiles.map((wf) => [wf.assetId, wf.status]))

    let allCompleted = true
    let anyFailed = false

    for (const assetId of mediaAssetIds) {
      const status = statusMap.get(assetId)
      if (status === WorkflowTaskStatus.failed) {
        anyFailed = true
        allCompleted = false
        break
      }
      if (status !== WorkflowTaskStatus.completed) {
        allCompleted = false
      }
    }

    let newStatus: WatermarkStatus
    if (anyFailed) {
      newStatus = WatermarkStatus.failed
    } else if (allCompleted) {
      newStatus = WatermarkStatus.ready
    } else {
      newStatus = WatermarkStatus.processing
    }

    if (newStatus !== shareLink.watermarkStatus) {
      await this.prismaClient.shareLink.update({
        where: { id: shareLinkId },
        data: { watermarkStatus: newStatus },
      })
    }

    return newStatus
  }

  // ----------------------------------------------------------------------
  // Background Async Garbage Collection
  // ----------------------------------------------------------------------

  /**
   * Background task to prune orphan WatermarkConfig records and delete their storage files.
   * Runs as part of background cleanup.
   */
  async purgeOrphanWatermarkConfigs(): Promise<number> {
    const bucket = process.env.S3_BUCKET || 'shumai'

    // 1. Find orphan configs with 0 sharelinks attached, using FOR UPDATE SKIP LOCKED
    const orphanConfigs = await this.prismaClient.$queryRaw<{ id: string }[]>`
      SELECT wc.id FROM watermark_configs wc
      WHERE NOT EXISTS (SELECT 1 FROM share_links sl WHERE sl.watermark_config_id = wc.id)
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    `

    if (orphanConfigs.length === 0) return 0

    let purgedCount = 0

    for (const config of orphanConfigs) {
      try {
        // Fetch all watermark files for this config
        const watermarkFiles = await this.prismaClient.watermarkFile.findMany({
          where: { watermarkConfigId: config.id },
        })

        // Delete proxy files from S3
        for (const wf of watermarkFiles) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const media = wf.media as any
          if (media) {
            const keysToDelete: string[] = []
            if (Array.isArray(media.videoTranscodes)) {
              for (const vt of media.videoTranscodes) {
                if (vt.key) keysToDelete.push(vt.key)
              }
            }
            if (Array.isArray(media.imageTranscodes)) {
              for (const it of media.imageTranscodes) {
                if (it.key) keysToDelete.push(it.key)
              }
            }
            if (media.videoPreview?.key) keysToDelete.push(media.videoPreview.key)
            if (media.thumbnail?.key) keysToDelete.push(media.thumbnail.key)

            for (const key of keysToDelete) {
              try {
                await s3Service.deleteObject(bucket, key)
              } catch (s3Err) {
                logger.warn({ key, err: s3Err }, 'Failed to delete watermark proxy file from S3')
              }
            }
          }
        }

        // Delete WatermarkFiles and WatermarkConfig in DB
        await this.prismaClient.$transaction(async (tx) => {
          await tx.watermarkFile.deleteMany({
            where: { watermarkConfigId: config.id },
          })
          await tx.watermarkConfig.delete({
            where: { id: config.id },
          })
        })

        purgedCount++
        logger.info({ configId: config.id }, 'Purged orphan watermark config and proxy files')
      } catch (err) {
        logger.error({ configId: config.id, err }, 'Failed to purge orphan watermark config')
      }
    }

    return purgedCount
  }

  // ----------------------------------------------------------------------
  // DTO Mappers
  // ----------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toWatermarkTemplateInfo(t: any): WatermarkTemplateInfo {
    return {
      id: t.id,
      name: t.name,
      config: t.config as WatermarkConfigSpec,
      teamId: t.teamId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toWatermarkConfigInfo(c: any): WatermarkConfigInfo {
    return {
      id: c.id,
      config: c.config as WatermarkConfigSpec,
      hash: c.hash,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }
  }
}

export const watermarkService = new WatermarkService()
