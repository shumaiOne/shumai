import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission } from '@/services/authz/authz'
import { shareService } from '@/services/share/share'
import {
  createShareLinkRequestSchema,
  updateShareLinkRequestSchema,
  listShareLinksRequestSchema,
  addAssetToShareRequestSchema,
} from '@/dtos/share'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post(
    '/teams/:teamId/projects/:projectId/shares',
    zValidator('json', createShareLinkRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Edit,
      })

      const shareLink = await shareService.createShareLink(projectId, req)
      return c.json(shareLink)
    },
  )
  .get(
    '/teams/:teamId/projects/:projectId/shares',
    zValidator('query', listShareLinksRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('query')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Read,
      })

      const res = await shareService.listProjectShareLinks({
        ...req,
        projectId,
      })

      return c.json(res)
    },
  )
  .get('/teams/:teamId/shares/:shareId', async (c) => {
    const shareId = c.req.param('shareId')
    const user = c.get('user')

    const shareLink = await shareService.getShareLink(shareId)

    await authzService.hasPermission({
      projectId: shareLink.projectId,
      user,
      permission: Permission.Read,
    })

    return c.json(shareLink)
  })
  .put(
    '/teams/:teamId/shares/:shareId',
    zValidator('json', updateShareLinkRequestSchema),
    async (c) => {
      const shareId = c.req.param('shareId')
      const user = c.get('user')
      const req = c.req.valid('json')

      const shareLink = await shareService.getShareLink(shareId)
      await authzService.hasPermission({
        projectId: shareLink.projectId,
        user,
        permission: Permission.Edit,
      })

      const updated = await shareService.updateShareLink(shareId, req)
      return c.json(updated)
    },
  )
  .delete('/teams/:teamId/shares/:shareId', async (c) => {
    const shareId = c.req.param('shareId')
    const user = c.get('user')

    const shareLink = await shareService.getShareLink(shareId)
    await authzService.hasPermission({
      projectId: shareLink.projectId,
      user,
      permission: Permission.Edit,
    })

    await shareService.deleteShareLink(shareId)
    return c.body(null, 204)
  })
  .post(
    '/teams/:teamId/shares/:shareId/assets',
    zValidator('json', addAssetToShareRequestSchema),
    async (c) => {
      const shareId = c.req.param('shareId')
      const user = c.get('user')
      const req = c.req.valid('json')

      const shareLink = await shareService.getShareLink(shareId)
      await authzService.hasPermission({
        projectId: shareLink.projectId,
        user,
        permission: Permission.Edit,
      })

      // Also check if user has read permission on the source assets
      for (const assetId of req.assetIds) {
        await authzService.hasPermission({
          assetId,
          user,
          permission: Permission.Read,
        })
      }

      const addedCount = await shareService.addAssetToShare(shareId, req)
      return c.json({ addedCount })
    },
  )
  .delete('/teams/:teamId/shares/:shareId/assets/:assetId', async (c) => {
    const shareId = c.req.param('shareId')
    const assetId = c.req.param('assetId') // symlink asset id
    const user = c.get('user')

    const shareLink = await shareService.getShareLink(shareId)
    await authzService.hasPermission({
      projectId: shareLink.projectId,
      user,
      permission: Permission.Edit,
    })

    await shareService.removeAssetFromShare(shareId, assetId)
    return c.body(null, 204)
  })

export default route
