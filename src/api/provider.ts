import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { authzService, Permission } from '@/services/authz/authz'
import { providerService } from '@/services/provider/provider'
import { createProviderRequestSchema, updateProviderRequestSchema } from '@/dtos/provider'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/providers', async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    const providers = await providerService.listByTeam(teamId)
    return c.json(providers)
  })

  .get('/teams/:teamId/providers/:id/models', async (c) => {
    const teamId = c.req.param('teamId')
    const id = c.req.param('id')
    const user = c.get('user')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    const models = await providerService.listModelsByProvider(teamId, id)
    return c.json(models)
  })

  .post('/teams/:teamId/providers', zValidator('json', createProviderRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const { name, config, models } = c.req.valid('json')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    const provider = await providerService.create(teamId, name, config, models)
    return c.json(provider)
  })

  .put(
    '/teams/:teamId/providers/:id',
    zValidator('json', updateProviderRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const id = c.req.param('id')
      const user = c.get('user')
      const { config, models } = c.req.valid('json')

      await authzService.hasPermission({
        teamId,
        user,
        permission: Permission.Admin,
      })

      const provider = await providerService.update(teamId, id, config, models)
      return c.json(provider)
    },
  )

  .delete('/teams/:teamId/providers/:id', async (c) => {
    const teamId = c.req.param('teamId')
    const id = c.req.param('id')
    const user = c.get('user')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    await providerService.delete(teamId, id)
    return c.json({ success: true })
  })

export default route
