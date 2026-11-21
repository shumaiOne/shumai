import { prisma } from '@shumai/db'
import { Prisma, AssetType } from '@shumai/db'
import { AssetService, assetService } from '@shumai/core/src/asset/asset'
import type { AssetInfo, ImageSearchRequest, SearchRequest } from '@shumai/dtos'
import { PaginatedData, decodeCursor, encodeCursor, PageInfo } from '@shumai/core/src/pagination'
import { generateSearchNgrams } from '@shumai/core/src/utils/ngram'
import { HTTPException } from 'hono/http-exception'
import { getImageEmbeddingDimensions, imageEmbeddingService } from './image-embedding'
import { SqlQueryBuilder } from './sql-query-builder'
import { TextEmbeddingService, textEmbeddingService } from './text-embedding'
import { isPartialVideoRange } from '../transcode/video-chunk-preview'
import { chunkKey, videoChunkPreviewService } from './video-chunk-preview'

export class SearchService {
  constructor(
    private readonly prismaClient: typeof prisma = prisma,
    private readonly assetSvc: AssetService = assetService,
    private readonly embeddingSvc: TextEmbeddingService = textEmbeddingService,
  ) {}

  async search(folderId: string, req: SearchRequest): Promise<PaginatedData<AssetInfo[]>> {
    const targetFolderIds =
      req.recursively === false ? [folderId] : await this.assetSvc.getDescendantFolderIds(folderId)

    const targetTypes =
      req.assetType === 'folder' ? [AssetType.folder] : [AssetType.file, AssetType.version_stack]

    if (req.query && req.isSemantic) {
      const folder = await this.prismaClient.asset.findUnique({
        where: { id: folderId },
        select: { project: { select: { teamId: true } } },
      })
      const teamId = folder?.project?.teamId
      if (!teamId) throw new Error('Team ID not found for folder')
      await this.requireEmbeddingAgent(teamId)

      let vector: number[]
      try {
        const result = await this.embeddingSvc.generateEmbedding(req.query, { teamId })
        vector = result.embedding
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new HTTPException(502, {
          message: `Failed to generate query embedding: ${msg}`,
        })
      }
      if (!vector || vector.length === 0) {
        throw new HTTPException(502, {
          message: 'Failed to generate query embedding: empty vector returned',
        })
      }

      return this.searchByEmbedding(
        targetFolderIds,
        req,
        JSON.stringify(vector),
        vector.length === 768 ? 768 : 1536,
      )
    }

    // ----------------------------------------------------------------------
    // Non-semantic search (using SqlQueryBuilder)
    // ----------------------------------------------------------------------
    const builder = new SqlQueryBuilder()
      .select(Prisma.sql`a.id as "assetId"`)
      .from(Prisma.sql`assets a`)
      .addWhere(Prisma.sql`a.is_deleted = false`)

    if (targetFolderIds.length > 0) {
      builder.addWhere(Prisma.sql`a.parent_id = ANY(${targetFolderIds})`)
    }

    if (req.showSymlink) {
      builder.addWhere(Prisma.sql`
        (a.type = ANY(${targetTypes}::"AssetType"[]) OR (a.type = 'symlink' AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(${targetTypes}::"AssetType"[]))))
      `)
    } else {
      builder.addWhere(Prisma.sql`a.type = ANY(${targetTypes}::"AssetType"[])`)
    }

    if (req.conditions && req.conditions.length > 0) {
      builder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
    }

    // name contains n-grams / Switching Search Optimization
    let countOverride: number | undefined
    let useNgram = false
    let valStr = ''
    let ngrams: string[] = []

    const nameCond = req.conditions?.find((c) => c.field === 'name' && c.operator === 'contains')

    if (nameCond) {
      valStr = String(nameCond.value)
      ngrams = generateSearchNgrams(valStr)

      if (ngrams.length > 0) {
        const PROBE_LIMIT = 10001

        // Build SQL probe query to limit and fetch selective IDs
        const probeBuilder = new SqlQueryBuilder()
          .select(Prisma.sql`a.id`)
          .from(Prisma.sql`assets a`)
          .addWhere(Prisma.sql`a.is_deleted = false`)

        if (targetFolderIds.length > 0) {
          probeBuilder.addWhere(Prisma.sql`a.parent_id = ANY(${targetFolderIds})`)
        }

        if (req.showSymlink) {
          probeBuilder.addWhere(Prisma.sql`
            (a.type = ANY(${targetTypes}::"AssetType"[]) OR (a.type = 'symlink' AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(${targetTypes}::"AssetType"[]))))
          `)
        } else {
          probeBuilder.addWhere(Prisma.sql`a.type = ANY(${targetTypes}::"AssetType"[])`)
        }

        if (req.conditions && req.conditions.length > 0) {
          probeBuilder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
        }

        probeBuilder.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
        probeBuilder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
        probeBuilder.limit(PROBE_LIMIT)

        const probeMatches = await this.prismaClient.$queryRaw<{ id: string }[]>(
          probeBuilder.build(),
        )
        const probeCount = probeMatches.length

        if (probeCount < PROBE_LIMIT) {
          useNgram = true
          countOverride = probeCount
        } else {
          countOverride = PROBE_LIMIT
        }
      }
    }

    if (nameCond) {
      if (useNgram && ngrams.length > 0) {
        builder.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
        builder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
      } else {
        builder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
      }
    }

    // Sorting
    let orderSql = Prisma.sql`a.sort_index ASC`
    if (req.sort) {
      const direction = req.sort.order === 'desc' ? Prisma.raw('DESC') : Prisma.raw('ASC')
      if (req.sort.field === 'custom') {
        orderSql = Prisma.sql`a.sort_index ASC`
      } else if (req.sort.field === 'name') {
        orderSql = Prisma.sql`a.name ${direction}`
      } else if (req.sort.field === 'created_at' || req.sort.field === 'createdAt') {
        orderSql = Prisma.sql`a.created_at ${direction}`
      } else if (req.sort.field === 'size_byte' || req.sort.field === 'sizeByte') {
        orderSql = Prisma.sql`a.size_byte ${direction}`
      } else {
        orderSql = Prisma.sql`a.id DESC`
      }
    }
    builder.orderBy(orderSql)

    // Paginate in SQL using limit/offset
    let limit = req.first || 20
    if (limit <= 0 || limit > 200) {
      limit = 20
    }

    let offset = 0
    if (req.after) {
      offset = decodeCursor(req.after)
    }

    builder.limit(limit + 1).offset(offset)

    // Execute raw SQL query
    const query = builder.build()
    const matches = await this.prismaClient.$queryRaw<{ assetId: string }[]>(query)

    const hasNextPage = matches.length > limit
    const finalMatches = hasNextPage ? matches.slice(0, limit) : matches

    // Map back to full rich metadata
    const uniqueIds = Array.from(new Set(finalMatches.map((m) => m.assetId)))
    const fetchedInfos = await this.assetSvc.listAssetsByIds(uniqueIds, req.previewFormat)
    const assetInfosMap = new Map<string, AssetInfo>()
    for (const info of fetchedInfos) {
      assetInfosMap.set(info.id, info)
    }

    const data: AssetInfo[] = []
    for (const match of finalMatches) {
      const baseInfo = assetInfosMap.get(match.assetId)
      if (baseInfo) {
        data.push(baseInfo)
      }
    }

    const pageInfo: PageInfo = {}
    let totalCount = countOverride
    if (totalCount === undefined) {
      const countBuilder = new SqlQueryBuilder()
        .select(Prisma.sql`COUNT(*)`)
        .from(Prisma.sql`assets a`)
        .addWhere(Prisma.sql`a.is_deleted = false`)

      if (targetFolderIds.length > 0) {
        countBuilder.addWhere(Prisma.sql`a.parent_id = ANY(${targetFolderIds})`)
      }

      if (req.showSymlink) {
        countBuilder.addWhere(Prisma.sql`
          (a.type = ANY(${targetTypes}::"AssetType"[]) OR (a.type = 'symlink' AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(${targetTypes}::"AssetType"[]))))
        `)
      } else {
        countBuilder.addWhere(Prisma.sql`a.type = ANY(${targetTypes}::"AssetType"[])`)
      }

      if (req.conditions && req.conditions.length > 0) {
        countBuilder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
      }

      if (nameCond) {
        countBuilder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
      }

      const countRes = await this.prismaClient.$queryRaw<{ count: bigint }[]>(countBuilder.build())
      totalCount = Number(countRes[0]?.count || 0)
      pageInfo.total = totalCount

      if (totalCount < 2000) {
        countBuilder.select(Prisma.sql`SUM(COALESCE(a.size_byte, 0))::bigint as sum`)
        const sumRes = await this.prismaClient.$queryRaw<{ sum: bigint | null }[]>(
          countBuilder.build(),
        )
        pageInfo.totalSize = Number(sumRes[0]?.sum || 0)
      } else {
        pageInfo.totalSize = -1
      }
    } else {
      pageInfo.total = totalCount
      if (totalCount < 2000) {
        const countBuilder = new SqlQueryBuilder()
          .select(Prisma.sql`SUM(COALESCE(a.size_byte, 0))::bigint as sum`)
          .from(Prisma.sql`assets a`)
          .addWhere(Prisma.sql`a.is_deleted = false`)

        if (targetFolderIds.length > 0) {
          countBuilder.addWhere(Prisma.sql`a.parent_id = ANY(${targetFolderIds})`)
        }

        if (req.showSymlink) {
          countBuilder.addWhere(Prisma.sql`
            (a.type = ANY(${targetTypes}::"AssetType"[]) OR (a.type = 'symlink' AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(${targetTypes}::"AssetType"[]))))
          `)
        } else {
          countBuilder.addWhere(Prisma.sql`a.type = ANY(${targetTypes}::"AssetType"[])`)
        }

        if (req.conditions && req.conditions.length > 0) {
          countBuilder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
        }

        if (nameCond) {
          countBuilder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
        }

        const sumRes = await this.prismaClient.$queryRaw<{ sum: bigint | null }[]>(
          countBuilder.build(),
        )
        pageInfo.totalSize = Number(sumRes[0]?.sum || 0)
      } else {
        pageInfo.totalSize = -1
      }
    }

    if (hasNextPage) {
      pageInfo.cursor = encodeCursor(offset + limit)
    }

    return { data, pageInfo }
  }

