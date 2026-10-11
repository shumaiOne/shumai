import { Prisma } from '@shumai/db'
import { SearchCondition } from '@shumai/dtos'
import { STACK_PREVIEW_EXTENSIONS, STACK_RAW_EXTENSIONS } from '@shumai/core/src/utils/photo-stack'

// The backslashes in these SQL regexes are doubled for the template literal. A leading dot is not
// an extension (".jpg" has none), matching `stackExtension()` in utils/photo-stack.
const STACK_EXTENSION_SQL = Prisma.sql`lower(substring(a.name from '^.+\\.([^.]+)$'))`
const STACK_BASE_NAME_SQL = Prisma.sql`lower(regexp_replace(a.name, '^(.+)\\.[^.]+$', '\\1'))`

export class SqlQueryBuilder {
  private selectSql: Prisma.Sql = Prisma.sql`*`
  private fromSql: Prisma.Sql | null = null
  private wheres: Prisma.Sql[] = []
  private orderSql: Prisma.Sql | null = null
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private stackedRawJpeg = false
  private stackedMemberIds = false

  select(fields: Prisma.Sql): this {
    this.selectSql = fields
    return this
  }

  from(relation: Prisma.Sql): this {
    this.fromSql = relation
    return this
  }

  addWhere(condition: Prisma.Sql): this {
    this.wheres.push(condition)
    return this
  }

  orderBy(order: Prisma.Sql): this {
    this.orderSql = order
    return this
  }

  limit(n: number): this {
    this.limitCount = n
    return this
  }

  offset(n: number): this {
    this.offsetCount = n
    return this
  }

  /**
   * Collapse each RAW + JPEG shot (same folder, same base name ignoring case, differing only by a
   * camera RAW vs a JPEG/HEIF extension) to its cover, the first JPEG/HEIF photo. A shot needs at
   * least one of each; lone files and every other file type pass through untouched. The outer
   * query still aliases rows as `a` and adds `a.stack_key`, `a.stack_count` (files in the stack)
   * and `a.stack_size` (their total bytes), so select, order and count clauses work unchanged.
   * Only `id`, `name`, `parent_id`, `size_byte`, `sort_index` and `created_at` pass through from
   * the table, so an order or select clause may use no other `a.` column. With `memberIds`, each
   * stacked row also carries `a.stack_ids`: the ids of the stack's files that matched the
   * filters, cover first. Symlinks never stack.
   * Mirrors `groupPhotoStacks()` in utils/photo-stack.
   */
  stackRawJpeg(enabled = true, options?: { memberIds?: boolean }): this {
    this.stackedRawJpeg = enabled
    this.stackedMemberIds = enabled && !!options?.memberIds
    return this
  }

  addSearchConditions(
    operator: 'AND' | 'OR',
    conditions: SearchCondition[],
    options?: { skipNameContains?: boolean },
  ): this {
    if (!conditions || conditions.length === 0) return this

    const condSqls: Prisma.Sql[] = []
    for (const cond of conditions) {
      if (options?.skipNameContains && cond.field === 'name' && cond.operator === 'contains') {
        continue
      }
      const sqlCond = this.buildSqlCondition(cond.field, cond.operator, cond.value)
      if (sqlCond) {
        condSqls.push(sqlCond)
      }
    }

    if (condSqls.length > 0) {
      const separator = operator === 'OR' ? ' OR ' : ' AND '
      this.addWhere(Prisma.sql`(${Prisma.join(condSqls, separator)})`)
    }

    return this
  }

