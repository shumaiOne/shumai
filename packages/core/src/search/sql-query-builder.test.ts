import { describe, expect, it } from 'vitest'
import { SqlQueryBuilder } from './sql-query-builder'
import { Prisma } from '@shumai/db'

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

  describe('stackRawJpeg', () => {
    it('leaves the query alone when stacking is off', () => {
      const query = new SqlQueryBuilder()
        .select(Prisma.sql`a.id`)
        .from(Prisma.sql`assets a`)
        .addWhere(Prisma.sql`a.is_deleted = false`)
        .stackRawJpeg(false)
        .build()
      expect(query.text).toBe('SELECT a.id FROM assets a WHERE a.is_deleted = false')
    })

    it('wraps the filtered rows and keeps only the cover of each shot', () => {
      const query = new SqlQueryBuilder()
        .select(Prisma.sql`a.id`)
        .from(Prisma.sql`assets a`)
        .addWhere(Prisma.sql`a.parent_id = ${'folder-1'}`)
        .stackRawJpeg()
        .orderBy(Prisma.sql`a.name ASC`)
        .build()
      expect(query.text).toMatch(/FROM assets a WHERE a\.parent_id = \$\d/)
      expect(query.values).toContain('folder-1')
      expect(query.text).toContain('PARTITION BY s.parent_id, s.stack_key')
      expect(query.text).toContain('a.stack_rn = 1 ORDER BY a.name ASC')
      // The RAW and JPEG/HEIF extension lists are bound as parameters, RAW list first.
      const lists = query.values.filter((value): value is string[] => Array.isArray(value))
      expect(lists[0]).toContain('raf')
      expect(lists[1]).toEqual(['jpg', 'jpeg', 'heic', 'heif', 'hif'])
    })
  })

  describe('stackRawJpeg: matched members and symlinks', () => {
    const build = (memberIds: boolean) =>
      new SqlQueryBuilder()
        .select(Prisma.sql`a.id`)
        .from(Prisma.sql`assets a`)
        .addWhere(Prisma.sql`a.is_deleted = false`)
        .stackRawJpeg(true, { memberIds })
        .build()

    it('returns the matched ids of each stack only when asked', () => {
      expect(build(true).text).toContain('array_agg(s.id::text)')
      expect(build(true).text).toMatch(
        /ORDER BY s.stack_rank, s.name, s\.id\s+ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING/,
      )
      expect(build(true).text).toContain('AS stack_ids')
      expect(build(false).text).not.toContain('stack_ids')
    })

    it('computes the ids over the filtered rows, inside the WHERE', () => {
      const text = build(true).text
      // The filters sit in the innermost derived table, so the window only sees matched rows.
      expect(text).toMatch(/FROM assets a WHERE a\.is_deleted = false\s*\) g/)
    })

    it('never stacks symlinks', () => {
      const text = build(false).text
      expect(text).toContain("a.type <> 'symlink'")
      expect(text.match(/a\.type <> 'symlink'/g)).toHaveLength(2)
    })

    it('carries only the columns the outer query needs', () => {
      const text = build(false).text
      expect(text).toContain(
        'SELECT a.id, a.name, a.parent_id, a.size_byte, a.sort_index, a.created_at',
      )
      expect(text).not.toContain('SELECT a.*')
    })
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
