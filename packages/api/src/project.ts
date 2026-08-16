import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { projectService } from '@shumai/core/src/project/project'
import { assetService } from '@shumai/core/src/asset/asset'
import { reparentAssetsRequestSchema, copyAssetsRequestSchema } from '@shumai/dtos'
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  listProjectsRequestSchema,
  recentlyDeletedRequestSchema,
  updateProjectMemberRoleRequestSchema,
  addProjectMemberRequestSchema,
} from '@shumai/dtos'
import { listMembersQuerySchema, paginationParamsSchema, AuditAction } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/projects', zValidator('query', paginationParamsSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('query')
    const limit = req.first ? Math.min(req.first, 200) : 200

    const allProjects = await projectService.getUserProjects(user.id, limit)

    return c.json({
      data: allProjects.map((p) => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        rootFolder: p.rootFolder,
        enableNotification: p.enableNotification,
        updatedAt: p.updatedAt,
      })),
    })
  })
  .post('/teams/:teamId/projects', zValidator('json', createProjectRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Team,
      id: teamId,
    })

    const newProject = await projectService.createProject(user, {
      teamId,
      ...req,
    })

    await auditLogService.logAction({
      action: AuditAction.project_create,
      teamId,
      userId: user.id,
      projectId: newProject.id,
      itemId: newProject.id,
    })

    return c.json(newProject)
  })
  .put('/projects/:projectId', zValidator('json', updateProjectRequestSchema), async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Project,
      id: projectId,
    })

    const updatedProject = await projectService.updateProject({
      projectId,
      ...req,
    })

    if (updatedProject) {
      await auditLogService.logAction({
        action: AuditAction.project_update,
        teamId: updatedProject.teamId,
        userId: user.id,
        projectId,
        itemId: projectId,
      })
    }

    return c.json(updatedProject)
  })
  .get(
    '/projects/:projectId/recently-deleted',
    zValidator('query', recentlyDeletedRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('query')

      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Project,
        id: projectId,
      })

      const resp = await assetService.listChildren({
        projectId,
        assetType: req.assetType,
        showDeleted: true,
        after: req.after,
        first: req.first,
      })
      return c.json(resp)
    },
  )
  .post('/projects/:projectId/empty-trash', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Project,
      id: projectId,
    })

    await assetService.emptyTrash(projectId)

    const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
    if (teamId) {
      await auditLogService.logAction({
        action: AuditAction.project_empty_trash,
        teamId,
        userId: user.id,
        projectId,
        itemId: projectId,
      })
    }

    return c.json({ success: true })
  })
  .get('/teams/:teamId/projects', zValidator('query', listProjectsRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const req = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const res = await projectService.listProjects({
      teamId,
      userId: user.id,
      sortBy: req.sortBy,
      sortDirection: req.sortDirection,
      pagination: req,
    })

    return c.json({
      data: res.data,
      pageInfo: {
        total: res.pageInfo.total,
        cursor: res.pageInfo.cursor,
      },
    })
  })
  .get('/projects/:projectId', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    const p = await projectService.getProject(projectId)
    return c.json(p)
  })
  .delete('/projects/:projectId', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Project,
      id: projectId,
    })

    const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
    await projectService.deleteProject(projectId)

    if (teamId) {
      await auditLogService.logAction({
        action: AuditAction.project_delete,
        teamId,
        userId: user.id,
        projectId,
        itemId: projectId,
      })
    }

    return c.json({ success: true })
  })
  .get('/projects/:projectId/team', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    const teamId = await projectService.getProjectTeam(projectId)
    return c.json({ teamId })
  })
  .get('/projects/:projectId/members', zValidator('query', listMembersQuerySchema), async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')
    const { includeAgents } = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    const members = await projectService.listProjectMembers({
      projectId,
      includeAgents: includeAgents,
      requesterUserId: user.id,
    })
    return c.json(members)
  })
  .post(
    '/projects/:projectId/reparent',
    zValidator('json', reparentAssetsRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('json')

      // Check Edit permission on target folder/project
      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: req.newParentId,
      })

      // Check Edit permission on all source assets
      for (const assetId of req.assetIds) {
        await authzService.hasPermission({
          user,
          permission: Permission.Edit,
          type: ResourceType.Asset,
          id: assetId,
        })
      }

      await assetService.reparentAssets({
        ...req,
        creatorId: user.id,
      })

      const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
      if (teamId) {
        for (const assetId of req.assetIds) {
          await auditLogService.logAction({
            action: AuditAction.asset_reparent,
            teamId,
            userId: user.id,
            projectId,
            itemId: assetId,
          })
        }
      }

      return c.body(null, 204)
    },
  )
  .post('/projects/:projectId/copy', zValidator('json', copyAssetsRequestSchema), async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')
    const req = c.req.valid('json')

    // Check Edit permission on target folder/project
    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: req.newParentId,
    })

    // Check Read permission on all source assets
    for (const assetId of req.assetIds) {
      await authzService.hasPermission({
        user,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })
    }

    await assetService.copyAssets({
      ...req,
      creatorId: user.id,
    })

    const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
    if (teamId) {
      for (const assetId of req.assetIds) {
        await auditLogService.logAction({
          action: AuditAction.asset_copy,
          teamId,
          userId: user.id,
          projectId,
          itemId: assetId,
        })
      }
    }

    return c.body(null, 204)
  })
  .patch(
    '/projects/:projectId/members/:userId',
    zValidator('json', updateProjectMemberRoleRequestSchema),
    async (c) => {
      const user = c.get('user')
      const projectId = c.req.param('projectId')
      const userId = c.req.param('userId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Project,
        id: projectId,
      })

      await projectService.updateMemberRole({
        projectId,
        userId,
        role: req.role,
      })

      const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
      if (teamId) {
        await auditLogService.logAction({
          action: AuditAction.project_member_update,
          teamId,
          userId: user.id,
          projectId,
          itemId: userId,
        })
      }

      return c.json({ success: true })
    },
  )
  .delete('/projects/:projectId/members/:userId', async (c) => {
    const user = c.get('user')
    const projectId = c.req.param('projectId')
    const userId = c.req.param('userId')

    await authzService.hasPermission({
      user,
      permission: Permission.Admin,
      type: ResourceType.Project,
      id: projectId,
    })

    const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
    await projectService.removeMember(projectId, userId)

    if (teamId) {
      await auditLogService.logAction({
        action: AuditAction.project_member_remove,
        teamId,
        userId: user.id,
        projectId,
        itemId: userId,
      })
    }

    return c.json({ success: true })
  })
  .post(
    '/projects/:projectId/members',
    zValidator('json', addProjectMemberRequestSchema),
    async (c) => {
      const user = c.get('user')
      const projectId = c.req.param('projectId')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Admin,
        type: ResourceType.Project,
        id: projectId,
      })

      await projectService.addProjectMember({
        projectId,
        userId: req.userId,
        role: req.role,
      })

      const teamId = await projectService.getProjectTeam(projectId).catch(() => null)
      if (teamId) {
        await auditLogService.logAction({
          action: AuditAction.project_member_add,
          teamId,
          userId: user.id,
          projectId,
          itemId: req.userId,
        })
      }

      return c.json({ success: true })
    },
  )
  .get('/projects/:projectId/me', async (c) => {
    const user = c.get('user')
    const projectId = c.req.param('projectId')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    const me = await projectService.getProjectMe(projectId, user.id)
    return c.json(me)
  })

export default route
