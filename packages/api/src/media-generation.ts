import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import {
  createEnabledMediaModelSchema,
  getCuratedMediaModelsQuerySchema,
  updateMediaProviderApiKeySchema,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/media-generation', async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const settings = await mediaGenerationService.getSettings(teamId)
    return c.json(settings)
  })

  .put(
    '/teams/:teamId/media-generation/providers/:provider',
    zValidator('json', updateMediaProviderApiKeySchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const provider = c.req.param('provider')
      const user = c.get('user')
      const body = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      await mediaGenerationService.updateProviderApiKey(teamId, provider, body.apiKey)
      return c.json({ success: true })
    },
  )

  .post(
    '/teams/:teamId/media-generation/models',
    zValidator('json', createEnabledMediaModelSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const user = c.get('user')
      const body = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Team,
        id: teamId,
      })

      const model = await mediaGenerationService.addEnabledModel(teamId, body)
      return c.json(model, 201)
    },
  )

  .get(
    '/teams/:teamId/media-generation/models/curated',
    zValidator('query', getCuratedMediaModelsQuerySchema),
    async (c) => {
      const { provider, type } = c.req.valid('query')
      const models = mediaGenerationService.getCuratedModels(provider, type)
      return c.json(models)
    },
  )

  .delete('/teams/:teamId/media-generation/models/:modelId', async (c) => {
    const teamId = c.req.param('teamId')
    const modelId = c.req.param('modelId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    await mediaGenerationService.removeEnabledModel(teamId, modelId)
    return c.json({ success: true })
  })

export default route
