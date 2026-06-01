import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { collectionService } from '@/services/collection/collection'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import {
  createCollectionRequestSchema,
  updateCollectionRequestSchema,
  listCollectionsRequestSchema,
  CollectionInfo,
  CollectionFilter,
} from '@shumai/dtos'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

function toCollectionInfo(c: Prisma.CollectionGetPayload<Record<string, never>>): CollectionInfo {
  return {
    id: c.id,
    name: c.name,
    filter: c.filter as unknown as CollectionFilter,
    projectId: c.projectId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

const route = new Hono<{ Variables: { user: User } }>()
  .post(
    '/projects/:projectId/collections',
    zValidator('json', createCollectionRequestSchema),
    async (c) => {
      const { projectId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Project,
        id: projectId,
      })

      const collection = await collectionService.createCollection(projectId, req)
      return c.json(toCollectionInfo(collection))
    },
  )
  .get(
    '/projects/:projectId/collections',
    zValidator('query', listCollectionsRequestSchema),
    async (c) => {
      const { projectId } = c.req.param()
      const req = c.req.valid('query')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Project,
        id: projectId,
      })

      const collections = await collectionService.listCollections(projectId, req)
      return c.json({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: collections.data.map((c: any) => toCollectionInfo(c)),
        pageInfo: collections.pageInfo,
      })
    },
  )
  .get('/collections/:collectionId', async (c) => {
    const { collectionId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Collection,
      id: collectionId,
    })

    const collection = await collectionService.getCollection(collectionId)
    if (!collection) {
      return c.json({ error: 'Collection not found' }, 404)
    }

    return c.json(toCollectionInfo(collection))
  })
  .patch(
    '/collections/:collectionId',
    zValidator('json', updateCollectionRequestSchema),
    async (c) => {
      const { collectionId } = c.req.param()
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Collection,
        id: collectionId,
      })

      const collection = await collectionService.updateCollection(collectionId, req)
      return c.json(toCollectionInfo(collection))
    },
  )
  .delete('/collections/:collectionId', async (c) => {
    const { collectionId } = c.req.param()
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Collection,
      id: collectionId,
    })

    await collectionService.deleteCollection(collectionId)
    return c.json({ success: true })
  })

export default route
