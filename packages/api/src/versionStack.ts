import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { createVersionStackOp, removeVersionOp, runOperation } from '@shumai/core/src/operations'
import { createVersionStackRequestSchema, changeStackFileVersionRequestSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const app = new Hono<{ Variables: { user: User } }>()

const route = app
  .post(
    '/projects/:projectId/version_stacks',
    zValidator('json', createVersionStackRequestSchema),
    async (c) => {
      const req = c.req.valid('json')
      // Authorization and the stack's project come from the files, not the path.
      const stack = await runOperation(
        createVersionStackOp,
        { userId: c.get('user').id, via: 'api' },
        { fileIds: req.fileIds },
      )
      return c.json(await assetService.getAsset({ assetId: stack.id }))
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
    // The stack is the version's parent; the path's stackId is not needed.
    await runOperation(
      removeVersionOp,
      { userId: c.get('user').id, via: 'api' },
      { versionId: c.req.param('versionId') },
    )
    return new Response(null, { status: 200 })
  })

export default route
