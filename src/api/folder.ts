import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission } from '@/services/authz/authz'
import { assetService } from '@/services/asset/asset'
import { searchService } from '@/services/search/search'
import {
  createFolderRequestSchema,
  updateFolderRequestSchema,
  deleteFoldersRequestSchema,
  restoreFoldersRequestSchema,
} from '@/dtos/folder'
import { listChildrenRequestSchema, updateAssetOrderRequestSchema } from '@/dtos/asset'
import { searchRequestSchema } from '@/dtos/search'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/folders', zValidator('json', createFolderRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      assetId: req.parentId,
      user,
      permission: Permission.Edit,
    })

    const newAsset = await assetService.createAsset({
      name: req.name,
      parentId: req.parentId,
      type: 'folder',
    })

    return c.json(newAsset)
  })
  .patch(
    '/teams/:teamId/folders/:folderId/order',
    zValidator('json', updateAssetOrderRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        assetId: folderId,
        user,
        permission: Permission.Edit,
      })

      const updated = await assetService.updateAssetOrder(folderId, req)
      return c.json(updated)
    },
  )
  .put(
    '/teams/:teamId/folders/:folderId',
    zValidator('json', updateFolderRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        assetId: folderId,
        user,
        permission: Permission.Edit,
      })

      const updatedAsset = await assetService.updateAssetName({
        id: folderId,
        name: req.name,
      })

      return c.json(updatedAsset)
    },
  )
  .get('/teams/:teamId/folders/:folderId', async (c) => {
    const folderId = c.req.param('folderId')
    const user = c.get('user')

    await authzService.hasPermission({
      assetId: folderId,
      user,
      permission: Permission.Read,
    })

    const assetInfo = await assetService.getAsset({ assetId: folderId })
    return c.json(assetInfo)
  })
  .get(
    '/teams/:teamId/folders/:folderId/children',
    zValidator('query', listChildrenRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const user = c.get('user')
      const req = c.req.valid('query')

      await authzService.hasPermission({
        assetId: folderId,
        user,
        permission: Permission.Read,
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
    },
  )
  .delete('/teams/:teamId/folders', zValidator('json', deleteFoldersRequestSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('json')

    for (const id of req.ids) {
      await authzService.hasPermission({
        assetId: id,
        user,
        permission: Permission.Edit,
      })
    }

    await assetService.deleteAssets(req.ids)
    return c.body(null, 204)
  })
  .post(
    '/teams/:teamId/folders/restore',
    zValidator('json', restoreFoldersRequestSchema),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')

      for (const id of req.ids) {
        await authzService.hasPermission({
          assetId: id,
          user,
          permission: Permission.Edit,
        })
      }

      await assetService.restoreAssets(req.ids)
      return c.body(null, 204)
    },
  )
  .post(
    '/teams/:teamId/folders/:folderId/search',
    zValidator('json', searchRequestSchema),
    async (c) => {
      const folderId = c.req.param('folderId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        assetId: folderId,
        user,
        permission: Permission.Read,
      })

      const result = await searchService.search(folderId, req)
      return c.json(result)
    },
  )

export default route
