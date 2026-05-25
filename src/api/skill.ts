import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import { skillService } from '@/services/skill/skill'
import { upsertSkillRequestSchema, updateSkillConfigRequestSchema } from '@/dtos/skill'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/skills', async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const skills = await skillService.listSkills(teamId)
    return c.json({ skills })
  })
  .post('/teams/:teamId/skills', zValidator('json', upsertSkillRequestSchema), async (c) => {
    const user = c.get('user')
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
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
  .delete('/skills/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Skill,
      id,
    })

    await skillService.deleteSkill(id)
    return new Response(null, { status: 204 })
  })
  .patch('/skills/:id/config', zValidator('json', updateSkillConfigRequestSchema), async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Skill,
      id,
    })

    const skill = await skillService.updateSkillConfig(id, req.config)
    return c.json(skill)
  })

export default route
