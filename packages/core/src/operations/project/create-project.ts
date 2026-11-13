import { HTTPException } from 'hono/http-exception'
import { createProject } from '@shumai/operations'
import { AuditAction } from '@shumai/dtos'
import { Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { projectService } from '@shumai/core/src/project/project'
import { teamService } from '@shumai/core/src/team/team'
import type { OperationContext } from '../context'
import { asBadRequest, badRequest } from '../errors'
import { implementOperation } from '../implement'

async function resolveTeamId(
  inputTeamId: string | undefined,
  ctx: OperationContext,
): Promise<string> {
  if (inputTeamId) return inputTeamId
  if (ctx.teamId) return ctx.teamId

  const teams = await teamService.getUserTeams({
    userId: ctx.userId,
    pagination: { first: 2 },
  })
  if (teams.data.length === 1) return teams.data[0].id
  if (teams.data.length === 0) {
    throw new HTTPException(403, { message: 'User is not a member of any team' })
  }
  throw badRequest('Multiple teams found for user; specify teamId')
}

export const createProjectOp = implementOperation(createProject, {
  authz: async (input, ctx) => {
    const teamId = await resolveTeamId(input.teamId, ctx)
    return [{ permission: Permission.Edit, type: ResourceType.Team, id: teamId }]
  },
  prepare: async (input, ctx) => ({
    teamId: await resolveTeamId(input.teamId, ctx),
  }),
  execute: async (input, ctx, { teamId }) => {
    const project = await asBadRequest(() =>
      projectService.createProject(
        { id: ctx.userId },
        {
          teamId,
          name: input.name,
          coverImageKey: input.coverImageKey,
          enableNotification: input.enableNotification ?? true,
        },
      ),
    )
    return {
      id: project.id,
      name: project.name,
      teamId: project.teamId,
      rootFolderId: project.rootFolder ?? null,
    }
  },
  audit: (_input, output) => [
    {
      action: AuditAction.project_create,
      itemId: output.id,
      teamId: output.teamId,
      projectId: output.id,
    },
  ],
})
