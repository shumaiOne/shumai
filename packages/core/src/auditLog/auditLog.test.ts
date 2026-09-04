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

  it('records kanban actions accurately', async () => {
    const user = await prisma.user.create({
      data: { name: 'Kanban User', email: 'kanban_user@example.com', password: 'password' },
    })
    const team = await prisma.team.create({
      data: { name: 'Kanban Audit Team' },
    })

    await auditLogService.logAction({
      action: AuditAction.kanban_task_create,
      teamId: team.id,
      userId: user.id,
      itemId: 'task-123',
    })

    await auditLogService.logAction({
      action: AuditAction.kanban_goal_create,
      teamId: team.id,
      userId: user.id,
      itemId: 'goal-123',
    })

    const result = await auditLogService.listAuditLogs({
      teamId: team.id,
      actions: [AuditAction.kanban_task_create, AuditAction.kanban_goal_create],
    })

    expect(result.total).toBe(2)
    expect(result.nodes.map((n) => n.action)).toContain(AuditAction.kanban_task_create)
    expect(result.nodes.map((n) => n.action)).toContain(AuditAction.kanban_goal_create)
  })

  it('records and filters agent provenance in audit logs', async () => {
    const user = await prisma.user.create({
      data: { name: 'Audit Human User', email: 'audit_human@example.com', password: 'password' },
    })
    const team = await prisma.team.create({
      data: { name: 'Agent Audit Team' },
    })
    const agentUser = await prisma.user.create({
      data: {
        name: 'Creation Bot',
        email: 'creation_bot@example.com',
        type: 'agent',
      },
    })
    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        config: { provider: 'test', model: 'test' },
      },
    })

    const log = await auditLogService.logAction({
      action: AuditAction.file_create,
      teamId: team.id,
      userId: user.id,
      agentId: agent.id,
      itemId: 'file-xyz',
    })

    expect(log).toBeDefined()
    expect(log?.agentId).toBe(agent.id)

    const resultWithAgent = await auditLogService.listAuditLogs({
      teamId: team.id,
      agentIds: [agent.id],
    })

    expect(resultWithAgent.total).toBe(1)
    expect(resultWithAgent.nodes[0].agentId).toBe(agent.id)
    expect(resultWithAgent.nodes[0].agent).toEqual({
      id: agent.id,
      name: 'Creation Bot',
    })

    const resultOtherAgent = await auditLogService.listAuditLogs({
      teamId: team.id,
      agentIds: ['non-existent-agent'],
    })
    expect(resultOtherAgent.total).toBe(0)
  })
})
