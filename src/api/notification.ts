import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { notificationService } from '@/services/notification/notification'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import {
  listNotificationsRequestSchema,
  markNotificationReadRequestSchema,
  notificationSettingsSchema,
} from '@/dtos/notification'
import { userMetadataService } from '@/services/user-metadata/user-metadata'
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
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
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
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })

      await notificationService.markRead(teamId, user.id, req.notificationId)

      return new Response(null, { status: 204 })
    },
  )
  .get('/teams/:teamId/notifications/settings', async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const metadata = await userMetadataService.getMetadata(user.id, teamId, 'notification_settings')
    const settings = metadata
      ? metadata.value
      : {
          comments: true,
          replies: true,
          mentions: true,
          yourUploads: false,
          otherUploads: true,
          statusUpdates: true,
        }

    return c.json(settings)
  })
  .post(
    '/teams/:teamId/notifications/settings',
    zValidator('json', notificationSettingsSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })

      await userMetadataService.upsertMetadata(user.id, teamId, 'notification_settings', req)

      return c.json({ success: true })
    },
  )

export default route
