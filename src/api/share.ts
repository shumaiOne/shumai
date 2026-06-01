import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { shareService } from '@shumai/core/src/share/share'
import {
  createShareLinkRequestSchema,
  updateShareLinkRequestSchema,
  listShareLinksRequestSchema,
  addAssetToShareRequestSchema,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post(
    '/projects/:projectId/shares',
    zValidator('json', createShareLinkRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Project,
        id: projectId,
      })

      const shareLink = await shareService.createShareLink(projectId, req)
      return c.json(shareLink)
    },
  )
  .get(
    '/projects/:projectId/shares',
    zValidator('query', listShareLinksRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('query')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Project,
        id: projectId,
      })

      const res = await shareService.listProjectShareLinks({
        ...req,
        projectId,
      })

      return c.json(res)
    },
  )
  .get('/shares/:shareId', async (c) => {
    const shareId = c.req.param('shareId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Share,
      id: shareId,
    })

    const shareLink = await shareService.getShareLink(shareId)
    return c.json(shareLink)
  })
  .put('/shares/:shareId', zValidator('json', updateShareLinkRequestSchema), async (c) => {
    const shareId = c.req.param('shareId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Share,
      id: shareId,
    })

    const updated = await shareService.updateShareLink(shareId, req)
    return c.json(updated)
  })
  .delete('/shares/:shareId', async (c) => {
    const shareId = c.req.param('shareId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Share,
      id: shareId,
    })

    await shareService.deleteShareLink(shareId)
    return c.body(null, 204)
  })
  .post('/shares/:shareId/assets', zValidator('json', addAssetToShareRequestSchema), async (c) => {
    const shareId = c.req.param('shareId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Share,
      id: shareId,
    })

    // Also check if user has read permission on the source assets
    for (const assetId of req.assetIds) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })
    }

    const addedCount = await shareService.addAssetToShare(shareId, req)
    return c.json({ addedCount })
  })
  .delete('/shares/:shareId/assets/:assetId', async (c) => {
    const shareId = c.req.param('shareId')
    const assetId = c.req.param('assetId') // symlink asset id
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Share,
      id: shareId,
    })

    await shareService.removeAssetFromShare(shareId, assetId)
    return c.body(null, 204)
  })

export default route
