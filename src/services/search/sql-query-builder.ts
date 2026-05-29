import { Prisma } from '@/generated/prisma/client.ts'

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
}
