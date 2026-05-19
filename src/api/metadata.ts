import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { Hono } from 'hono'
import { metadataService } from '@/services/metadata/metadata'
import { authzService, Permission } from '@/services/authz/authz'
import {
  createFieldRequestSchema,
  updateFieldRequestSchema,
  updateProjectFieldsOrderRequestSchema,
  updateAssetMetadataRequestSchema,
  FieldInfo,
} from '@/dtos/metadata'
import type { Prisma } from '@/generated/prisma/client'

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
    aiAutofill: f.aiAutofill,
  }
}

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/fields', zValidator('json', createFieldRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    const field = await metadataService.createTeamField(teamId, req)
    return c.json(toFieldInfo(field))
  })
  .get('/teams/:teamId/fields', async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
    })

    const fields = await metadataService.listTeamFields(teamId)
    return c.json(fields.map((f) => toFieldInfo(f)))
  })
  .put(
    '/teams/:teamId/fields/:fieldId',
    zValidator('json', updateFieldRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const fieldId = c.req.param('fieldId')
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        teamId,
        user,
        permission: Permission.Admin,
      })

      const field = await metadataService.updateTeamField(teamId, fieldId, req)
      return c.json(toFieldInfo(field))
    },
  )
  .delete('/teams/:teamId/fields/:fieldId', async (c) => {
    const teamId = c.req.param('teamId')
    const fieldId = c.req.param('fieldId')
    const user = c.get('user')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Admin,
    })

    await metadataService.deleteTeamField(teamId, fieldId)
    return new Response(null, { status: 204 })
  })
  .post('/projects/:projectId/fields', zValidator('json', createFieldRequestSchema), async (c) => {
    const projectId = c.req.param('projectId')
    const req = c.req.valid('json')
    const user = c.get('user')

    await authzService.hasPermission({
      projectId,
      user,
      permission: Permission.Admin,
    })

    const field = await metadataService.createProjectField(projectId, req)
    return c.json(toFieldInfo(field))
  })
  .get('/projects/:projectId/fields', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      projectId,
      user,
      permission: Permission.Read,
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
        projectId,
        user,
        permission: Permission.Admin,
      })

      await metadataService.updateProjectFieldsOrder(user.id, projectId, req)
      return new Response(null, { status: 204 })
    },
  )
  .put(
    '/projects/:projectId/fields/:fieldId',
    zValidator('json', updateFieldRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const fieldId = c.req.param('fieldId')
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Admin,
      })

      const field = await metadataService.updateProjectField(projectId, fieldId, req)
      return c.json(toFieldInfo(field))
    },
  )
  .delete('/projects/:projectId/fields/:fieldId', async (c) => {
    const projectId = c.req.param('projectId')
    const fieldId = c.req.param('fieldId')
    const user = c.get('user')

    await authzService.hasPermission({
      projectId,
      user,
      permission: Permission.Admin,
    })

    await metadataService.deleteProjectField(projectId, fieldId)
    return new Response(null, { status: 204 })
  })

  .patch(
    '/teams/:teamId/files/:fileId/metadata',
    zValidator('json', z.array(updateAssetMetadataRequestSchema)),
    async (c) => {
      const teamId = c.req.param('teamId')
      const fileId = c.req.param('fileId') // Actually maps to assetId
      const req = c.req.valid('json')
      const user = c.get('user')

      await authzService.hasPermission({
        teamId,
        assetId: fileId,
        user,
        permission: Permission.Edit,
      })

      await metadataService.updateAssetMetadata(fileId, req)
      return new Response(null, { status: 204 })
    },
  )

export default route
