import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { shareService } from '@shumai/core/src/share/share'
import { projectService } from '@shumai/core/src/project/project'
import {
  createShareLinkRequestSchema,
  updateShareLinkRequestSchema,
  listShareLinksRequestSchema,
  addAssetToShareRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

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

      const shareLink = await shareService.createShareLink(projectId, req, user.id)

      const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
      if (teamId) {
        await auditLogService.logAction({
          action: AuditAction.share_create,
          teamId,
          userId: user.id,
          projectId,
          itemId: shareLink.id,
        })
      }

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

    const existingShare = await shareService.getShareLink(shareId)
    const updated = await shareService.updateShareLink(shareId, req)

    if (existingShare) {
      const teamId = await projectService.getProjectTeam(existingShare.projectId).catch(() => null)
      if (teamId) {
        await auditLogService.logAction({
          action: AuditAction.share_update,
          teamId,
          userId: user.id,
          projectId: existingShare.projectId,
          itemId: shareId,
        })
      }
    }

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

    const existingShare = await shareService.getShareLink(shareId)
    await shareService.deleteShareLink(shareId)

    if (existingShare) {
      const teamId = await projectService.getProjectTeam(existingShare.projectId).catch(() => null)
      if (teamId) {
        await auditLogService.logAction({
          action: AuditAction.share_delete,
          teamId,
          userId: user.id,
          projectId: existingShare.projectId,
          itemId: shareId,
        })
      }
    }

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
