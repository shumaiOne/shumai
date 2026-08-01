import { describe, it, expect } from 'vitest'
import { prisma } from '@shumai/db'
import { AuditAction } from '@shumai/dtos'
import { setupTestDbHooks } from '@shumai/db/test'
import { auditLogService } from './auditLog'

describe('AuditLogService', () => {
  setupTestDbHooks()

  it('creates and lists audit logs with pagination and filters', async () => {
    const user = await prisma.user.create({
      data: { name: 'Audit Test User', email: 'audit@example.com', password: 'password' },
    })

    const team = await prisma.team.create({
      data: { name: 'Audit Test Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'Audit Test Project', teamId: team.id },
    })

    // Create action logs
    const log1 = await auditLogService.logAction({
      action: AuditAction.project_create,
      teamId: team.id,
      userId: user.id,
      projectId: project.id,
      itemId: project.id,
    })

    const log2 = await auditLogService.logAction({
      action: AuditAction.project_update,
      teamId: team.id,
      userId: user.id,
      projectId: project.id,
      itemId: project.id,
    })

    expect(log1).toBeDefined()
    expect(log2).toBeDefined()

    // Test list all audit logs for team
    const resultAll = await auditLogService.listAuditLogs({
      teamId: team.id,
    })

    expect(resultAll.total).toBe(2)
    expect(resultAll.nodes).toHaveLength(2)
    expect(resultAll.nodes[0].action).toBe(AuditAction.project_update)
    expect(resultAll.nodes[1].action).toBe(AuditAction.project_create)

    // Test filtering by action
    const resultAction = await auditLogService.listAuditLogs({
      teamId: team.id,
      actions: [AuditAction.project_create],
    })

    expect(resultAction.total).toBe(1)
    expect(resultAction.nodes[0].action).toBe(AuditAction.project_create)

    // Test filtering by user ID
    const resultUser = await auditLogService.listAuditLogs({
      teamId: team.id,
      userIds: [user.id],
    })

    expect(resultUser.total).toBe(2)

    // Test filtering by item ID
    const resultItem = await auditLogService.listAuditLogs({
      teamId: team.id,
      itemId: project.id,
    })

    expect(resultItem.total).toBe(2)
  })

  it('handles database errors gracefully and logs error without throwing', async () => {
    const result = await auditLogService.logAction({
      action: AuditAction.project_create,
      teamId: 'invalid-non-existent-team-id',
    })

    expect(result).toBeNull()
  })
})
