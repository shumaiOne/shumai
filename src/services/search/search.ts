import { prisma } from '@/db'
import { Prisma, AssetType } from '@/generated/prisma/client.ts'
import { AssetService, assetService } from '@/services/asset/asset'
import { AssetInfo } from '@/dtos/asset'
import { SearchRequest } from '@/dtos/search'
import { paginateQuery, PaginatedData } from '@/services/pagination'
import { generateSearchNgrams } from '@/utils/ngram'

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

    const where: Prisma.AssetWhereInput = {
      removed: false,
    }

    if (targetFolderIds.length > 0) {
      where.parentId = { in: targetFolderIds }
    }

    const targetType = req.assetType === 'folder' ? AssetType.folder : AssetType.file
    const typeCondition: Prisma.AssetWhereInput = req.showSymlink
      ? {
          OR: [
            { type: targetType },
            {
              type: AssetType.symlink,
              target: { type: targetType },
            },
          ],
        }
      : { type: targetType }

    if (req.conditions && req.conditions.length > 0) {
      const conditionPredicates: Prisma.AssetWhereInput[] = req.conditions.map((cond) => {
        return this.buildConditionPredicate(cond.field, cond.operator as string, cond.value)
      })

      if (req.operator === 'OR') {
        where.AND = [typeCondition, { OR: conditionPredicates }]
      } else {
        where.AND = [typeCondition, ...conditionPredicates]
      }
    } else {
      Object.assign(where, typeCondition)
    }

    // AI Semantic search is skipped for now, but in the future we'll check if req.query exists
    // and if the team has embeddings enabled to do a vector search

    const orderBy: Prisma.AssetOrderByWithRelationInput = {}
    if (req.sort) {
      const direction = req.sort.order === 'desc' ? 'desc' : 'asc'
      if (req.sort.field === 'custom') {
        orderBy.sortIndex = 'asc'
      } else if (req.sort.field === 'name') {
        orderBy.name = direction
      } else if (req.sort.field === 'created_at' || req.sort.field === 'createdAt') {
        orderBy.createdAt = direction
      } else if (req.sort.field === 'size_byte' || req.sort.field === 'sizeByte') {
        orderBy.sizeByte = direction
      } else {
        orderBy.id = 'desc'
      }
    } else {
      orderBy.sortIndex = 'asc'
    }

    // ----------------------------------------------------------------------
    // Switching Search Implementation
    // ----------------------------------------------------------------------
    let finalWhere = where
    let countOverride: number | undefined

    const nameCond = req.conditions?.find((c) => c.field === 'name' && c.operator === 'contains')

    if (nameCond) {
      const valStr = String(nameCond.value)
      const ngrams = generateSearchNgrams(valStr)

      if (ngrams.length > 0) {
        const PROBE_LIMIT = 10001
        // We need to build the probe WHERE clause manually since it's a mix of existing conditions and n-grams
        // For the probe, we use both GIN and ILIKE to ensure correctness
        const probeWhere = {
          ...where,
          nameNgram: { hasEvery: ngrams },
          name: { contains: valStr, mode: 'insensitive' as const },
        }

        const probeCount = await this.prismaClient.asset.count({
          where: probeWhere,
          take: PROBE_LIMIT,
        })

        if (probeCount < PROBE_LIMIT) {
          // SELECTIVE CASE: The term is rare. Use GIN index for high performance.
          finalWhere = {
            ...where,
            nameNgram: { hasEvery: ngrams },
            name: { contains: valStr, mode: 'insensitive' },
          }
          countOverride = probeCount
        } else {
          // NON-SELECTIVE CASE: The term is common.
          // Revert to simple ILIKE to allow B-tree short-circuiting during pagination.
          // We set countOverride to PROBE_LIMIT to avoid a full table scan for the count.
          finalWhere = {
            ...where,
            name: { contains: valStr, mode: 'insensitive' },
          }
          countOverride = PROBE_LIMIT
        }
      } else {
        // Fallback for queries that yield no n-grams
        finalWhere = {
          ...where,
          name: { contains: valStr, mode: 'insensitive' },
        }
      }
    }

    const { data: assets, pageInfo } = await paginateQuery(
      (skip, take) =>
        this.prismaClient.asset.findMany({
          where: finalWhere,
          orderBy,
          skip,
          take,
        }),
      countOverride !== undefined
        ? async () => countOverride!
        : () => this.prismaClient.asset.count({ where: finalWhere }),
      req,
    )

    const assetInfos = await this.assetSvc.listAssetsByIds(assets.map((a) => a.id))

    return { data: assetInfos, pageInfo }
  }

  private buildConditionPredicate(
    field: string,
    operator: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
  ): Prisma.AssetWhereInput {
    if (field === 'name') {
      const valStr = String(value)
      switch (operator) {
        case 'eq':
          return { name: { equals: valStr } }
        case 'neq':
          return { name: { not: valStr } }
        case 'contains':
          // We handle 'contains' specially in the main search loop for Switching Search.
          // Here we just return the simple condition as a fallback.
          return { name: { contains: valStr, mode: 'insensitive' } }
        case 'notContains':
          return { NOT: { name: { contains: valStr, mode: 'insensitive' } } }
        case 'isEmpty':
          return { name: { equals: '' } }
        case 'isNotEmpty':
          return { name: { not: '' } }
        default:
          throw new Error(`Unsupported operator for name field: ${operator}`)
      }
    }

    if (field === 'sizeByte' || field === 'size_byte') {
      const valNum = Number(value)
      switch (operator) {
        case 'eq':
          return { sizeByte: { equals: valNum } }
        case 'neq':
          return { sizeByte: { not: valNum } }
        case 'gt':
          return { sizeByte: { gt: valNum } }
        case 'gte':
          return { sizeByte: { gte: valNum } }
        case 'lt':
          return { sizeByte: { lt: valNum } }
        case 'lte':
          return { sizeByte: { lte: valNum } }
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
      const col = field === 'createdAt' || field === 'created_at' ? 'createdAt' : 'updatedAt'
      const valDate = this.toDate(value)
      switch (operator) {
        case 'eq':
          return { [col]: { equals: valDate } }
        case 'neq':
          return { [col]: { not: valDate } }
        case 'gt':
          return { [col]: { gt: this.toDateBound(value, 'end') } }
        case 'gte':
          return { [col]: { gte: this.toDateBound(value, 'start') } }
        case 'lt':
          return { [col]: { lt: this.toDateBound(value, 'start') } }
        case 'lte':
          return { [col]: { lte: this.toDateBound(value, 'end') } }
        case 'isWithin': {
          const range = this.parseDateRange(value)
          return {
            [col]: {
              gte: range.start,
              lte: range.end,
            },
          }
        }
        default:
          throw new Error(`Unsupported operator for ${field} field: ${operator}`)
      }
    }

    // EAV queries on metadataValues
    const baseFilter = { fieldId: field }

    // Handle Empty/NotEmpty globally for EAV
    if (operator === 'isEmpty') {
      return { metadataValues: { none: { fieldId: field } } }
    }
    if (operator === 'isNotEmpty') {
      return { metadataValues: { some: { fieldId: field } } }
    }

    const valuePredicate = (): Prisma.AssetMetadataValueWhereInput => {
      const or: Prisma.AssetMetadataValueWhereInput[] = []
      if (typeof value === 'string' && !this.isDate(value)) {
        or.push({ stringValue: value })
      }
      if (typeof value === 'number') {
        or.push({ numberValue: value })
      }
      if (typeof value === 'boolean') {
        or.push({ booleanValue: value })
      }
      if (this.isDate(value)) {
        const d = this.parseRelativeDate(value)
        if (d instanceof Date) {
          or.push({ dateValue: d })
        } else if (d && 'gte' in d) {
          return {
            dateValue: {
              gte: d.gte,
              lte: d.lte,
            },
          }
        }
      }
      if (
        Array.isArray(value) ||
        (typeof value === 'object' && value !== null && !(value instanceof Date))
      ) {
        or.push({ jsonValue: { equals: value } })
      }

      if (or.length === 1) return or[0]
      return { OR: or }
    }

    switch (operator) {
      case 'eq':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              ...valuePredicate(),
            },
          },
        }
      case 'neq':
        return {
          // "is not" in EAV context: either the field doesn't exist,
          // OR it exists but has a different value.
          OR: [
            { metadataValues: { none: { fieldId: field } } },
            {
              metadataValues: {
                some: {
                  fieldId: field,
                  NOT: valuePredicate(),
                },
              },
            },
          ],
        }
      case 'gt':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              OR: [
                { numberValue: { gt: Number(value) } },
                { dateValue: { gt: this.toDateBound(value, 'end') } },
              ],
            },
          },
        }
      case 'gte':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              OR: [
                { numberValue: { gte: Number(value) } },
                { dateValue: { gte: this.toDateBound(value, 'start') } },
              ],
            },
          },
        }
      case 'lt':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              OR: [
                { numberValue: { lt: Number(value) } },
                { dateValue: { lt: this.toDateBound(value, 'start') } },
              ],
            },
          },
        }
      case 'lte':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              OR: [
                { numberValue: { lte: Number(value) } },
                { dateValue: { lte: this.toDateBound(value, 'end') } },
              ],
            },
          },
        }
      case 'contains':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              stringValue: { contains: String(value), mode: 'insensitive' },
            },
          },
        }
      case 'notContains':
        return {
          metadataValues: {
            none: {
              ...baseFilter,
              stringValue: { contains: String(value), mode: 'insensitive' },
            },
          },
        }
      case 'in': // "is any of"
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              OR: [
                { stringValue: { in: Array.isArray(value) ? value : [value] } },
                {
                  numberValue: { in: Array.isArray(value) ? (value as number[]) : [Number(value)] },
                },
              ],
            },
          },
        }
      case 'notIn': // "is none of"
        return {
          metadataValues: {
            none: {
              ...baseFilter,
              OR: [
                { stringValue: { in: Array.isArray(value) ? value : [value] } },
                {
                  numberValue: { in: Array.isArray(value) ? (value as number[]) : [Number(value)] },
                },
              ],
            },
          },
        }
      case 'hasAny':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              // eslint-disable-next-line @typescript-eslint/naming-convention
              jsonValue: { array_contains: value },
            },
          },
        }
      case 'hasAll':
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              AND: Array.isArray(value)
                ? value.map((v) => ({
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    jsonValue: { array_contains: v },
                  }))
                : [
                    {
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      jsonValue: { array_contains: value },
                    },
                  ],
            },
          },
        }
      case 'hasNone':
        return {
          metadataValues: {
            none: {
              ...baseFilter,
              // eslint-disable-next-line @typescript-eslint/naming-convention
              jsonValue: { array_contains: value },
            },
          },
        }
      case 'isWithin': {
        const range = this.parseDateRange(value)
        return {
          metadataValues: {
            some: {
              ...baseFilter,
              dateValue: {
                gte: range.start,
                lte: range.end,
              },
            },
          },
        }
      }
      default:
        throw new Error(`Unsupported operator for metadata field: ${operator}`)
    }
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
}

export const searchService = new SearchService()
