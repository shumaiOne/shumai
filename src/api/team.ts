import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission } from '@/services/authz/authz'
import { teamService } from '@/services/team/team'
import { userMetadataService } from '@/services/user-metadata/user-metadata'
import { notificationService } from '@/services/notification/notification'
import { NotificationType } from '@/generated/prisma/client'
import {
  createTeamRequestSchema,
  getUserTeamsRequestSchema,
  updateTeamSettingsRequestSchema,
  listMembersQuerySchema,
  updateSandboxSettingsRequestSchema,
} from '@/dtos/team'
import { updateUserMetadataRequestSchema } from '@/dtos/user-metadata'
import type { Prisma } from '@/generated/prisma/client'

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
      teamId,
      user,
      permission: Permission.Read,
    })

    const me = await teamService.getMe({
      teamId,
      user,
    })

    return c.json(me)
  })
  .get('/teams/:teamId/members', zValidator('query', listMembersQuerySchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const { includeAgents } = c.req.valid('query')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
    })

    const members = await teamService.getTeamMembers({
      teamId,
      includeAgents: includeAgents,
    })

    return c.json(members)
  })
  .get('/teams/:teamId/settings', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
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
        teamId,
        user,
        permission: Permission.Admin,
      })

      const settings = await teamService.updateSettings(teamId, req.key, req.value)
      return c.json(settings)
    },
  )
  .get('/teams/:teamId/sandbox', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
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
        teamId,
        user,
        permission: Permission.Admin,
      })

      const sandbox = await teamService.updateSandboxSettings(teamId, req)
      return c.json(sandbox)
    },
  )
  .get('/teams/:teamId/user-metadata', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
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
        teamId,
        user,
        permission: Permission.Read,
      })

      const metadata = await userMetadataService.upsertMetadata(user.id, teamId, key, req.value)
      return c.json({ key: metadata.key, value: metadata.value })
    },
  )

export default route
