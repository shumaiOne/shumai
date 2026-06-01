import { prisma } from '@shumai/db'
import { Prisma, AssetType, WorkflowTaskType } from '@/generated/prisma/client.ts'
import { AssetService, assetService } from '@/services/asset/asset'
import { AssetInfo } from '@shumai/dtos'
import { SearchRequest } from '@shumai/dtos'
import { PaginatedData, decodeCursor, encodeCursor, PageInfo } from '@/services/pagination'
import { generateSearchNgrams } from '@/utils/ngram'
import { workflowService } from '@/workflow/workflow'
import { HTTPException } from 'hono/http-exception'
import { SqlQueryBuilder } from './sql-query-builder'

export class SearchService {
  constructor(
    private readonly prismaClient: typeof prisma = prisma,
    private readonly assetSvc: AssetService = assetService,
  ) {}

  async search(folderId: string, req: SearchRequest): Promise<PaginatedData<AssetInfo[]>> {
    let targetFolderIds: string[] = []

    if (req.recursively === false) {
      targetFolderIds = [folderId]
    } else {
      targetFolderIds = await this.assetSvc.getDescendantFolderIds(folderId)
    }

    const targetTypes =
      req.assetType === 'folder' ? [AssetType.folder] : [AssetType.file, AssetType.version_stack]

    // ----------------------------------------------------------------------
    // AI Semantic search
    // ----------------------------------------------------------------------
    if (req.query && req.isSemantic) {
      // 1. Check if embedding agent exists and is enabled
      const team = await this.prismaClient.asset.findUnique({
        where: { id: folderId },
        select: { project: { select: { teamId: true } } },
      })
      const teamId = team?.project?.teamId
      if (!teamId) throw new Error('Team ID not found for folder')

      const embeddingAgent = await this.prismaClient.agent.findFirst({
        where: { teamId, type: 'embedding', enabled: true },
      })

      if (!embeddingAgent) {
        throw new HTTPException(422, {
          message: 'Embedding agent not configured or disabled for this team.',
        })
      }

      // 2. Generate query embedding via workflow
      const task = await this.prismaClient.workflowTask.create({
        data: {
          type: WorkflowTaskType.query_embedding_for_search,
          teamId,
          assetId: folderId,
          payload: {
            projectId: '',
            queryEmbeddingForSearch: { text: req.query },
          } as PrismaJson.WorkflowTaskPayload,
          status: 'pending',
        },
      })

      const completedTask = await workflowService.executeWait(task)
      const output = completedTask.output as Record<string, unknown> | null
      const queryVector = output?.embedding as number[] | undefined

      if (!queryVector) {
        throw new Error('Failed to generate query embedding')
      }

      // 3. Construct raw SQL using SqlQueryBuilder
      const vectorJson = JSON.stringify(queryVector)
      const builder = new SqlQueryBuilder()
        .select(
          Prisma.sql`a.id as "assetId", ae.start_time as "startTime", ae.end_time as "endTime", (ae.embedding <=> ${vectorJson}::vector) as "distance"`,
        )
        .from(Prisma.sql`assets a JOIN asset_embeddings ae ON a.id = ae.asset_id`)
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

      const nameCond = req.conditions?.find((c) => c.field === 'name' && c.operator === 'contains')
      if (nameCond) {
        const valStr = String(nameCond.value)
        const ngrams = generateSearchNgrams(valStr)

        if (ngrams.length > 0) {
          builder.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
          builder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
        } else {
          builder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
        }
      }

      builder.orderBy(Prisma.sql`distance ASC`)

      // 4. Paginate in SQL using limit/offset
      let limit = req.first || 20
      if (limit <= 0 || limit > 200) {
        limit = 20
      }

      let offset = 0
      if (req.after) {
        offset = decodeCursor(req.after)
      }

      builder.limit(limit + 1).offset(offset)

      // 5. Execute raw SQL query
      const query = builder.build()
      const semanticMatches = await this.prismaClient.$queryRaw<
        {
          assetId: string
          startTime: number | null
          endTime: number | null
          distance: number
        }[]
      >(query)

      const hasNextPage = semanticMatches.length > limit
      const finalMatches = hasNextPage ? semanticMatches.slice(0, limit) : semanticMatches

      // 6. Map back to full rich metadata and return time-based duplicate segments
      const uniqueIds = Array.from(new Set(finalMatches.map((m) => m.assetId)))
      const fetchedInfos = await this.assetSvc.listAssetsByIds(uniqueIds)
      const assetInfosMap = new Map<string, AssetInfo>()
      for (const info of fetchedInfos) {
        assetInfosMap.set(info.id, info)
      }

      const data: AssetInfo[] = []
      for (const match of finalMatches) {
        const baseInfo = assetInfosMap.get(match.assetId)
        if (baseInfo) {
          data.push({
            ...baseInfo,
            startTime: match.startTime,
            endTime: match.endTime,
          })
        }
      }

      const pageInfo: PageInfo = {}
      if (req.includeCount) {
        const countBuilder = new SqlQueryBuilder()
          .select(Prisma.sql`COUNT(*)`)
          .from(Prisma.sql`assets a JOIN asset_embeddings ae ON a.id = ae.asset_id`)
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
          const valStr = String(nameCond.value)
          const ngrams = generateSearchNgrams(valStr)
          if (ngrams.length > 0) {
            countBuilder.addWhere(Prisma.sql`a.name_ngram @> ${ngrams}::text[]`)
            countBuilder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
          } else {
            countBuilder.addWhere(Prisma.sql`a.name ILIKE ${'%' + valStr + '%'}`)
          }
        }

        const countRes = await this.prismaClient.$queryRaw<{ count: bigint }[]>(
          countBuilder.build(),
        )
        pageInfo.total = Number(countRes[0]?.count || 0)
      }

      if (hasNextPage) {
        pageInfo.cursor = encodeCursor(offset + limit)
      }

      return { data, pageInfo }
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
    const fetchedInfos = await this.assetSvc.listAssetsByIds(uniqueIds)
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
    if (req.includeCount) {
      if (countOverride !== undefined) {
        pageInfo.total = countOverride
      } else {
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

        const countRes = await this.prismaClient.$queryRaw<{ count: bigint }[]>(
          countBuilder.build(),
        )
        pageInfo.total = Number(countRes[0]?.count || 0)
      }
    }

    if (hasNextPage) {
      pageInfo.cursor = encodeCursor(offset + limit)
    }

    return { data, pageInfo }
  }
}

export const searchService = new SearchService()
