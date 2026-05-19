import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { versionStackService } from '@/services/versionStack/versionStack'
import { assetService } from '@/services/asset/asset'
import { authzService, Permission } from '@/services/authz/authz'
import {
  createVersionStackRequestSchema,
  changeStackFileVersionRequestSchema,
} from '@/dtos/versionStack'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const app = new Hono<{ Variables: { user: User } }>()

const route = app
  .post(
    '/projects/:projectID/version_stacks',
    zValidator('json', createVersionStackRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectID')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Edit,
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
    '/projects/:projectID/version_stacks/:stackID/order',
    zValidator('json', changeStackFileVersionRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectID')
      const stackId = c.req.param('stackID')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Edit,
      })

      await versionStackService.changeStackFileVersion({
        stackId,
        fileId: req.fileId,
        beforeId: req.beforeId,
      })

      return new Response(null, { status: 200 })
    },
  )

export default route
