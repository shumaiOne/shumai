import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { notificationService } from '@/services/notification/notification'
import { authzService, Permission } from '@/services/authz/authz'
import {
  listNotificationsRequestSchema,
  markNotificationReadRequestSchema,
} from '@/dtos/notification'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get(
    '/teams/:teamId/notifications',
    zValidator('query', listNotificationsRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const req = c.req.valid('query')
      const user = c.get('user')

      await authzService.hasPermission({
        teamId,
        user,
        permission: Permission.Read,
      })

      const res = await notificationService.list(teamId, user.id, {
        unreadOnly: req.unreadOnly,
        after: req.after,
        pageSize: req.pageSize,
      })

      // To align with Go struct casing, map pageInfo to page_info
      return c.json({
        data: res.data,
        pageInfo: {
          total: res.pageInfo.total,
          cursor: res.pageInfo.cursor,
        },
      })
    },
  )
  .post(
    '/teams/:teamId/notifications/read',
    zValidator('json', markNotificationReadRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        teamId,
        user,
        permission: Permission.Read,
      })

      await notificationService.markRead(teamId, user.id, req.notificationId)

      return new Response(null, { status: 204 })
    },
  )

export default route
