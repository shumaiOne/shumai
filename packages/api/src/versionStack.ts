import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { createVersionStackRequestSchema, changeStackFileVersionRequestSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const app = new Hono<{ Variables: { user: User } }>()

const route = app
  .post(
    '/projects/:projectId/version_stacks',
    zValidator('json', createVersionStackRequestSchema),
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

      const stack = await versionStackService.createVersionStack({
        fileIds: req.fileIds,
        projectId,
        creatorId: user.id,
      })

      const stackInfo = await assetService.getAsset({ assetId: stack.id })

      return c.json(stackInfo)
    },
  )
  .post(
    '/version_stacks/:stackId/order',
    zValidator('json', changeStackFileVersionRequestSchema),
    async (c) => {
      const stackId = c.req.param('stackId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: stackId,
      })

      await versionStackService.changeStackFileVersion({
        stackId,
        fileId: req.fileId,
        beforeId: req.beforeId,
      })

      return new Response(null, { status: 200 })
    },
  )
  .get('/version_stacks/:stackId/versions', async (c) => {
    const stackId = c.req.param('stackId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Asset,
      id: stackId,
    })

    const versions = await assetService.getStackVersions(stackId)
    return c.json(versions)
  })
  .delete('/version_stacks/:stackId/versions/:versionId', async (c) => {
    const stackId = c.req.param('stackId')
    const versionId = c.req.param('versionId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: stackId,
    })

    await versionStackService.removeVersionFromStack({
      stackId,
      fileId: versionId,
    })

    return new Response(null, { status: 200 })
  })

export default route
