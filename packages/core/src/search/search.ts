import { prisma } from '@shumai/db'
import { Prisma, AssetType } from '@shumai/db'
import { AssetService, assetService } from '@shumai/core/src/asset/asset'
import type { AssetInfo, ImageSearchRequest, SearchRequest } from '@shumai/dtos'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import { hasStoredVideoSprite, isFullVideoRange } from '@shumai/core/src/transcode/video-sprite'
import { PaginatedData, decodeCursor, encodeCursor, PageInfo } from '@shumai/core/src/pagination'
import { generateSearchNgrams } from '@shumai/core/src/utils/ngram'
import { HTTPException } from 'hono/http-exception'
import { getImageEmbeddingDimensions, imageEmbeddingService } from './image-embedding'
import { SqlQueryBuilder } from './sql-query-builder'
import { TextEmbeddingService, textEmbeddingService } from './text-embedding'

export class SearchService {
  constructor(
    private readonly prismaClient: typeof prisma = prisma,
    private readonly assetSvc: AssetService = assetService,
    private readonly embeddingSvc: TextEmbeddingService = textEmbeddingService,
  ) {}

  async search(folderId: string, req: SearchRequest): Promise<PaginatedData<AssetInfo[]>> {
    const targetFolderIds =
      req.recursively === false ? [folderId] : await this.assetSvc.getDescendantFolderIds(folderId)

    const isFolderSearch = req.assetType === 'folder'

    if (req.query && req.isSemantic) {
      const folder = await this.prismaClient.asset.findUnique({
        where: { id: folderId },
        select: { project: { select: { id: true, teamId: true } } },
      })
      const teamId = folder?.project?.teamId
      const projectId = folder?.project?.id
      if (!teamId || !projectId) throw new Error('Team ID not found for folder')
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
        projectId,
        req,
        JSON.stringify(vector),
        vector.length === 768 ? 768 : 1536,
      )
    }

    // ----------------------------------------------------------------------
    // Non-semantic search (using SqlQueryBuilder)
    // ----------------------------------------------------------------------
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

        // Build SQL probe query to limit and fetch selective IDs using the GIN index first
        const probeBuilder = isFolderSearch
          ? this.createFolderBaseBuilder(targetFolderIds, req.showSymlink).select(Prisma.sql`a.id`)
          : this.createLatestFileGinBuilder(targetFolderIds, req.showSymlink).select(
              Prisma.sql`CASE WHEN p.type = 'version_stack'::"AssetType" THEN p.id ELSE a.id END as id`,
            )

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

    const useGinDriver = !isFolderSearch && Boolean(nameCond && useNgram && ngrams.length > 0)
    const builder = isFolderSearch
      ? this.createFolderBaseBuilder(targetFolderIds, req.showSymlink).select(
          Prisma.sql`a.id as "assetId"`,
        )
      : useGinDriver
        ? this.createLatestFileGinBuilder(targetFolderIds, req.showSymlink).select(
            Prisma.sql`CASE WHEN p.type = 'version_stack'::"AssetType" THEN p.id ELSE a.id END as "assetId"`,
          )
        : this.createScopedFilesBuilder(targetFolderIds, req.showSymlink).select(
            Prisma.sql`sa."returnId" as "assetId"`,
          )

