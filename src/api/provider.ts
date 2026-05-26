import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import { providerService } from '@/services/provider/provider'
import { createProviderRequestSchema, updateProviderRequestSchema } from '@/dtos/provider'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/providers', async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const providers = await providerService.listByTeam(teamId)
    return c.json(providers)
  })

  .get('/providers/:id/models', async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id,
    })

    const provider = await providerService.getById(id)
    if (!provider) throw new Error('Provider not found')

    const models = await providerService.listModelsByProvider(provider.teamId, id)
    return c.json(models)
  })

  .post('/teams/:teamId/providers', zValidator('json', createProviderRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const { name, config, models } = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const provider = await providerService.create(teamId, name, config, models)
    return c.json(provider)
  })

  .put('/providers/:id', zValidator('json', updateProviderRequestSchema), async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    const { config, models } = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id,
    })

    const providerBefore = await providerService.getById(id)
    if (!providerBefore) throw new Error('Provider not found')

    const provider = await providerService.update(providerBefore.teamId, id, config, models)
    return c.json(provider)
  })

  .delete('/providers/:id', async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id,
    })

    const providerBefore = await providerService.getById(id)
    if (!providerBefore) throw new Error('Provider not found')

    await providerService.delete(providerBefore.teamId, id)
    return c.json({ success: true })
  })

export default route
