import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  createProjectInviteRequestSchema,
  createTeamInviteRequestSchema,
  joinRequestSchema,
  InviteInfo,
} from '@shumai/dtos'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { inviteService } from '@shumai/core/src/invite/invite'
import { notificationService } from '@shumai/core/src/notification/notification'
import { NotificationType, AuditAction } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

type User = Prisma.UserGetPayload<Record<string, never>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapToInviteInfo = (inv: any): InviteInfo => {
  const info: InviteInfo = {
    code: inv.code,
    role: inv.role!,
    teamId: inv.teamId,
    teamName: inv.team.name,
    inviterName: inv.inviter.name,
    isUsed: inv.used,
  }

  if (inv.project) {
    info.projectId = inv.project.id
    info.projectName = inv.project.name
  }

  return info
}

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/invite', zValidator('json', createTeamInviteRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const inv = await inviteService.createTeamInvite({
      teamId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: req.role as any,
      inviterId: user.id,
    })

    await auditLogService.logAction({
      action: AuditAction.invite_create,
      teamId,
      userId: user.id,
      itemId: inv.id,
    })

    return c.json(mapToInviteInfo(inv))
  })
  .post(
    '/projects/:projectId/invite',
    zValidator('json', createProjectInviteRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Project,
        id: projectId,
      })

      const inv = await inviteService.createProjectInvite({
        projectId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: req.role as any,
        inviterId: user.id,
      })

      await auditLogService.logAction({
        action: AuditAction.invite_create,
        teamId: inv.teamId,
        userId: user.id,
        projectId,
        itemId: inv.id,
      })

      return c.json(mapToInviteInfo(inv))
    },
  )
  .post('/join', zValidator('json', joinRequestSchema), async (c) => {
    const req = c.req.valid('json')
    const user = c.get('user')

    try {
      const info = await inviteService.getInvite(req.code)

      await inviteService.consumeInvite(req.code, user.id)

      if (info.projectId) {
        await notificationService.create({
          type: NotificationType.new_user_join_project,
          teamId: info.teamId,
          projectId: info.projectId,
          userId: user.id,
        })
      } else {
        await notificationService.create({
          type: NotificationType.new_user_join_team,
          teamId: info.teamId,
          userId: user.id,
        })
      }

      return new Response(null, { status: 200 })
    } catch {
      return c.json({ error: 'Bad Request' }, 400)
    }
  })

export default route
