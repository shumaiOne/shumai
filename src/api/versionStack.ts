import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { versionStackService } from '@/services/versionStack/versionStack'
import { assetService } from '@/services/asset/asset'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import {
  createVersionStackRequestSchema,
  changeStackFileVersionRequestSchema,
} from '@/dtos/versionStack'
import type { Prisma } from '@/generated/prisma/client'

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

export default route
