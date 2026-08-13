import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { projectService } from '@shumai/core/src/project/project'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import {
  createFieldRequestSchema,
  updateFieldRequestSchema,
  updateProjectFieldsOrderRequestSchema,
  FieldInfo,
  AuditAction,
} from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

type User = Prisma.UserGetPayload<Record<string, never>>

function toFieldInfo(
  f: Prisma.MetadataFieldGetPayload<Record<string, never>>,
  visible = false,
): FieldInfo {
  return {
    id: f.key,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: f.config as any,
    scope: f.scope ?? '',
    readOnly: f.readOnly,
    visible: visible,
    description: f.description,
  }
}

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/fields', zValidator('json', createFieldRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Team,
      id: teamId,
    })

    const field = await metadataService.createTeamField(teamId, req)

    await auditLogService.logAction({
      action: AuditAction.metadata_field_create,
      teamId,
      userId: user.id,
      itemId: field.key,
    })

    return c.json(toFieldInfo(field))
  })
  .get('/teams/:teamId/fields', async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const fields = await metadataService.listTeamFields(teamId)
    return c.json(fields.map((f) => toFieldInfo(f)))
  })
  .put('/fields/:fieldId', zValidator('json', updateFieldRequestSchema), async (c) => {
    const fieldId = c.req.param('fieldId')
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.MetadataField,
      id: fieldId,
    })

    // We need teamId/projectId for metadataService. But we can get them from the field itself.
    // Or we can refactor metadataService to not require them if we already have the field.
    // For now, let's just fetch it once to get the context for the service call.
    const field = await metadataService.getFieldByKey(fieldId)
    if (!field) throw new Error('Field not found')

    let updated
    if (field.projectId) {
      updated = await metadataService.updateProjectField(field.projectId, fieldId, req)
    } else if (field.teamId) {
      updated = await metadataService.updateTeamField(field.teamId, fieldId, req)
    } else {
      throw new Error('Field has no context')
    }

    let teamId = field.teamId
    if (field.projectId && !teamId) {
      teamId = await projectService.getProjectTeam(field.projectId).catch(() => null)
    }

    if (teamId) {
      await auditLogService.logAction({
        action: AuditAction.metadata_field_update,
        teamId,
        userId: user.id,
        projectId: field.projectId || undefined,
        itemId: fieldId,
      })
    }

    return c.json(toFieldInfo(updated))
  })
  .delete('/fields/:fieldId', async (c) => {
    const fieldId = c.req.param('fieldId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.MetadataField,
      id: fieldId,
    })

    const field = await metadataService.getFieldByKey(fieldId)
    if (!field) throw new Error('Field not found')

    if (field.projectId) {
      await metadataService.deleteProjectField(field.projectId, fieldId)
    } else if (field.teamId) {
      await metadataService.deleteTeamField(field.teamId, fieldId)
    } else {
      throw new Error('Field has no context')
    }

    let teamId = field.teamId
    if (field.projectId && !teamId) {
      teamId = await projectService.getProjectTeam(field.projectId).catch(() => null)
    }

    if (teamId) {
      await auditLogService.logAction({
        action: AuditAction.metadata_field_delete,
        teamId,
        userId: user.id,
        projectId: field.projectId || undefined,
        itemId: fieldId,
      })
    }

    return new Response(null, { status: 204 })
  })
  .post('/projects/:projectId/fields', zValidator('json', createFieldRequestSchema), async (c) => {
    const projectId = c.req.param('projectId')
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Project,
      id: projectId,
    })

    const field = await metadataService.createProjectField(projectId, req)

    const teamId = await projectService.getProjectTeam(projectId).catch(() => null)

    if (teamId) {
      await auditLogService.logAction({
        action: AuditAction.metadata_field_create,
        teamId,
        userId: user.id,
        projectId,
        itemId: field.key,
      })
    }

    return c.json(toFieldInfo(field))
  })
  .get('/projects/:projectId/fields', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    const fields = await metadataService.listProjectFields(user.id, projectId)
    return c.json(fields.map((f) => toFieldInfo(f.field, f.visible)))
  })
  .patch(
    '/projects/:projectId/fields/order',
    zValidator('json', updateProjectFieldsOrderRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Project,
        id: projectId,
      })

      await metadataService.updateProjectFieldsOrder(user.id, projectId, req)
      return new Response(null, { status: 204 })
    },
  )

export default route
