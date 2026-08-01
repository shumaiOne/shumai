import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { skillService } from '@shumai/core/src/skill/skill'
import {
  upsertSkillRequestSchema,
  updateSkillConfigRequestSchema,
  updateSkillPermissionRequestSchema,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

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
      await auditLogService.logAction({
        action: AuditAction.skill_create,
        teamId,
        userId: user?.id,
        itemId: skill.id,
      })
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

    const existingSkill = await skillService.getSkill(id)

    await skillService.deleteSkill(id)

    if (existingSkill) {
      await auditLogService.logAction({
        action: AuditAction.skill_delete,
        teamId: existingSkill.teamId,
        userId: user?.id,
        itemId: id,
      })
    }

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

    const existingSkill = await skillService.getSkill(id)

    const skill = await skillService.updateSkillConfig(id, req.config)

    if (existingSkill) {
      await auditLogService.logAction({
        action: AuditAction.skill_update,
        teamId: existingSkill.teamId,
        userId: user?.id,
        itemId: id,
      })
    }

    return c.json(skill)
  })
  .patch(
    '/skills/:id/permission',
    zValidator('json', updateSkillPermissionRequestSchema),
    async (c) => {
      const user = c.get('user')
      const id = c.req.param('id')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Skill,
        id,
      })

      const existingSkill = await skillService.getSkill(id)

      const skill = await skillService.updateSkillPermission(id, req.permission)

      if (existingSkill) {
        await auditLogService.logAction({
          action: AuditAction.skill_update,
          teamId: existingSkill.teamId,
          userId: user?.id,
          itemId: id,
        })
      }

      return c.json(skill)
    },
  )

export default route
