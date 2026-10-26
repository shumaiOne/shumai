import { listProjects, MAX_PAGE_SIZE } from '@shumai/operations'
import { projectService } from '@shumai/core/src/project/project'
import { implementOperation } from '../implement'

export const listProjectsOp = implementOperation(listProjects, {
  // Only the caller's own projects are listed, scoped by team/project membership in the service.
  authz: () => [],
  execute: async (input, ctx) => {
    const projects = await projectService.getUserProjects(ctx.userId, input.first ?? MAX_PAGE_SIZE)
    return {
      data: projects.map((p) => ({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        rootFolderId: p.rootFolder ?? null,
      })),
    }
  },
})
