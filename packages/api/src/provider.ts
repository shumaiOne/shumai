import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { providerService } from '@shumai/core/src/provider/provider'
import {
  createModelRequestSchema,
  createProviderRequestSchema,
  updateModelRequestSchema,
  updateProviderRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

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
    await auditLogService.logAction({
      action: AuditAction.provider_create,
      teamId,
      userId: user?.id,
      itemId: provider.id,
    })
    return c.json(provider)
  })

  .put('/providers/:id', zValidator('json', updateProviderRequestSchema), async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    const { name, config, models } = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id,
    })

    const providerBefore = await providerService.getById(id)
    if (!providerBefore) throw new Error('Provider not found')

    const provider = await providerService.update(providerBefore.teamId, id, config, models, name)
    await auditLogService.logAction({
      action: AuditAction.provider_update,
      teamId: providerBefore.teamId,
      userId: user?.id,
      itemId: id,
    })
    return c.json(provider)
  })

  .post('/providers/:id/models', zValidator('json', createModelRequestSchema), async (c) => {
    const id = c.req.param('id')
    const user = c.get('user')
    const data = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id,
    })

    const provider = await providerService.getById(id)
    if (!provider) throw new Error('Provider not found')

    const model = await providerService.createModel(provider.teamId, id, data)
    await auditLogService.logAction({
      action: AuditAction.provider_update,
      teamId: provider.teamId,
      userId: user?.id,
      itemId: id,
    })
    return c.json(model, 201)
  })

  .put(
    '/providers/:id/models/:modelDbId',
    zValidator('json', updateModelRequestSchema),
    async (c) => {
      const id = c.req.param('id')
      const modelDbId = c.req.param('modelDbId')
      const user = c.get('user')
      const data = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Provider,
        id,
      })

      const provider = await providerService.getById(id)
      if (!provider) throw new Error('Provider not found')

      const model = await providerService.updateModel(provider.teamId, id, modelDbId, data)
      await auditLogService.logAction({
        action: AuditAction.provider_update,
        teamId: provider.teamId,
        userId: user?.id,
        itemId: id,
      })
      return c.json(model)
    },
  )

  .delete('/providers/:id/models/:modelDbId', async (c) => {
    const id = c.req.param('id')
    const modelDbId = c.req.param('modelDbId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Provider,
      id,
    })

    const providerBefore = await providerService.getById(id)
    if (!providerBefore) throw new Error('Provider not found')

    await providerService.deleteModel(providerBefore.teamId, id, modelDbId)
    await auditLogService.logAction({
      action: AuditAction.provider_update,
      teamId: providerBefore.teamId,
      userId: user?.id,
      itemId: id,
    })
    return c.json({ success: true })
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
    await auditLogService.logAction({
      action: AuditAction.provider_delete,
      teamId: providerBefore.teamId,
      userId: user?.id,
      itemId: id,
    })
    return c.json({ success: true })
  })

export default route