  build(): Prisma.Sql {
    if (!this.fromSql) {
      throw new Error('FROM clause is required in SqlQueryBuilder')
    }

    const queryParts: Prisma.Sql[] = [Prisma.sql`SELECT`, this.selectSql, Prisma.sql`FROM`]

    const where =
      this.wheres.length > 0 ? Prisma.sql`WHERE ${Prisma.join(this.wheres, ' AND ')}` : Prisma.empty
    if (this.stackedRawJpeg) {
      queryParts.push(this.buildStackedFrom(where))
    } else {
      queryParts.push(this.fromSql, where)
    }

    if (this.orderSql) {
      queryParts.push(Prisma.sql`ORDER BY`)
      queryParts.push(this.orderSql)
    }

    if (this.limitCount !== null) {
      queryParts.push(Prisma.sql`LIMIT ${this.limitCount}`)
    }

    if (this.offsetCount !== null) {
      queryParts.push(Prisma.sql`OFFSET ${this.offsetCount}`)
    }

    return Prisma.join(queryParts, ' ')
  }

  private buildStackedFrom(where: Prisma.Sql): Prisma.Sql {
    const rawExtensions = [...STACK_RAW_EXTENSIONS]
    const previewExtensions = [...STACK_PREVIEW_EXTENSIONS]
    // Symlinks never stack: they point at a file, they are not one, and a link named like a RAW
    // must not pair with (or hide) the real file.
    const notLink = Prisma.sql`a.type <> 'symlink'`
    const memberIds = this.stackedMemberIds
      ? Prisma.sql`,
        CASE WHEN s.stack_on THEN array_agg(s.id::text)
          FILTER (WHERE s.stack_is_raw OR s.stack_is_preview)
          OVER (PARTITION BY s.parent_id, s.stack_key
            ORDER BY s.stack_rank, s.name, s.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) END AS stack_ids`
      : Prisma.empty
    // The derived tables carry only the columns the outer query reads (id, name, parent_id,
    // size_byte, sort_index, created_at), not `a.*`: every row is held while the windows run.
    return Prisma.sql`(
      SELECT s.*,
        CASE WHEN s.stack_on THEN row_number() OVER (
          PARTITION BY s.parent_id, s.stack_key, s.stack_on
          ORDER BY s.stack_rank, s.name, s.id
        ) ELSE 1 END AS stack_rn,
        CASE WHEN s.stack_on THEN count(*) FILTER (WHERE s.stack_is_raw OR s.stack_is_preview)
          OVER (PARTITION BY s.parent_id, s.stack_key) ELSE 1 END AS stack_count,
        CASE WHEN s.stack_on THEN sum(COALESCE(s.size_byte, 0)) FILTER (WHERE s.stack_is_raw OR s.stack_is_preview)
          OVER (PARTITION BY s.parent_id, s.stack_key) ELSE COALESCE(s.size_byte, 0) END AS stack_size${memberIds}
      FROM (
        SELECT g.*,
          (g.stack_is_raw OR g.stack_is_preview)
            AND bool_or(g.stack_is_raw) OVER (PARTITION BY g.parent_id, g.stack_key)
            AND bool_or(g.stack_is_preview) OVER (PARTITION BY g.parent_id, g.stack_key) AS stack_on
        FROM (
          SELECT a.id, a.name, a.parent_id, a.size_byte, a.sort_index, a.created_at,
            ${STACK_BASE_NAME_SQL} AS stack_key,
            (${notLink} AND COALESCE(${STACK_EXTENSION_SQL} = ANY(${rawExtensions}::text[]), false)) AS stack_is_raw,
            (${notLink} AND COALESCE(${STACK_EXTENSION_SQL} = ANY(${previewExtensions}::text[]), false)) AS stack_is_preview,
            COALESCE(array_position(${previewExtensions}::text[], ${STACK_EXTENSION_SQL}), 100) AS stack_rank
          FROM ${this.fromSql} ${where}
        ) g
      ) s
    ) a WHERE a.stack_rn = 1`
  }

