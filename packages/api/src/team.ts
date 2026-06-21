import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { teamService } from '@shumai/core/src/team/team'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'
import { notificationService } from '@shumai/core/src/notification/notification'
import { NotificationType } from '@shumai/db'
import {
  createTeamRequestSchema,
  getUserTeamsRequestSchema,
  updateTeamSettingsRequestSchema,
  listMembersQuerySchema,
  updateSandboxSettingsRequestSchema,
  updateMeRequestSchema,
  updateTeamMemberRoleRequestSchema,
  createApiTokenRequestSchema,
} from '@shumai/dtos'
import { updateUserMetadataRequestSchema } from '@shumai/dtos'
import { apiTokenService } from '@shumai/core/src/user/api-token'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams', zValidator('json', createTeamRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    const newTeam = await teamService.createTeam(user, req)
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
      tokens.map((t) => ({
        id: t.id,
        token: t.token,
        name: t.name,
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

    const token = await apiTokenService.createToken(user.id, req.name)
    return c.json({
      id: token.id,
      token: token.token,
      name: token.name,
      createdAt: token.createdAt.toISOString(),
    })
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

export default route
