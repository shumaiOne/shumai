import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission } from '@/services/authz/authz'
import { skillService } from '@/services/skill/skill'
import { upsertSkillRequestSchema, updateSkillConfigRequestSchema } from '@/dtos/skill'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/skills', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    const skills = await skillService.listSkills(teamId)
    return c.json({ skills })
  })
  .post('/teams/:teamId/skills', zValidator('json', upsertSkillRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    try {
      const skill = await skillService.upsertSkill(teamId, req)
      return c.json(skill)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'ConflictError') {
        return c.json({ error: err.message }, 409)
      }
      throw err
    }
  })
  .delete('/teams/:teamId/skills/:id', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const id = c.req.param('id')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    await skillService.deleteSkill(id)
    return new Response(null, { status: 204 })
  })
  .patch(
    '/teams/:teamId/skills/:id/config',
    zValidator('json', updateSkillConfigRequestSchema),
    async (c) => {
      const user = c.get('user')
      const teamId = c.req.param('teamId')
      const id = c.req.param('id')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        teamId,
        user,
        permission: Permission.Admin,
      })

      const skill = await skillService.updateSkillConfig(id, req.config)
      return c.json(skill)
    },
  )

export default route