  async searchByImage(
    folderId: string,
    req: ImageSearchRequest,
  ): Promise<PaginatedData<AssetInfo[]>> {
    const folder = await this.prismaClient.asset.findFirst({
      where: { id: folderId, type: { in: [AssetType.root, AssetType.folder] }, isDeleted: false },
      select: { project: { select: { id: true, teamId: true, rootFolderId: true } } },
    })
    const project = folder?.project
    if (!project) throw new HTTPException(404, { message: 'Project folder not found.' })

    await this.requireEmbeddingAgent(project.teamId)
    const dimensions = getImageEmbeddingDimensions()
    let vector: string
    if (req.sourceAssetId) {
      if (folderId !== project.rootFolderId) {
        throw new HTTPException(400, { message: 'Find similar requires the project root folder.' })
      }

      const column = dimensions === 768 ? Prisma.sql`embedding_768` : Prisma.sql`embedding`
      const [source] = await this.prismaClient.$queryRaw<{ vector: string | null }[]>`
        SELECT (
          SELECT ${column}::text
          FROM asset_embeddings
          WHERE asset_id = a.id AND ${column} IS NOT NULL
          ORDER BY id DESC
          LIMIT 1
        ) AS vector
        FROM assets a
        WHERE a.id = ${req.sourceAssetId} AND a.project_id = ${project.id}
          AND a.type = 'file' AND a.media_type LIKE 'image/%' AND a.is_deleted = false
      `
      if (!source) throw new HTTPException(404, { message: 'Source image not found.' })
      if (!source.vector) {
        throw new HTTPException(409, { message: 'The source image is waiting to be indexed.' })
      }
      vector = source.vector
    } else if (req.image) {
      vector = JSON.stringify(
        await imageEmbeddingService.generateEmbedding(req.image, project.teamId),
      )
    } else {
      throw new HTTPException(400, { message: 'Provide a search image or source asset.' })
    }

    const folders = await this.assetSvc.getDescendantFolderIds(folderId)
    return this.searchByEmbedding(folders, req, vector, dimensions, {
      projectId: project.id,
      mediaType: req.mediaType,
      sourceAssetId: req.sourceAssetId,
    })
  }