    if (req.conditions && req.conditions.length > 0) {
      builder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
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
    const customSortSql = isFolderSearch
      ? Prisma.sql`a.sort_index ASC`
      : useGinDriver
        ? Prisma.sql`CASE WHEN p.type = 'version_stack'::"AssetType" THEN p.sort_index ELSE a.sort_index END ASC`
        : Prisma.sql`sa."customSortIndex" ASC`
    const fallbackSortSql = isFolderSearch
      ? Prisma.sql`a.id DESC`
      : useGinDriver
        ? Prisma.sql`CASE WHEN p.type = 'version_stack'::"AssetType" THEN p.id ELSE a.id END DESC`
        : Prisma.sql`sa."returnId" DESC`

    let orderSql = customSortSql
    if (req.sort) {
      const direction = req.sort.order === 'desc' ? Prisma.raw('DESC') : Prisma.raw('ASC')
      if (req.sort.field === 'custom') {
        orderSql = customSortSql
      } else if (req.sort.field === 'name') {
        orderSql = Prisma.sql`a.name ${direction}`
      } else if (req.sort.field === 'created_at' || req.sort.field === 'createdAt') {
        orderSql = Prisma.sql`a.created_at ${direction}`
      } else if (req.sort.field === 'size_byte' || req.sort.field === 'sizeByte') {
        orderSql = Prisma.sql`a.size_byte ${direction}`
      } else {
        orderSql = fallbackSortSql
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

    const createAggregateBuilder = () => {
      const aggBuilder = isFolderSearch
        ? this.createFolderBaseBuilder(targetFolderIds, req.showSymlink)
        : useGinDriver
          ? this.createLatestFileGinBuilder(targetFolderIds, req.showSymlink)
          : this.createScopedFilesBuilder(targetFolderIds, req.showSymlink)

      if (req.conditions && req.conditions.length > 0) {
        aggBuilder.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
      }
      if (nameCond) {
        if (useNgram && ngrams.length > 0) {
          aggBuilder.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
        }
        aggBuilder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
      }
      return aggBuilder
    }

    const pageInfo: PageInfo = {}
    let totalCount = countOverride
    if (totalCount === undefined) {
      const countBuilder = createAggregateBuilder().select(Prisma.sql`COUNT(*)`)
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
        const sumBuilder = createAggregateBuilder().select(
          Prisma.sql`SUM(COALESCE(a.size_byte, 0))::bigint as sum`,
        )
        const sumRes = await this.prismaClient.$queryRaw<{ sum: bigint | null }[]>(
          sumBuilder.build(),
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
    let excludeAssetId: string | undefined
    if (req.sourceAssetId) {
      if (folderId !== project.rootFolderId) {
        throw new HTTPException(400, { message: 'Find similar requires the project root folder.' })
      }

      const column = dimensions === 768 ? Prisma.sql`embedding_768` : Prisma.sql`embedding`
      const [source] = await this.prismaClient.$queryRaw<
        { vector: string | null; excludeAssetId: string }[]
      >`
        SELECT
          (
            SELECT ${column}::text
            FROM asset_embeddings
            WHERE asset_id = a.id AND ${column} IS NOT NULL
            ORDER BY id DESC
            LIMIT 1
          ) AS vector,
          CASE
            WHEN p.type = 'version_stack'::"AssetType" THEN p.id
            ELSE a.id
          END AS "excludeAssetId"
        FROM assets a
        LEFT JOIN assets p ON p.id = a.parent_id AND p.is_deleted = false
        WHERE a.id = ${req.sourceAssetId} AND a.project_id = ${project.id}
          AND a.type = 'file' AND a.media_type LIKE 'image/%' AND a.is_deleted = false
      `
      if (!source) throw new HTTPException(404, { message: 'Source image not found.' })
      if (!source.vector) {
        throw new HTTPException(409, { message: 'The source image is waiting to be indexed.' })
      }
      vector = source.vector
      excludeAssetId = source.excludeAssetId
    } else if (req.image) {
      vector = JSON.stringify(
        await imageEmbeddingService.generateEmbedding(req.image, project.teamId),
      )
    } else {
      throw new HTTPException(400, { message: 'Provide a search image or source asset.' })
    }

    const folders = await this.assetSvc.getDescendantFolderIds(folderId)
    return this.searchByEmbedding(folders, project.id, req, vector, dimensions, {
      mediaType: req.mediaType,
      excludeAssetId,
    })
  }

  private createFolderBaseBuilder(folderIds: string[], showSymlink?: boolean): SqlQueryBuilder {
    const targetTypes = [AssetType.folder]
    const builder = new SqlQueryBuilder()
      .from(Prisma.sql`assets a`)
      .addWhere(Prisma.sql`a.is_deleted = false`)

    if (folderIds.length > 0) {
      builder.addWhere(Prisma.sql`a.parent_id = ANY(${folderIds})`)
    }

    if (showSymlink) {
      builder.addWhere(Prisma.sql`
        (a.type = ANY(${targetTypes}::"AssetType"[]) OR (a.type = 'symlink' AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(${targetTypes}::"AssetType"[]) AND is_deleted = false)))
      `)
    } else {
      builder.addWhere(Prisma.sql`a.type = ANY(${targetTypes}::"AssetType"[])`)
    }

    return builder
  }

  private buildScopedFilesCte(folderIds: string[], showSymlink?: boolean): Prisma.Sql {
    const directTypeCondition = showSymlink
      ? Prisma.sql`(d.type = 'file'::"AssetType" OR (d.type = 'symlink'::"AssetType" AND d.target_id IN (SELECT id FROM assets WHERE type = ANY(ARRAY['file', 'version_stack']::"AssetType"[]) AND is_deleted = false)))`
      : Prisma.sql`d.type = 'file'::"AssetType"`

    return Prisma.sql`scoped_assets AS (
      SELECT
        d.id AS "returnId",
        d.id AS "matchId",
        d.sort_index AS "customSortIndex"
      FROM assets d
      WHERE d.is_deleted = false
        AND d.parent_id = ANY(${folderIds})
        AND ${directTypeCondition}
      UNION ALL
      SELECT
        s.id AS "returnId",
        lv.id AS "matchId",
        s.sort_index AS "customSortIndex"
      FROM assets s
      CROSS JOIN LATERAL (
        SELECT v.id
        FROM assets v
        WHERE v.parent_id = s.id
          AND v.is_deleted = false
          AND v.type = 'file'::"AssetType"
        ORDER BY v.sort_index ASC, v.id ASC
        LIMIT 1
      ) lv
      WHERE s.is_deleted = false
        AND s.parent_id = ANY(${folderIds})
        AND s.type = 'version_stack'::"AssetType"
    )`
  }

  private createScopedFilesBuilder(folderIds: string[], showSymlink?: boolean): SqlQueryBuilder {
    return new SqlQueryBuilder()
      .with(this.buildScopedFilesCte(folderIds, showSymlink))
      .from(Prisma.sql`scoped_assets sa JOIN assets a ON a.id = sa."matchId"`)
      .addWhere(Prisma.sql`a.is_deleted = false`)
  }

  private buildLatestFileScopeCondition(folderIds: string[], showSymlink?: boolean): Prisma.Sql {
    const directTypeCondition = showSymlink
      ? Prisma.sql`(a.type = 'file'::"AssetType" OR (a.type = 'symlink'::"AssetType" AND a.target_id IN (SELECT id FROM assets WHERE type = ANY(ARRAY['file', 'version_stack']::"AssetType"[]) AND is_deleted = false)))`
      : Prisma.sql`a.type = 'file'::"AssetType"`

    return Prisma.sql`(
      (p.type <> 'version_stack'::"AssetType" AND a.parent_id = ANY(${folderIds}) AND ${directTypeCondition})
      OR (
        p.type = 'version_stack'::"AssetType"
        AND p.parent_id = ANY(${folderIds})
        AND a.type = 'file'::"AssetType"
        AND a.id = (
          SELECT v.id
          FROM assets v
          WHERE v.parent_id = p.id
            AND v.is_deleted = false
            AND v.type = 'file'::"AssetType"
          ORDER BY v.sort_index ASC, v.id ASC
          LIMIT 1
        )
      )
    )`
  }

  private createLatestFileGinBuilder(folderIds: string[], showSymlink?: boolean): SqlQueryBuilder {
    return new SqlQueryBuilder()
      .from(Prisma.sql`assets a JOIN assets p ON p.id = a.parent_id AND p.is_deleted = false`)
      .addWhere(Prisma.sql`a.is_deleted = false`)
      .addWhere(this.buildLatestFileScopeCondition(folderIds, showSymlink))
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
    projectId: string,
    req: Pick<
      SearchRequest,
      'assetType' | 'showSymlink' | 'conditions' | 'operator' | 'first' | 'after' | 'previewFormat'
    >,
    vector: string,
    dimensions: 768 | 1536,
    visual?: {
      mediaType?: ImageSearchRequest['mediaType']
      excludeAssetId?: string
    },
  ): Promise<PaginatedData<AssetInfo[]>> {
    const column = dimensions === 768 ? Prisma.sql`ae.embedding_768` : Prisma.sql`ae.embedding`
    const distance = Prisma.sql`(${column} <=> ${vector}::vector)`
    const isFolderSearch = !visual && req.assetType === 'folder'

    const applyCommonEmbeddingFilters = (target: SqlQueryBuilder) => {
      target
        .addWhere(Prisma.sql`a.is_deleted = false`)
        .addWhere(Prisma.sql`${column} IS NOT NULL`)
        .addWhere(Prisma.sql`a.project_id = ${projectId}`)

      if (visual) {
        target.addWhere(
          visual.mediaType
            ? Prisma.sql`a.media_type LIKE ${visual.mediaType + '/%'}`
            : Prisma.sql`(a.media_type LIKE 'image/%' OR a.media_type LIKE 'video/%')`,
        )
      }

      target.addSearchConditions(req.operator, req.conditions, { skipNameContains: true })
      const nameCond = req.conditions?.find((c) => c.field === 'name' && c.operator === 'contains')
      if (nameCond) {
        const name = String(nameCond.value)
        const ngrams = generateSearchNgrams(name)
        if (ngrams.length > 0) target.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
        target.addWhere(Prisma.sql`a.name ILIKE ${'%' + name + '%'}`)
      }
      return target
    }

    // Main result query drives from the pgvector HNSW index on asset_embeddings
    const resultBuilder = isFolderSearch
      ? new SqlQueryBuilder()
          .from(Prisma.sql`asset_embeddings ae JOIN assets a ON a.id = ae.asset_id`)
          .addWhere(Prisma.sql`a.parent_id = ANY(${folderIds})`)
          .addWhere(
            req.showSymlink
              ? Prisma.sql`(a.type = 'folder'::"AssetType" OR (a.type = 'symlink'::"AssetType" AND a.target_id IN (SELECT id FROM assets WHERE type = 'folder'::"AssetType" AND is_deleted = false)))`
              : Prisma.sql`a.type = 'folder'::"AssetType"`,
          )
      : new SqlQueryBuilder()
          .from(
            Prisma.sql`asset_embeddings ae JOIN assets a ON a.id = ae.asset_id JOIN assets p ON p.id = a.parent_id AND p.is_deleted = false`,
          )
          .addWhere(this.buildLatestFileScopeCondition(folderIds, !visual && req.showSymlink))

    applyCommonEmbeddingFilters(resultBuilder)
    if (visual?.excludeAssetId) {
      resultBuilder.addWhere(
        Prisma.sql`a.id <> ${visual.excludeAssetId} AND p.id <> ${visual.excludeAssetId}`,
      )
    }

    // Count/size query drives from the scoped folder/version_stack CTE + asset_embeddings(asset_id) index
    const aggBuilder = isFolderSearch
      ? new SqlQueryBuilder()
          .from(Prisma.sql`assets a JOIN asset_embeddings ae ON a.id = ae.asset_id`)
          .addWhere(Prisma.sql`a.parent_id = ANY(${folderIds})`)
          .addWhere(
            req.showSymlink
              ? Prisma.sql`(a.type = 'folder'::"AssetType" OR (a.type = 'symlink'::"AssetType" AND a.target_id IN (SELECT id FROM assets WHERE type = 'folder'::"AssetType" AND is_deleted = false)))`
              : Prisma.sql`a.type = 'folder'::"AssetType"`,
          )
      : new SqlQueryBuilder()
          .with(this.buildScopedFilesCte(folderIds, !visual && req.showSymlink))
          .from(
            Prisma.sql`scoped_assets sa JOIN assets a ON a.id = sa."matchId" JOIN asset_embeddings ae ON ae.asset_id = a.id`,
          )

    applyCommonEmbeddingFilters(aggBuilder)
    if (visual?.excludeAssetId && !isFolderSearch) {
      aggBuilder.addWhere(Prisma.sql`sa."returnId" <> ${visual.excludeAssetId}`)
    }

    const countQuery = aggBuilder.select(Prisma.sql`COUNT(*)`).build()
    const sizeQuery = aggBuilder
      .select(Prisma.sql`SUM(COALESCE(a.size_byte, 0))::bigint as sum`)
      .build()

    const requestedLimit = req.first || 20
    const limit = requestedLimit <= 0 || requestedLimit > 200 ? 20 : requestedLimit
    const offset = req.after ? decodeCursor(req.after) : 0
    const returnAssetIdSql = isFolderSearch
      ? Prisma.sql`a.id as "assetId"`
      : Prisma.sql`CASE WHEN p.type = 'version_stack'::"AssetType" THEN p.id ELSE a.id END as "assetId"`

    const resultQuery = resultBuilder
      .select(
        Prisma.sql`${returnAssetIdSql}, ae.start_time as "startTime", ae.end_time as "endTime", ae.sprite,
          a.media -> 'duration' as "videoDuration", a.media #>> '{sprite,key}' as "fullSpriteKey",
          ${distance} as "distance"`,
      )
      .orderBy(visual ? Prisma.sql`distance ASC, ae.id ASC` : Prisma.sql`distance ASC`)
      .limit(limit + 1)
      .offset(offset)
      .build()

    const matches = await this.prismaClient.$queryRaw<
      {
        assetId: string
        startTime: number | null
        endTime: number | null
        sprite: PrismaJson.VideoChunkSprite | null
        videoDuration: unknown
        fullSpriteKey: string | null
      }[]
    >(resultQuery)
    const page = matches.slice(0, limit)
    const assetIds = [...new Set(page.map((match) => match.assetId))]
    const infos = await this.assetSvc.listAssetsByIds(assetIds, req.previewFormat)
    const byId = new Map(infos.map((item) => [item.id, item]))
    const bucket = process.env.S3_BUCKET || 'shumai'
    const results = await Promise.all(
      page.map(
        async ({
          assetId,
          startTime,
          endTime,
          sprite,
          videoDuration,
          fullSpriteKey,
        }): Promise<AssetInfo | undefined> => {
          const item = byId.get(assetId)
          if (!item) return
          const match = { ...item, startTime, endTime }
          if (!sprite) return match

          // A stack's preview comes from its latest version (which is the matched asset here);
          // symlinks can still point to a different asset.
          if (
            (item.type === AssetType.file || item.type === AssetType.version_stack) &&
            item.preview?.spriteUrl &&
            fullSpriteKey &&
            isFullVideoRange(startTime, endTime, videoDuration) &&
            (await hasStoredVideoSprite(bucket, fullSpriteKey))
          ) {
            return match
          }

          const { key, ...layout } = sprite
          try {
            const url = await s3Service.presign(bucket, key, 'GET')
            return { ...match, matchedSprite: { ...layout, url } }
          } catch (err) {
            logger.warn({ err, assetId, key }, 'Failed to sign video chunk sprite')
            return match
          }
        },
      ),
    )
    const data = results.filter((item) => item !== undefined)

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
