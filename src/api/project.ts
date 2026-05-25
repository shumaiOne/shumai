import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authzService, Permission } from '@/services/authz/authz'
import { projectService } from '@/services/project/project'
import { assetService } from '@/services/asset/asset'
import { reparentAssetsRequestSchema, copyAssetsRequestSchema } from '@/dtos/asset'
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  listProjectsRequestSchema,
  recentlyDeletedRequestSchema,
} from '@/dtos/project'
import { listMembersQuerySchema } from '@/dtos/team'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>()
  .post('/teams/:teamId/projects', zValidator('json', createProjectRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Edit,
    })

    const newProject = await projectService.createProject(user, {
      teamId,
      ...req,
    })

    return c.json(newProject)
  })
  .put(
    '/teams/:teamId/projects/:projectId',
    zValidator('json', updateProjectRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Edit,
      })

      const updatedProject = await projectService.updateProject({
        projectId,
        ...req,
      })

      return c.json(updatedProject)
    },
  )
  .get(
    '/projects/:projectId/recently-deleted',
    zValidator('query', recentlyDeletedRequestSchema),
    async (c) => {
      const projectId = c.req.param('projectId')
      const user = c.get('user')
      const req = c.req.valid('query')

      await authzService.hasPermission({
        projectId,
        user,
        permission: Permission.Read,
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
  .get('/teams/:teamId/projects', zValidator('query', listProjectsRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const req = c.req.valid('query')

    await authzService.hasPermission({
      teamId,
      user,
      permission: Permission.Read,
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
      projectId,
      user,
      permission: Permission.Read,
    })

    const p = await projectService.getProject(projectId)
    return c.json(p)
  })
  .delete('/projects/:projectId', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      projectId,
      user,
      permission: Permission.Admin,
    })

    await projectService.deleteProject(projectId)
    return c.json({ success: true })
  })
  .get('/projects/:projectId/team', async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')

    await authzService.hasPermission({
      projectId,
      user,
      permission: Permission.Read,
    })

    const teamId = await projectService.getProjectTeam(projectId)
    return c.json({ teamId })
  })
  .get('/projects/:projectId/members', zValidator('query', listMembersQuerySchema), async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')
    const { includeAgents } = c.req.valid('query')

    await authzService.hasPermission({
      projectId,
      user,
      permission: Permission.Read,
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
      projectId,
      user,
      permission: Permission.Read,
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
        assetId: req.newParentId,
        user,
        permission: Permission.Edit,
      })

      // Check Edit permission on all source assets
      for (const assetId of req.assetIds) {
        await authzService.hasPermission({
          assetId,
          user,
          permission: Permission.Edit,
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
      assetId: req.newParentId,
      user,
      permission: Permission.Edit,
    })

    // Check Read permission on all source assets
    for (const assetId of req.assetIds) {
      await authzService.hasPermission({
        assetId,
        user,
        permission: Permission.Read,
      })
    }

    await assetService.copyAssets({
      ...req,
      creatorId: user.id,
    })

    return c.body(null, 204)
  })

export default route
