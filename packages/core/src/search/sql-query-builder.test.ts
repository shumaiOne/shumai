import { describe, expect, it } from 'vitest'
import { SqlQueryBuilder, buildFileTypeCountsQuery } from './sql-query-builder'
import { Prisma } from '@shumai/db'
import { FILE_TYPE_EXTENSION_PATTERN } from '@shumai/dtos'

describe('buildFileTypeCountsQuery', () => {
  const base = { operator: 'AND' as const, conditions: [], showSymlink: undefined }

  it('is a single grouped COUNT over the folders, ignoring any file-type filter', () => {
    const q = buildFileTypeCountsQuery(['f1', 'f2'], base)
    expect(q.text).toContain('count(*) AS count FROM assets a WHERE a.is_deleted = false')
    expect(q.text).toContain('a.parent_id = ANY($1)')
    expect(q.text).toMatch(/GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT \$\d+$/)
    expect(q.text).not.toContain('::text[]')
    expect(q.values[0]).toEqual(['f1', 'f2'])
    expect(q.values.at(-1)).toBe(500)
  })

  it('keeps the regex backslash and needs a stem so ".jpg" has no extension', () => {
    expect(buildFileTypeCountsQuery(['f1'], base).text).toContain("'^.+\\.([^.]+)$'")
  })

  it('only offers extensions the file-type filter accepts, plus the no-extension row', () => {
    const q = buildFileTypeCountsQuery(['f1'], base)
    expect(q.text).toContain('IS NULL OR')
    expect(q.text).toContain(' ~ $')
    expect(q.values).toContain(FILE_TYPE_EXTENSION_PATTERN)
    // The pattern is the schema's own: "tar-gz" and 11 characters fail it, "jpg" and "3fr" pass.
    const re = new RegExp(FILE_TYPE_EXTENSION_PATTERN)
    expect(['jpg', '3fr', 'a1'].every((e) => re.test(e))).toBe(true)
    expect(['tar-gz', 'abcdefghijk', 'a_b', ''].some((e) => re.test(e))).toBe(false)
  })

  it('applies the active search conditions like the listing does', () => {
    const q = buildFileTypeCountsQuery(['f1'], {
      operator: 'AND',
      conditions: [{ field: 'name', operator: 'contains', value: 'beach' }],
    })
    expect(q.text).toContain('a.name ILIKE')
    expect(q.values).toContain('%beach%')
  })

  it('includes symlinks only when asked', () => {
    expect(buildFileTypeCountsQuery(['f1'], base).text).not.toContain("a.type = 'symlink'")
    expect(buildFileTypeCountsQuery(['f1'], { ...base, showSymlink: true }).text).toContain(
      "a.type = 'symlink'",
    )
  })
})

describe('SqlQueryBuilder', () => {
  it('correctly constructs a basic SQL query', () => {
    const builder = new SqlQueryBuilder()
      .select(Prisma.sql`a.id, a.name`)
      .from(Prisma.sql`assets a`)
      .addWhere(Prisma.sql`a.is_deleted = false`)

    const query = builder.build()
    expect(query.text).toContain('SELECT a.id, a.name FROM assets a WHERE a.is_deleted = false')
  })

  it('correctly constructs query with where clauses, order, limit, and offset', () => {
    const vectorJson = '[0.1, 0.2, 0.3]'
    const builder = new SqlQueryBuilder()
      .select(Prisma.sql`a.id, ae.start_time as "startTime"`)
      .from(Prisma.sql`assets a JOIN asset_embeddings ae ON a.id = ae.asset_id`)
      .addWhere(Prisma.sql`a.is_deleted = false`)
      .addWhere(Prisma.sql`a.project_id = ${'project-123'}`)
      .orderBy(Prisma.sql`ae.embedding <=> ${vectorJson}::vector ASC`)
      .limit(10)
      .offset(20)

    const query = builder.build()
    expect(query.text).toContain(
      'SELECT a.id, ae.start_time as "startTime" FROM assets a JOIN asset_embeddings ae ON a.id = ae.asset_id WHERE a.is_deleted = false AND a.project_id = $1 ORDER BY ae.embedding <=> $2::vector ASC LIMIT $3 OFFSET $4',
    )
    expect(query.values).toEqual(['project-123', vectorJson, 10, 20])
  })

  it('throws an error if FROM clause is missing', () => {
    const builder = new SqlQueryBuilder().select(Prisma.sql`id`)
    expect(() => builder.build()).toThrow('FROM clause is required')
  })

  describe('Bug Reproduction Tests for buildSqlCondition', () => {
    it('Bug 1: createdAt eq date should match full day range (>= startOfDay AND <= endOfDay)', () => {
      const builder = new SqlQueryBuilder()
        .from(Prisma.sql`assets a`)
        .addSearchConditions('AND', [{ field: 'createdAt', operator: 'eq', value: '2026-07-22' }])

      const query = builder.build()
      expect(query.text).toBe(
        'SELECT * FROM assets a WHERE (a."created_at" >= $1 AND a."created_at" <= $2)',
      )
      const startVal = query.values[0] as Date
      const endVal = query.values[1] as Date
      expect(startVal.getHours()).toBe(0)
      expect(startVal.getMinutes()).toBe(0)
      expect(startVal.getSeconds()).toBe(0)
      expect(endVal.getHours()).toBe(23)
      expect(endVal.getMinutes()).toBe(59)
      expect(endVal.getSeconds()).toBe(59)
    })

    it('Bug 2: createdAt lte date should use end-of-day timestamp (23:59:59.999)', () => {
      const builder = new SqlQueryBuilder()
        .from(Prisma.sql`assets a`)
        .addSearchConditions('AND', [{ field: 'createdAt', operator: 'lte', value: '2026-07-22' }])

      const query = builder.build()
      expect(query.text).toBe('SELECT * FROM assets a WHERE (a."created_at" <= $1)')
      const endVal = query.values[0] as Date
      expect(endVal.getHours()).toBe(23)
      expect(endVal.getMinutes()).toBe(59)
      expect(endVal.getSeconds()).toBe(59)
    })

    it('Bug 3: custom metadata numeric query should ONLY query number_value', () => {
      const builder = new SqlQueryBuilder()
        .from(Prisma.sql`assets a`)
        .addSearchConditions('AND', [{ field: 'rating', operator: 'gt', value: 100 }])

      const query = builder.build()
      expect(query.text).toBe(
        'SELECT * FROM assets a WHERE (a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = $1 AND number_value > $2))',
      )
      expect(query.values).toEqual(['rating', 100])
    })

    it('Bug 4: isDate should not misclassify dash-separated non-date string values like "1-2"', () => {
      const builder = new SqlQueryBuilder()
        .from(Prisma.sql`assets a`)
        .addSearchConditions('AND', [{ field: 'sku', operator: 'eq', value: '1-2' }])

      const query = builder.build()
      expect(query.text).toBe(
        'SELECT * FROM assets a WHERE (a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = $1 AND string_value = $2))',
      )
      expect(query.values).toEqual(['sku', '1-2'])
    })

    it('Bug 5: custom field names with special characters are safely parameterized', () => {
      const builder = new SqlQueryBuilder()
        .from(Prisma.sql`assets a`)
        .addSearchConditions('AND', [
          { field: 'custom_field"test', operator: 'eq', value: 'hello' },
        ])

      const query = builder.build()
      expect(query.text).toBe(
        'SELECT * FROM assets a WHERE (a.id IN (SELECT asset_id FROM asset_metadata_values WHERE field_key = $1 AND string_value = $2))',
      )
      expect(query.values).toEqual(['custom_field"test', 'hello'])
    })
  })
})
