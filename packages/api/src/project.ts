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
import { listMembersQuerySchema, paginationParamsSchema } from '@shumai/dtos'
import type { Prisma } from '@shumai/db'
import { prisma, AuditAction } from '@shumai/db'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .get('/projects', zValidator('query', paginationParamsSchema), async (c) => {
    const user = c.get('user')
    const req = c.req.valid('query')
    const limit = req.first ? Math.min(req.first, 200) : 200

    const teamMembers = await prisma.teamMember.findMany({
      where: { userId: user.id },
    })

    type ProjectType = Prisma.ProjectGetPayload<Record<string, never>>
    const allProjects: ProjectType[] = []

    for (const member of teamMembers) {
      const where: Prisma.ProjectWhereInput = {
        teamId: member.teamId,
      }
      if (member.scope === 'project') {
        where.members = {
          some: { teamMemberId: member.id },
        }
      }
      const teamProjects = await prisma.project.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit - allProjects.length,
      })
      allProjects.push(...teamProjects)
      if (allProjects.length >= limit) {
        break
      }
    }

    return c.json({
      data: allProjects.map((p) => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        rootFolder: p.rootFolderId || undefined,
        enableNotification: p.enableNotification,
        updatedAt: p.updatedAt.toISOString(),
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

    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    if (proj) {
      await auditLogService.logAction({
        action: AuditAction.project_update,
        teamId: proj.teamId,
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

    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    if (proj) {
      await auditLogService.logAction({
        action: AuditAction.project_empty_trash,
        teamId: proj.teamId,
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

    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    await projectService.deleteProject(projectId)

    if (proj) {
      await auditLogService.logAction({
        action: AuditAction.project_delete,
        teamId: proj.teamId,
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
    })
    return c.json(members)
  })
  .get('/projects/:projectId/bots', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Project,
      id: projectId,
    })

    // STUB: AgentService is not migrated yet.
    return c.json([])
  })

  .post(
    '/projects/:projectId/reparent',
    zValidator('json', reparentAssetsRequestSchema),
    async (c) => {
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

      return c.body(null, 204)
    },
  )
  .post('/projects/:projectId/copy', zValidator('json', copyAssetsRequestSchema), async (c) => {
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

      const proj = await prisma.project.findUnique({
        where: { id: projectId },
        select: { teamId: true },
      })
      if (proj) {
        await auditLogService.logAction({
          action: AuditAction.project_member_update,
          teamId: proj.teamId,
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

    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    })
    await projectService.removeMember(projectId, userId)

    if (proj) {
      await auditLogService.logAction({
        action: AuditAction.project_member_remove,
        teamId: proj.teamId,
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

      const proj = await prisma.project.findUnique({
        where: { id: projectId },
        select: { teamId: true },
      })
      if (proj) {
        await auditLogService.logAction({
          action: AuditAction.project_member_add,
          teamId: proj.teamId,
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
