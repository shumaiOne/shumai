import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { assetService } from '@shumai/core/src/asset/asset'
import { searchService } from '@shumai/core/src/search/search'
import {
  createFolderRequestSchema,
  updateFolderRequestSchema,
  deleteFoldersRequestSchema,
  restoreFoldersRequestSchema,
  updateAgentsMdRequestSchema,
} from '@shumai/dtos'
import { listChildrenRequestSchema, updateAssetOrderRequestSchema, AuditAction } from '@shumai/dtos'
import { searchRequestSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import {
  createFolderOp,
  getFolderInstructionsOp,
  renameAssetOp,
  runOperation,
} from '@shumai/core/src/operations'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/folders', zValidator('json', createFolderRequestSchema), async (c) => {
    const req = c.req.valid('json')
    const folder = await runOperation(
      createFolderOp,
      { userId: c.get('user').id, via: 'api' },
      { parent: req.parentId, name: req.name },
    )
    return c.json(folder)
  })
  .patch(
    '/folders/:folderId/order',
    zValidator('json', updateAssetOrderRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: folderId,
      })

      const updated = await assetService.updateAssetOrder(folderId, req)
      return c.json(updated)
    },
  )
  .put('/folders/:folderId', zValidator('json', updateFolderRequestSchema), async (c) => {
    const req = c.req.valid('json')
    const folder = await runOperation(
      renameAssetOp,
      { userId: c.get('user').id, via: 'api' },
      { assetId: c.req.param('folderId'), name: req.name },
    )
    return c.json(folder)
  })
  .get('/folders/:folderId', async (c) => {
    const folderId = c.req.param('folderId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: folderId,
    })

    const assetInfo = await assetService.getAsset({ assetId: folderId })
    return c.json(assetInfo)
  })
  .get('/folders/:folderId/children', zValidator('query', listChildrenRequestSchema), async (c) => {
    const folderId = c.req.param('folderId')
    const user = c.get('user')
    const req = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: folderId,
    })

    const resp = await assetService.listChildren({
      ...req,
      assetId: folderId,
    })
    return c.json(resp)
  })
  .delete('/folders', zValidator('json', deleteFoldersRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    for (const id of req.ids) {
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id,
      })
    }

    const contexts = await Promise.all(req.ids.map((id) => assetService.getAssetContext(id)))

    await assetService.deleteAssets(req.ids)

    for (let i = 0; i < req.ids.length; i++) {
      const ctx = contexts[i]
      await auditLogService.logAction({
        action: AuditAction.folder_delete,
        teamId: ctx.teamId,
        userId: user.id,
        projectId: ctx.projectId,
        itemId: req.ids[i],
      })
    }

    return c.body(null, 204)
  })
  .post('/folders/restore', zValidator('json', restoreFoldersRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    for (const id of req.ids) {
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id,
      })
    }

    await assetService.restoreAssets(req.ids)
    return c.body(null, 204)
  })
  .post('/folders/:folderId/search', zValidator('json', searchRequestSchema), async (c) => {
    const folderId = c.req.param('folderId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: folderId,
    })

    const result = await searchService.search(folderId, req)
    return c.json(result)
  })
  .get('/folders/:folderId/agentsmd', async (c) => {
    const { content } = await runOperation(
      getFolderInstructionsOp,
      { userId: c.get('user').id, via: 'api' },
      { folderId: c.req.param('folderId') },
    )
    return c.json({ content })
  })
  .patch(
    '/folders/:folderId/agentsmd',
    zValidator('json', updateAgentsMdRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Asset,
        id: folderId,
      })

      const res = await assetService.updateAgentsMd(folderId, req.content)

      const ctx = await assetService.getAssetContext(folderId)
      await auditLogService.logAction({
        action: AuditAction.folder_update,
        teamId: ctx.teamId,
        userId: user.id,
        projectId: ctx.projectId,
        itemId: folderId,
      })

      return c.json(res)
    },
  )

export default route
