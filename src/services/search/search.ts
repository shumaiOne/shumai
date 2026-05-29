import { prisma } from '@/db'
import { Prisma, AssetType, WorkflowTaskType } from '@/generated/prisma/client.ts'
import { AssetService, assetService } from '@/services/asset/asset'
import { AssetInfo } from '@/dtos/asset'
import { SearchRequest } from '@/dtos/search'
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
        const condSqls: Prisma.Sql[] = []
        for (const cond of req.conditions) {
          if (cond.field === 'name' && cond.operator === 'contains') continue
          const sqlCond = this.buildSqlCondition(cond.field, cond.operator, cond.value)
          if (sqlCond) {
            condSqls.push(sqlCond)
          }
        }
        if (condSqls.length > 0) {
          const separator = req.operator === 'OR' ? ' OR ' : ' AND '
          builder.addWhere(Prisma.sql`(${Prisma.join(condSqls, separator)})`)
        }
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
          const condSqls: Prisma.Sql[] = []
          for (const cond of req.conditions) {
            if (cond.field === 'name' && cond.operator === 'contains') continue
            const sqlCond = this.buildSqlCondition(cond.field, cond.operator, cond.value)
            if (sqlCond) {
              condSqls.push(sqlCond)
            }
          }
          if (condSqls.length > 0) {
            const separator = req.operator === 'OR' ? ' OR ' : ' AND '
            countBuilder.addWhere(Prisma.sql`(${Prisma.join(condSqls, separator)})`)
          }
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
      const condSqls: Prisma.Sql[] = []
      for (const cond of req.conditions) {
        if (cond.field === 'name' && cond.operator === 'contains') continue
        const sqlCond = this.buildSqlCondition(cond.field, cond.operator, cond.value)
        if (sqlCond) {
          condSqls.push(sqlCond)
        }
      }
      if (condSqls.length > 0) {
        const separator = req.operator === 'OR' ? ' OR ' : ' AND '
        builder.addWhere(Prisma.sql`(${Prisma.join(condSqls, separator)})`)
      }
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
          const condSqls: Prisma.Sql[] = []
          for (const cond of req.conditions) {
            if (cond.field === 'name' && cond.operator === 'contains') continue
            const sqlCond = this.buildSqlCondition(cond.field, cond.operator, cond.value)
            if (sqlCond) {
              condSqls.push(sqlCond)
            }
          }
          if (condSqls.length > 0) {
            const separator = req.operator === 'OR' ? ' OR ' : ' AND '
            probeBuilder.addWhere(Prisma.sql`(${Prisma.join(condSqls, separator)})`)
          }
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
          const condSqls: Prisma.Sql[] = []
          for (const cond of req.conditions) {
            if (cond.field === 'name' && cond.operator === 'contains') continue
            const sqlCond = this.buildSqlCondition(cond.field, cond.operator, cond.value)
            if (sqlCond) {
              condSqls.push(sqlCond)
            }
          }
          if (condSqls.length > 0) {
            const separator = req.operator === 'OR' ? ' OR ' : ' AND '
            countBuilder.addWhere(Prisma.sql`(${Prisma.join(condSqls, separator)})`)
          }
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

  private isDate(value: unknown): boolean {
    if (value instanceof Date) return true
    if (typeof value !== 'string') return false
    const valStr = value.toLowerCase()
    const relativeKeywords = [
      'today',
      'yesterday',
      'tomorrow',
      'one week ago',
      'one week from now',
      'one month ago',
      'one month from now',
    ]
    if (relativeKeywords.includes(valStr) || valStr.match(/\d+\s+days?\s+(ago|from\s+now)/)) {
      return true
    }
    const d = new Date(value)
    return !isNaN(d.getTime()) && value.includes('-')
  }

  private toDate(value: unknown): Date {
    return this.toDateBound(value, 'start')
  }

  private toDateBound(value: unknown, bound: 'start' | 'end'): Date {
    const d = this.parseRelativeDate(value)
    if (d instanceof Date) return d
    if (d && 'gte' in d && 'lte' in d) {
      return bound === 'start' ? d.gte! : d.lte!
    }
    return new Date(value as string)
  }

  private parseDateRange(value: unknown): { start: Date; end: Date } {
    const d = this.parseRelativeDate(value)
    if (d && 'gte' in d && 'lte' in d) {
      return { start: d.gte!, end: d.lte! }
    }
    const date = d instanceof Date ? d : new Date(value as string)
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  private parseRelativeDate(value: unknown): { gte?: Date; lte?: Date } | Date | null {
    if (value instanceof Date) return value
    const valStr = String(value).toLowerCase()
    const now = new Date()
    const startOf = (d: Date) => {
      const res = new Date(d)
      res.setHours(0, 0, 0, 0)
      return res
    }
    const endOf = (d: Date) => {
      const res = new Date(d)
      res.setHours(23, 59, 59, 999)
      return res
    }

    if (valStr === 'today') {
      return { gte: startOf(now), lte: endOf(now) }
    }
    if (valStr === 'yesterday') {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return { gte: startOf(d), lte: endOf(d) }
    }
    if (valStr === 'tomorrow') {
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      return { gte: startOf(d), lte: endOf(d) }
    }
    if (valStr === 'one week ago') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    if (valStr === 'one week from now') {
      const d = new Date(now)
      d.setDate(d.getDate() + 7)
      return d
    }
    if (valStr === 'one month ago') {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 1)
      return d
    }
    if (valStr === 'one month from now') {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 1)
      return d
    }

    const daysAgoMatch = valStr.match(/(\d+)\s+days?\s+ago/)
    if (daysAgoMatch) {
      const d = new Date(now)
      d.setDate(d.getDate() - parseInt(daysAgoMatch[1]))
      return d
    }
    const daysFromNowMatch = valStr.match(/(\d+)\s+days?\s+from\s+now/)
    if (daysFromNowMatch) {
      const d = new Date(now)
      d.setDate(d.getDate() + parseInt(daysFromNowMatch[1]))
      return d
    }

    const parsed = new Date(value as string)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  private buildEavValueMatch(value: unknown): Prisma.Sql {
    if (typeof value === 'string') {
      const valStr = String(value)
      if (this.isDate(valStr)) {
        const d = this.parseRelativeDate(valStr)
        if (d instanceof Date) {
          return Prisma.sql`date_value = ${d}`
        } else if (d && 'gte' in d) {
          return Prisma.sql`date_value >= ${d.gte} AND date_value <= ${d.lte}`
        }
      }
      return Prisma.sql`string_value = ${valStr}`
    }
    if (typeof value === 'number') {
      return Prisma.sql`number_value = ${Number(value)}`
    }
    if (typeof value === 'boolean') {
      return Prisma.sql`boolean_value = ${Boolean(value)}`
    }
    if (value instanceof Date) {
      return Prisma.sql`date_value = ${value}`
    }
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return Prisma.sql`json_value = ${JSON.stringify(value)}::jsonb`
    }
    return Prisma.sql`string_value = ${String(value)}`
  }

  private buildSqlCondition(
    field: string,
    operator: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
  ): Prisma.Sql | null {
    const colName =
      field === 'sizeByte' || field === 'size_byte'
        ? 'size_byte'
        : field === 'createdAt' || field === 'created_at'
          ? 'created_at'
          : field === 'updatedAt' || field === 'updated_at'
            ? 'updated_at'
            : field

    const dbCol = Prisma.raw(`a."${colName}"`)

    if (field === 'name') {
      const valStr = String(value)
      switch (operator) {
        case 'eq':
          return Prisma.sql`${dbCol} = ${valStr}`
        case 'neq':
          return Prisma.sql`${dbCol} != ${valStr}`
        case 'contains':
          return Prisma.sql`${dbCol} ILIKE ${'%' + valStr + '%'}`
        case 'notContains':
          return Prisma.sql`${dbCol} NOT ILIKE ${'%' + valStr + '%'}`
        case 'isEmpty':
          return Prisma.sql`${dbCol} = ''`
        case 'isNotEmpty':
          return Prisma.sql`${dbCol} != ''`
        default:
          throw new Error(`Unsupported operator for name field: ${operator}`)
      }
    }

    if (field === 'sizeByte' || field === 'size_byte') {
      const valNum = Number(value)
      switch (operator) {
        case 'eq':
          return Prisma.sql`${dbCol} = ${valNum}`
        case 'neq':
          return Prisma.sql`${dbCol} != ${valNum}`
        case 'gt':
          return Prisma.sql`${dbCol} > ${valNum}`
        case 'gte':
          return Prisma.sql`${dbCol} >= ${valNum}`
        case 'lt':
          return Prisma.sql`${dbCol} < ${valNum}`
        case 'lte':
          return Prisma.sql`${dbCol} <= ${valNum}`
        default:
          throw new Error(`Unsupported operator for sizeByte field: ${operator}`)
      }
    }

    if (
      field === 'createdAt' ||
      field === 'updatedAt' ||
      field === 'created_at' ||
      field === 'updated_at'
    ) {
      const valDate = this.toDate(value)
      switch (operator) {
        case 'eq':
          return Prisma.sql`${dbCol} = ${valDate}`
        case 'neq':
          return Prisma.sql`${dbCol} != ${valDate}`
        case 'gt':
          return Prisma.sql`${dbCol} > ${this.toDateBound(value, 'end')}`
        case 'gte':
          return Prisma.sql`${dbCol} >= ${this.toDateBound(value, 'start')}`
        case 'lt':
          return Prisma.sql`${dbCol} < ${this.toDateBound(value, 'start')}`
        case 'lte':
          return Prisma.sql`${dbCol} <= ${this.toDateBound(value, 'end')}`
        case 'isWithin': {
          const range = this.parseDateRange(value)
          return Prisma.sql`${dbCol} >= ${range.start} AND ${dbCol} <= ${range.end}`
        }
        default:
          throw new Error(`Unsupported operator for date field: ${operator}`)
      }
    }

    // Custom EAV metadata field query on asset_metadata_values
    switch (operator) {
      case 'isEmpty':
        return Prisma.sql`a.id NOT IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field})`
      case 'isNotEmpty':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field})`
      case 'eq': {
        const matchSql = this.buildEavValueMatch(value)
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND ${matchSql})`
      }
      case 'neq': {
        const matchSql = this.buildEavValueMatch(value)
        return Prisma.sql`a.id NOT IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field}) OR a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND NOT (${matchSql}))`
      }
      case 'gt':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND (number_value > ${Number(value)} OR date_value > ${this.toDateBound(value, 'end')}))`
      case 'gte':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND (number_value >= ${Number(value)} OR date_value >= ${this.toDateBound(value, 'start')}))`
      case 'lt':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND (number_value < ${Number(value)} OR date_value < ${this.toDateBound(value, 'start')}))`
      case 'lte':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND (number_value <= ${Number(value)} OR date_value <= ${this.toDateBound(value, 'end')}))`
      case 'contains':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND string_value ILIKE ${'%' + String(value) + '%'})`
      case 'notContains':
        return Prisma.sql`a.id NOT IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND string_value ILIKE ${'%' + String(value) + '%'})`
      case 'in': {
        const valArr = Array.isArray(value) ? value : [value]
        const valNumArr = valArr.map((v) => Number(v)).filter((v) => !isNaN(v))
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND (string_value = ANY(${valArr}) OR number_value = ANY(${valNumArr}::double precision[])))`
      }
      case 'notIn': {
        const valArr = Array.isArray(value) ? value : [value]
        const valNumArr = valArr.map((v) => Number(v)).filter((v) => !isNaN(v))
        return Prisma.sql`a.id NOT IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND (string_value = ANY(${valArr}) OR number_value = ANY(${valNumArr}::double precision[])))`
      }
      case 'hasAny':
      case 'hasAll':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND json_value @> ${JSON.stringify(value)}::jsonb)`
      case 'hasNone':
        return Prisma.sql`a.id NOT IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND json_value @> ${JSON.stringify(value)}::jsonb)`
      case 'isWithin': {
        const range = this.parseDateRange(value)
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND date_value >= ${range.start} AND date_value <= ${range.end})`
      }
      default:
        throw new Error(`Unsupported operator for metadata field: ${operator}`)
    }
  }
}

export const searchService = new SearchService()
