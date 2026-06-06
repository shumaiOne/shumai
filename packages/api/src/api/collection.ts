import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { collectionService } from '@shumai/core/src/collection/collection'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import {
  createCollectionRequestSchema,
  updateCollectionRequestSchema,
  listCollectionsRequestSchema,
  CollectionInfo,
  CollectionFilter,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

async function toCollectionInfo(
  c: Prisma.CollectionGetPayload<{ include: { creator: true } }>,
): Promise<CollectionInfo> {
  const avatarUrl = c.creator ? await getAvatarUrl(c.creator.image) : undefined
  return {
    id: c.id,
    name: c.name,
    filter: c.filter as unknown as CollectionFilter,
    projectId: c.projectId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    creator: c.creator ? { id: c.creator.id, name: c.creator.name, image: avatarUrl } : null,
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

      const collection = await collectionService.createCollection(projectId, req, user.id)
      return c.json(await toCollectionInfo(collection))
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
        data: await Promise.all(collections.data.map((c: any) => toCollectionInfo(c))),
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

    return c.json(await toCollectionInfo(collection))
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
      return c.json(await toCollectionInfo(collection))
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