  private isDate(value: unknown): boolean {
    if (value instanceof Date) return true
    if (typeof value !== 'string') return false
    const valStr = value.trim().toLowerCase()
    const relativeKeywords = [
      'today',
      'yesterday',
      'tomorrow',
      'one week ago',
      'one week from now',
      'one month ago',
      'one month from now',
    ]
    if (relativeKeywords.includes(valStr) || valStr.match(/^\d+\s+days?\s+(ago|from\s+now)$/)) {
      return true
    }
    if (!valStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      return false
    }
    const d = new Date(value)
    return !isNaN(d.getTime())
  }

  private toDate(value: unknown): Date {
    return this.toDateBound(value, 'start')
  }

  private toDateBound(value: unknown, bound: 'start' | 'end'): Date {
    const range = this.parseDateRange(value)
    return bound === 'start' ? range.start : range.end
  }

  private parseDateRange(value: unknown): { start: Date; end: Date } {
    const d = this.parseRelativeDate(value)
    if (d && 'gte' in d && 'lte' in d) {
      return { start: d.gte!, end: d.lte! }
    }
    const date = d instanceof Date ? d : new Date(value as string)
    const valStr = typeof value === 'string' ? value : ''
    const hasTime = valStr.includes('T') || valStr.includes(':')
    if (hasTime) {
      return { start: date, end: date }
    }
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

  private buildSqlCondition(field: string, operator: string, value: unknown): Prisma.Sql | null {
    if (field === 'name') {
      const dbCol = Prisma.raw(`a."name"`)
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
      const dbCol = Prisma.raw(`a."size_byte"`)
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
      const colName = field === 'createdAt' || field === 'created_at' ? 'created_at' : 'updated_at'
      const dbCol = Prisma.raw(`a."${colName}"`)
      switch (operator) {
        case 'eq': {
          const range = this.parseDateRange(value)
          return Prisma.sql`${dbCol} >= ${range.start} AND ${dbCol} <= ${range.end}`
        }
        case 'neq': {
          const range = this.parseDateRange(value)
          return Prisma.sql`(${dbCol} < ${range.start} OR ${dbCol} > ${range.end})`
        }
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
      case 'gt': {
        if (
          typeof value === 'number' ||
          (typeof value === 'string' && !isNaN(Number(value)) && !this.isDate(value))
        ) {
          return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND number_value > ${Number(value)})`
        }
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND date_value > ${this.toDateBound(value, 'end')})`
      }
      case 'gte': {
        if (
          typeof value === 'number' ||
          (typeof value === 'string' && !isNaN(Number(value)) && !this.isDate(value))
        ) {
          return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND number_value >= ${Number(value)})`
        }
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND date_value >= ${this.toDateBound(value, 'start')})`
      }
      case 'lt': {
        if (
          typeof value === 'number' ||
          (typeof value === 'string' && !isNaN(Number(value)) && !this.isDate(value))
        ) {
          return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND number_value < ${Number(value)})`
        }
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND date_value < ${this.toDateBound(value, 'start')})`
      }
      case 'lte': {
        if (
          typeof value === 'number' ||
          (typeof value === 'string' && !isNaN(Number(value)) && !this.isDate(value))
        ) {
          return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND number_value <= ${Number(value)})`
        }
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND date_value <= ${this.toDateBound(value, 'end')})`
      }
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
      case 'hasAll':
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND json_value @> ${JSON.stringify(value)}::jsonb)`
      case 'hasAny': {
        const valArr = (Array.isArray(value) ? value : [value]).map(String)
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND jsonb_exists_any(json_value, ${valArr}::text[]))`
      }
      case 'hasNone': {
        const valArr = (Array.isArray(value) ? value : [value]).map(String)
        return Prisma.sql`a.id NOT IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND jsonb_exists_any(json_value, ${valArr}::text[]))`
      }
      case 'isWithin': {
        const range = this.parseDateRange(value)
        return Prisma.sql`a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = ${field} AND date_value >= ${range.start} AND date_value <= ${range.end})`
      }
      default:
        throw new Error(`Unsupported operator for metadata field: ${operator}`)
    }
  }
}
