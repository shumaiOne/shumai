import { Prisma } from '@/generated/prisma/client.ts'
import { SearchCondition } from '@/dtos/search'

export class SqlQueryBuilder {
  private selectSql: Prisma.Sql = Prisma.sql`*`
  private fromSql: Prisma.Sql | null = null
  private wheres: Prisma.Sql[] = []
  private orderSql: Prisma.Sql | null = null
  private limitCount: number | null = null
  private offsetCount: number | null = null

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

    const queryParts: Prisma.Sql[] = [
      Prisma.sql`SELECT`,
      this.selectSql,
      Prisma.sql`FROM`,
      this.fromSql,
    ]

    if (this.wheres.length > 0) {
      queryParts.push(Prisma.sql`WHERE`)
      queryParts.push(Prisma.join(this.wheres, ' AND '))
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

  private buildSqlCondition(field: string, operator: string, value: unknown): Prisma.Sql | null {
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
