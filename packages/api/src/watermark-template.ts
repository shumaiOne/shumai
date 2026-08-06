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

    let teamIds: string[]
    if (teamId) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Team,
        id: teamId,
      })
      teamIds = [teamId]
    } else {
      // No teamId: scope to the caller's own teams so templates are never
      // leaked across tenants.
      const userTeams = await teamService.getUserTeams({
        userId: user.id,
        pagination: { first: 20 },
      })
      teamIds = userTeams.data.map((t) => t.id)
    }

    const templates = await watermarkService.listTemplates(teamIds)
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
    // Teamless templates are shared platform defaults: readable by any
    // authenticated user, but not writable (enforced on PUT/DELETE).

    return c.json(template)
  })
  .post(
    '/watermark-templates',
    zValidator('json', createWatermarkTemplateRequestSchema),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')

      let teamId: string | null
      if (req.teamId) {
        await authzService.hasPermission({
          user,
          permission: Permission.Edit,
          type: ResourceType.Team,
          id: req.teamId,
        })
        teamId = req.teamId
      } else {
        const userTeams = await teamService.getUserTeams({
          userId: user.id,
          pagination: { first: 20 },
        })
        teamId = userTeams.data[0]?.id || null
        if (!teamId) {
          return c.json({ error: 'A team is required to create a watermark template' }, 400)
        }
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
      } else {
        return c.json({ error: 'Platform templates are read-only' }, 403)
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
    } else {
      return c.json({ error: 'Platform templates are read-only' }, 403)
    }

    await watermarkService.deleteTemplate(templateId)
    return c.body(null, 204)
  })

export default route
