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
} from '@shumai/dtos'
import { listChildrenRequestSchema, updateAssetOrderRequestSchema } from '@shumai/dtos'
import { searchRequestSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/folders', zValidator('json', createFolderRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: req.parentId,
    })

    const newAsset = await assetService.createAsset({
      name: req.name,
      parentId: req.parentId,
      type: 'folder',
    })

    return c.json(newAsset)
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
    const folderId = c.req.param('folderId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: folderId,
    })

    const updatedAsset = await assetService.updateAssetName({
      id: folderId,
      name: req.name,
    })

    return c.json(updatedAsset)
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
      assetId: folderId,
      assetType: req.assetType,
      projectId: req.projectId,
      showDeleted: req.showDeleted,
      sort: req.sort,
      order: req.order,
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

    await assetService.deleteAssets(req.ids)
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

export default route
