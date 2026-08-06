import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { teamService } from '@shumai/core/src/team/team'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import {
  createWatermarkTemplateRequestSchema,
  updateWatermarkTemplateRequestSchema,
} from '@shumai/dtos'
import { z } from 'zod'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const listTemplatesQuerySchema = z.object({
  teamId: z.string().optional(),
})

const route = new Hono<{ Variables: { user: User } }>()
  .get('/watermark-templates', zValidator('query', listTemplatesQuerySchema), async (c) => {
    const user = c.get('user')
    const { teamId } = c.req.valid('query')

    if (teamId) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })
    }

    const templates = await watermarkService.listTemplates(teamId)
    return c.json(templates)
  })
  .get('/watermark-templates/:templateId', async (c) => {
    const templateId = c.req.param('templateId')
    const template = await watermarkService.getTemplate(templateId)

    if (template.teamId) {
      const user = c.get('user')
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: template.teamId,
      })
    }

    return c.json(template)
  })
  .post(
    '/watermark-templates',
    zValidator('json', createWatermarkTemplateRequestSchema),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')

      const userTeams = await teamService.getUserTeams({
        userId: user.id,
        pagination: { first: 20 },
      })
      const teamId = userTeams.data[0]?.id || null

      if (teamId) {
        await authzService.hasPermission({
          user,
          permission: Permission.Edit,
          type: ResourceType.Team,
          id: teamId,
        })
      }

      const template = await watermarkService.createTemplate(teamId, req.name, req.config)
      return c.json(template, 201)
    },
  )
  .put(
    '/watermark-templates/:templateId',
    zValidator('json', updateWatermarkTemplateRequestSchema),
    async (c) => {
      const templateId = c.req.param('templateId')
      const user = c.get('user')
      const req = c.req.valid('json')

      const existing = await watermarkService.getTemplate(templateId)
      if (existing.teamId) {
        await authzService.hasPermission({
          user,
          permission: Permission.Edit,
          type: ResourceType.Team,
          id: existing.teamId,
        })
      }

      const updated = await watermarkService.updateTemplate(templateId, req.name, req.config)
      return c.json(updated)
    },
  )
  .delete('/watermark-templates/:templateId', async (c) => {
    const templateId = c.req.param('templateId')
    const user = c.get('user')

    const existing = await watermarkService.getTemplate(templateId)
    if (existing.teamId) {
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Team,
        id: existing.teamId,
      })
    }

    await watermarkService.deleteTemplate(templateId)
    return c.body(null, 204)
  })

export default route
