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

  it('throws an error if FROM clause is missing', () => {
    const builder = new SqlQueryBuilder().select(Prisma.sql`id`)
    expect(() => builder.build()).toThrow('FROM clause is required')
  })
})
