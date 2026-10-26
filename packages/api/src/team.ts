import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { teamService } from '@shumai/core/src/team/team'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { notificationService } from '@shumai/core/src/notification/notification'
import {
  createTeamRequestSchema,
  getUserTeamsRequestSchema,
  updateTeamSettingsRequestSchema,
  listMembersQuerySchema,
  updateSandboxSettingsRequestSchema,
  updateTurntableSettingsRequestSchema,
  updateGotenbergSettingsRequestSchema,
  updateMeRequestSchema,
  updateTeamMemberRoleRequestSchema,
  createApiTokenRequestSchema,
  listAuditLogsQuerySchema,
  listWorkflowTasksQuerySchema,
  batchWorkflowTaskStatusSchema,
} from '@shumai/dtos'
import {
  updateUserMetadataRequestSchema,
  getTeamAiUsageQuerySchema,
  AuditAction,
} from '@shumai/dtos'
import type { ApiTokenResponse, CreateApiTokenResponse } from '@shumai/dtos'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import { aiUsageService } from '@shumai/core/src/ai-usage/ai-usage'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { workflowTaskService } from '@shumai/core/src/workflowTask/workflowTask'
import { turntableService } from '@shumai/core/src/turntable/turntable'
import { gotenbergService } from '@shumai/core/src/gotenberg/gotenberg'
import { NotificationType } from '@shumai/db'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams', zValidator('json', createTeamRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    const newTeam = await teamService.createTeam(user, req)
    await auditLogService.logAction({
      action: AuditAction.team_create,
      teamId: newTeam.id,
      userId: user.id,
      itemId: newTeam.id,
    })
    return c.json(newTeam)
  })
  .get('/teams', zValidator('query', getUserTeamsRequestSchema), async (c) => {
    const user = c.get('user')
    const pg = c.req.valid('query')

    const teams = await teamService.getUserTeams({
      userId: user.id,
      pagination: pg,
    })

    return c.json({
      data: teams.data,
      pageInfo: {
        total: teams.pageInfo.total,
        cursor: teams.pageInfo.cursor,
      },
    })
  })
  .post('/teams/:teamId/members', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await teamService.joinTeam({
      teamId,
      userId: user.id,
    })

    await notificationService.create({
      type: NotificationType.new_user_join_team,
      teamId,
      userId: user.id,
    })

    await auditLogService.logAction({
      action: AuditAction.team_member_add,
      teamId,
      userId: user.id,
      itemId: user.id,
    })

    return new Response(null, { status: 204 })
  })
  .get('/teams/:teamId/me', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const me = await teamService.getMe({
      teamId,
      user,
    })

    return c.json(me)
  })
  .patch('/teams/:teamId/me', zValidator('json', updateMeRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    await teamService.updateMe(user.id, req)
    return c.json({ success: true })
  })
  .get('/teams/:teamId/members', zValidator('query', listMembersQuerySchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const { includeAgents } = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const members = await teamService.getTeamMembers({
      teamId,
      userId: user.id,
      includeAgents: includeAgents,
    })

    return c.json(members)
  })
  .patch(
    '/teams/:teamId/members/:userId',
    zValidator('json', updateTeamMemberRoleRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const userId = c.req.param('userId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      await teamService.updateMemberRole({
        teamId,
        userId,
        role: req.role,
      })

      await auditLogService.logAction({
        action: AuditAction.team_member_update,
        teamId,
        userId: user.id,
        itemId: userId,
      })

      return c.json({ success: true })
    },
  )
  .delete('/teams/:teamId/members/:userId', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const userId = c.req.param('userId')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    await teamService.removeMember(teamId, userId)

    await auditLogService.logAction({
      action: AuditAction.team_member_remove,
      teamId,
      userId: user.id,
      itemId: userId,
    })

    return c.json({ success: true })
  })
  .get('/teams/:teamId/settings', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const settings = await teamService.getSettings(teamId)
    return c.json(settings)
  })
  .patch(
    '/teams/:teamId/settings',
    zValidator('json', updateTeamSettingsRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const settings = await teamService.updateSettings(teamId, req.key, req.value)

      await auditLogService.logAction({
        action: AuditAction.team_update,
        teamId,
        userId: user.id,
        itemId: teamId,
      })

      return c.json(settings)
    },
  )
  .get('/teams/:teamId/sandbox', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const sandbox = await teamService.getSandboxSettings(teamId)
    return c.json(sandbox)
  })
  .put(
    '/teams/:teamId/sandbox',
    zValidator('json', updateSandboxSettingsRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const sandbox = await teamService.updateSandboxSettings(teamId, req)
      return c.json(sandbox)
    },
  )
  .get('/teams/:teamId/turntable-settings', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const settings = await turntableService.getSettings(teamId)
    return c.json(settings)
  })
  .put(
    '/teams/:teamId/turntable-settings',
    zValidator('json', updateTurntableSettingsRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      try {
        const settings = await turntableService.updateSettings(teamId, req)
        return c.json(settings)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ message }, 400)
      }
    },
  )
  .post(
    '/teams/:teamId/turntable-settings/test',
    zValidator('json', updateTurntableSettingsRequestSchema.partial()),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const res = await turntableService.testConnection(req, teamId)
      return c.json(res)
    },
  )
  .get('/teams/:teamId/gotenberg-settings', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const settings = await gotenbergService.getSettings(teamId)
    return c.json(settings)
  })
  .put(
    '/teams/:teamId/gotenberg-settings',
    zValidator('json', updateGotenbergSettingsRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      try {
        const settings = await gotenbergService.updateSettings(teamId, req)
        return c.json(settings)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ message }, 400)
      }
    },
  )
  .post(
    '/teams/:teamId/gotenberg-settings/test',
    zValidator('json', updateGotenbergSettingsRequestSchema.partial()),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const res = await gotenbergService.testConnection(req, teamId)
      return c.json(res)
    },
  )
  .get('/teams/:teamId/user-metadata', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const metadata = await userMetadataService.listMetadata(user.id, teamId)
    return c.json(metadata)
  })
  .put(
    '/teams/:teamId/user-metadata/:key',
    zValidator('json', updateUserMetadataRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const key = c.req.param('key')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })

      const metadata = await userMetadataService.upsertMetadata(user.id, teamId, key, req.value)
      return c.json({ key: metadata.key, value: metadata.value })
    },
  )
  .get('/teams/:teamId/api-tokens', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const tokens = await apiTokenService.listTokens(user.id)
    return c.json(
      tokens.map((t): ApiTokenResponse => ({
        id: t.id,
        name: t.name,
        tokenHint: t.tokenHint,
        createdAt: t.createdAt.toISOString(),
      })),
    )
  })
  .post('/teams/:teamId/api-tokens', zValidator('json', createApiTokenRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const { record, token } = await apiTokenService.createToken(user.id, req.name)
    const response: CreateApiTokenResponse = {
      id: record.id,
      name: record.name,
      tokenHint: record.tokenHint,
      createdAt: record.createdAt.toISOString(),
      token,
    }
    return c.json(response)
  })
  .delete('/teams/:teamId/api-tokens/:tokenId', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const tokenId = c.req.param('tokenId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    await apiTokenService.deleteToken(user.id, tokenId)
    return c.json({ success: true })
  })
  .get('/teams/:teamId/ai-usage', zValidator('query', getTeamAiUsageQuerySchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const { timeframe, userId } = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const stats = await aiUsageService.getTeamUsageStats({
      teamId,
      timeframe,
      userId,
    })

    return c.json(stats)
  })
  .get('/teams/:teamId/audit-logs', zValidator('query', listAuditLogsQuerySchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const query = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const logs = await auditLogService.listAuditLogs({
      teamId,
      actions: query.actions,
      userIds: query.userIds,
      agentIds: query.agentIds,
      itemId: query.itemId,
      first: query.first,
      after: query.after,
    })

    return c.json(logs)
  })
  .get(
    '/teams/:teamId/workflow-tasks',
    zValidator('query', listWorkflowTasksQuerySchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const query = c.req.valid('query')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const tasks = await workflowTaskService.listWorkflowTasks({
        teamId,
        status: query.status,
        types: query.types,
        first: query.first,
        after: query.after,
      })

      return c.json(tasks)
    },
  )
  .post(
    '/teams/:teamId/workflow-tasks/batch-status',
    zValidator('json', batchWorkflowTaskStatusSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const result = await workflowTaskService.getBatchWorkflowTaskStatus({
        teamId,
        taskIds: req.taskIds,
      })

      return c.json(result)
    },
  )
  .post('/teams/:teamId/workflow-tasks/:taskId/stop', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const taskId = c.req.param('taskId')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const result = await workflowTaskService.stopWorkflowTask({
      teamId,
      taskId,
    })

    return c.json(result)
  })

export default route
