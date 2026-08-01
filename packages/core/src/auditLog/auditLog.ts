import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import type { AuditAction } from '@shumai/dtos'
import { paginateQuery } from '@shumai/core/src/pagination'

export interface LogActionParams {
  action: AuditAction
  teamId: string
  userId?: string
  projectId?: string
  itemId?: string
}

export interface ListAuditLogsParams {
  teamId: string
  actions?: AuditAction[]
  userIds?: string[]
  itemId?: string
  first?: number
  after?: string
}

export class AuditLogService {
  async logAction(params: LogActionParams) {
    return await prisma.auditLog.create({
      data: {
        action: params.action,
        teamId: params.teamId,
        userId: params.userId,
        projectId: params.projectId,
        itemId: params.itemId,
      },
    })
  }

  async listAuditLogs(params: ListAuditLogsParams) {
    const where: Prisma.AuditLogWhereInput = {
      teamId: params.teamId,
    }

    if (params.actions && params.actions.length > 0) {
      where.action = { in: params.actions }
    }

    if (params.userIds && params.userIds.length > 0) {
      where.userId = { in: params.userIds }
    }

    if (params.itemId && params.itemId.trim() !== '') {
      where.itemId = { contains: params.itemId.trim(), mode: 'insensitive' }
    }

    const result = await paginateQuery(
      (skip, take) =>
        prisma.auditLog.findMany({
          where,
          orderBy: { id: 'desc' },
          skip,
          take,
        }),
      () => prisma.auditLog.count({ where }),
      { first: params.first, after: params.after },
    )

    return {
      nodes: result.data.map((item) => ({
        id: item.id,
        action: item.action,
        teamId: item.teamId,
        userId: item.userId,
        projectId: item.projectId,
        itemId: item.itemId,
        createdAt: item.createdAt.toISOString(),
      })),
      pageInfo: {
        hasNextPage: !!result.pageInfo.cursor,
        endCursor: result.pageInfo.cursor || null,
      },
      total: result.pageInfo.total ?? 0,
    }
  }
}

export const auditLogService = new AuditLogService()
