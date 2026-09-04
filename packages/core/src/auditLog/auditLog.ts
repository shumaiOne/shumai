import { prisma } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import type { AuditAction } from '@shumai/dtos'
import { paginateQuery } from '@shumai/core/src/pagination'
import { logger } from '@shumai/core/src/logger'

export interface LogActionParams {
  action: AuditAction
  teamId: string
  userId?: string
  agentId?: string
  projectId?: string
  itemId?: string
}

export interface ListAuditLogsParams {
  teamId: string
  actions?: AuditAction[]
  userIds?: string[]
  agentIds?: string[]
  itemId?: string
  first?: number
  after?: string
}

export class AuditLogService {
  async logAction(params: LogActionParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          action: params.action,
          teamId: params.teamId,
          userId: params.userId,
          agentId: params.agentId,
          projectId: params.projectId,
          itemId: params.itemId,
        },
      })
    } catch (err) {
      logger.error({ err, params }, 'Failed to create audit log')
      return null
    }
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

    if (params.agentIds && params.agentIds.length > 0) {
      where.agentId = { in: params.agentIds }
    }

    if (params.itemId && params.itemId.trim() !== '') {
      where.itemId = { contains: params.itemId.trim(), mode: 'insensitive' }
    }

    const result = await paginateQuery(
      (skip, take) =>
        prisma.auditLog.findMany({
          where,
          include: { agent: { include: { user: true } } },
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
        agentId: item.agentId,
        agent: item.agent ? { id: item.agent.id, name: item.agent.user.name } : null,
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