  private async requireEmbeddingAgent(teamId: string): Promise<void> {
    const agent =
      process.env.ENABLE_EMBEDDING_AGENT === 'false'
        ? null
        : await this.prismaClient.agent.findFirst({
            where: { teamId, type: 'embedding', enabled: true },
            select: { id: true },
          })

    if (!agent) {
      throw new HTTPException(422, {
        message: 'Embedding agent not configured or disabled for this team.',
      })
    }
  }

  private async searchByEmbedding(
    folderIds: string[],
    req: Pick<
      SearchRequest,
      'assetType' | 'showSymlink' | 'conditions' | 'operator' | 'first' | 'after' | 'previewFormat'
    >,
    vector: string,
    dimensions: 768 | 1536,
    visual?: {
      projectId: string
      mediaType?: ImageSearchRequest['mediaType']
      sourceAssetId?: string
    },
  ): Promise<PaginatedData<AssetInfo[]>> {
    const column = dimensions === 768 ? Prisma.sql`ae.embedding_768` : Prisma.sql`ae.embedding`
    const distance = Prisma.sql`(${column} <=> ${vector}::vector)`
    const builder = new SqlQueryBuilder()
      .from(Prisma.sql`assets a JOIN asset_embeddings ae ON a.id = ae.asset_id`)
      .addWhere(Prisma.sql`a.is_deleted = false`)
      .addWhere(Prisma.sql`${column} IS NOT NULL`)

    if (folderIds.length > 0) {
      builder.addWhere(Prisma.sql`a.parent_id = ANY(${folderIds})`)
    }

    if (visual) {
      builder
        .addWhere(Prisma.sql`a.project_id = ${visual.projectId} AND a.type = 'file'`)
        .addWhere(
          visual.mediaType
            ? Prisma.sql`a.media_type LIKE ${visual.mediaType + '/%'}`
            : Prisma.sql`(a.media_type LIKE 'image/%' OR a.media_type LIKE 'video/%')`,
        )
      if (visual.sourceAssetId) {
        builder.addWhere(Prisma.sql`a.id <> ${visual.sourceAssetId}`)
      }
    } else {
      const targetTypes =
        req.assetType === 'folder' ? [AssetType.folder] : [AssetType.file, AssetType.version_stack]
      builder.addWhere(
        req.showSymlink
          ? Prisma.sql`(a.type = ANY(${targetTypes}::"AssetType"[]) OR (a.type = 'symlink' AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(${targetTypes}::"AssetType"[]))))`
          : Prisma.sql`a.type = ANY(${targetTypes}::"AssetType"[])`,
      )
    }

    builder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
    const nameCond = req.conditions?.find((c) => c.field === 'name' && c.operator === 'contains')
    if (nameCond) {
      const name = String(nameCond.value)
      const ngrams = generateSearchNgrams(name)
      if (ngrams.length > 0) builder.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
      builder.addWhere(Prisma.sql`a.name ILIKE ${'%' + name + '%'}`)
    }

    const countQuery = builder.select(Prisma.sql`COUNT(*)`).build()
    const sizeQuery = builder
      .select(Prisma.sql`SUM(COALESCE(a.size_byte, 0))::bigint as sum`)
      .build()
    const requestedLimit = req.first || 20
    const limit = requestedLimit <= 0 || requestedLimit > 200 ? 20 : requestedLimit
    const offset = req.after ? decodeCursor(req.after) : 0
    const resultQuery = builder
      .select(
        Prisma.sql`a.id as "assetId", a.media_type LIKE 'video/%' as "isVideo",
          ae.start_time as "startTime", ae.end_time as "endTime", ${distance} as "distance"`,
      )
      .orderBy(visual ? Prisma.sql`distance ASC, ae.id ASC` : Prisma.sql`distance ASC`)
      .limit(limit + 1)
      .offset(offset)
      .build()

    const matches = await this.prismaClient.$queryRaw<
      {
        assetId: string
        isVideo: boolean | null
        startTime: number | null
        endTime: number | null
      }[]
    >(resultQuery)
    const page = matches.slice(0, limit)
    const assetIds = [...new Set(page.map((match) => match.assetId))]
    const infos = await this.assetSvc.listAssetsByIds(assetIds, req.previewFormat)
    const byId = new Map(infos.map((item) => [item.id, item]))
    const chunkMatches = page.flatMap(({ assetId, isVideo, startTime, endTime }) => {
      if (!isVideo || startTime === null || endTime === null) return []
      const item = byId.get(assetId)
      if (!item || !isPartialVideoRange({ startTime, endTime }, item.preview?.duration)) return []
      return [{ assetId, startTime, endTime }]
    })
    const previews = await videoChunkPreviewService.listReady(chunkMatches)
    const data = page.flatMap(({ assetId, startTime, endTime }) => {
      const item = byId.get(assetId)
      if (!item) return []
      const chunkPreview =
        startTime !== null && endTime !== null
          ? previews.get(chunkKey({ assetId, startTime, endTime }))
          : undefined
      return [{ ...item, startTime, endTime, ...(chunkPreview && { chunkPreview }) }]
    })

    const counts = await this.prismaClient.$queryRaw<{ count: bigint }[]>(countQuery)
    const total = Number(counts[0]?.count ?? 0)
    const sizes =
      total < 2000 ? await this.prismaClient.$queryRaw<{ sum: bigint | null }[]>(sizeQuery) : []
    const pageInfo: PageInfo = { total, totalSize: total < 2000 ? Number(sizes[0]?.sum ?? 0) : -1 }
    if (matches.length > limit) pageInfo.cursor = encodeCursor(offset + limit)
    return { data, pageInfo }
  }
}

export const searchService = new SearchService()
