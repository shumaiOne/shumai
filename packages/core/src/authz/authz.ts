import { prisma, type TeamMemberRole } from '@shumai/db'
import type { Prisma } from '@shumai/db'
import { HTTPException } from 'hono/http-exception'

type User = Prisma.UserGetPayload<Record<string, never>>

export enum Permission {
  Read = 'Read',
  Edit = 'Edit',
  Admin = 'Admin',
}

export enum ResourceType {
  Team = 'team',
  Project = 'project',
  Asset = 'asset',
  Collection = 'collection',
  Agent = 'agent',
  Share = 'share',
  MetadataField = 'metadataField',
  Skill = 'skill',
  Provider = 'provider',
  McpServer = 'mcpServer',
  Invite = 'invite',
  Comment = 'comment',
  AgentSession = 'agentSession',
  QuotaRule = 'quotaRule',
}

export interface AuthzRequest {
  user: User
  permission: Permission
  type: ResourceType
  id: string
}

type RoleDb = typeof prisma | Prisma.TransactionClient

/**
 * Resolve a user's effective role for a team/project context, mirroring the
 * precedence rules enforced by `AuthzService.hasPermission`:
 *
 * 1. Project membership (`projectMember.role`) takes precedence inside a project.
 * 2. Team-scoped members fall back to their team role when no project override exists.
 * 3. Project-scoped members without a matching project record (or without a
 *    project context) are restricted (`null`).
 *
 * Returns `null` for non-members as well, so callers can fail closed.
 */
export async function resolveEffectiveRole(
  teamId: string,
  projectId: string | undefined,
  userId: string,
  db: RoleDb = prisma,
): Promise<TeamMemberRole | null> {
  const member = await db.teamMember.findUnique({
    where: {
      teamIdUserId: {
        teamId,
        userId,
      },
    },
  })
  if (!member) return null

  // Project membership takes precedence when operating inside a project.
  if (projectId) {
    const pm = await db.projectMember.findUnique({
      where: {
        projectIdTeamMemberId: {
          projectId,
          teamMemberId: member.id,
        },
      },
    })
    if (pm) return pm.role
  }

  // Team-scoped members fall back to their team role.
  if (member.scope === 'team') return member.role

  // Project-scoped members without a matching project record are restricted.
  return null
}

export class AuthzService {
  async hasPermission(req: AuthzRequest): Promise<void> {
    if (!req.user) throw new HTTPException(401, { message: 'User is required' })

    const { teamId, projectId } = await this.resolveContext(req.type, req.id)

    // Resolve the user's effective role using the shared precedence rules
    // (project override -> team role for team-scoped members -> restricted).
    const role = await resolveEffectiveRole(teamId, projectId, req.user.id)
    if (role) {
      return this.checkRole(role, req.permission)
    }

    // No effective role: either not a team member, or a project-scoped member
    // without access to the resolved project context.
    const member = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: teamId,
          userId: req.user.id,
        },
      },
    })
    if (!member) throw new HTTPException(403, { message: 'User is not a member of the team' })

    // Project-scoped member on a team-level resource (no project context):
    // allow Read (e.g. listing), deny Edit/Admin.
    if (!projectId && req.permission === Permission.Read) {
      return
    }
    throw new HTTPException(403, { message: 'User has only project scope' })
  }

  private async resolveContext(
    type: ResourceType,
    id: string,
  ): Promise<{ teamId: string; projectId?: string }> {
    switch (type) {
      case ResourceType.Team:
        return { teamId: id }

      case ResourceType.Project: {
        const proj = await prisma.project.findUnique({
          where: { id },
          select: { teamId: true },
        })
        if (!proj) throw new HTTPException(404, { message: 'Project not found' })
        return { teamId: proj.teamId, projectId: id }
      }

      case ResourceType.Asset: {
        const asset = await prisma.asset.findUnique({
          where: { id },
          select: {
            parentId: true,
            teamRootFolder: { select: { id: true } },
            project: { select: { id: true, teamId: true } },
          },
        })
        if (!asset) throw new HTTPException(404, { message: 'Asset not found' })
        if (asset.project) {
          return { teamId: asset.project.teamId, projectId: asset.project.id }
        }
        if (asset.teamRootFolder) {
          return { teamId: asset.teamRootFolder.id }
        }
        if (asset.parentId) {
          // If it's a nested asset, we might need recursive lookup.
          // However, in this project, assets typically have projectId if they are in a project.
          // If parentId is set but no project, it might be in a team root folder.
          // For now, let's try to get context from parent.
          return this.resolveContext(ResourceType.Asset, asset.parentId)
        }
        throw new HTTPException(403, { message: 'Could not resolve context for asset' })
      }

      case ResourceType.Collection: {
        const coll = await prisma.collection.findUnique({
          where: { id },
          include: { project: true },
        })
        if (!coll) throw new HTTPException(404, { message: 'Collection not found' })
        return { teamId: coll.project.teamId, projectId: coll.projectId }
      }

      case ResourceType.Agent: {
        const agent = await prisma.agent.findUnique({
          where: { id },
          select: { teamId: true },
        })
        if (!agent) throw new HTTPException(404, { message: 'Agent not found' })
        return { teamId: agent.teamId }
      }

      case ResourceType.AgentSession: {
        const session = await prisma.agentSession.findUnique({
          where: { id },
          include: { agent: true },
        })
        if (!session) throw new HTTPException(404, { message: 'Agent session not found' })
        return { teamId: session.agent.teamId }
      }

      case ResourceType.Share: {
        const share = await prisma.shareLink.findUnique({
          where: { id },
          include: { project: true },
        })
        if (!share) throw new HTTPException(404, { message: 'Share not found' })
        return { teamId: share.project.teamId, projectId: share.projectId }
      }

      case ResourceType.MetadataField: {
        const field = await prisma.metadataField.findUnique({
          where: { key: id },
          select: { teamId: true, projectId: true },
        })
        if (!field) throw new HTTPException(404, { message: 'Metadata field not found' })
        if (field.projectId) {
          const proj = await prisma.project.findUnique({
            where: { id: field.projectId },
            select: { teamId: true },
          })
          return { teamId: proj!.teamId, projectId: field.projectId }
        }
        if (!field.teamId)
          throw new HTTPException(403, { message: 'Metadata field has no context' })
        return { teamId: field.teamId }
      }

      case ResourceType.Skill: {
        const skill = await prisma.skill.findUnique({
          where: { id },
          select: { teamId: true },
        })
        if (!skill) throw new HTTPException(404, { message: 'Skill not found' })
        return { teamId: skill.teamId }
      }

      case ResourceType.McpServer: {
        const server = await prisma.mcpServer.findUnique({
          where: { id },
          select: { teamId: true },
        })
        if (!server) throw new HTTPException(404, { message: 'MCP server not found' })
        return { teamId: server.teamId }
      }

      case ResourceType.Provider: {
        const provider = await prisma.provider.findUnique({
          where: { id },
          select: { teamId: true },
        })
        if (!provider) throw new HTTPException(404, { message: 'Provider not found' })
        return { teamId: provider.teamId }
      }

      case ResourceType.Invite: {
        const invite = await prisma.invite.findUnique({
          where: { id },
          select: { teamId: true, projectId: true },
        })
        if (!invite) throw new HTTPException(404, { message: 'Invite not found' })
        return { teamId: invite.teamId, projectId: invite.projectId ?? undefined }
      }

      case ResourceType.Comment: {
        const comment = await prisma.assetComment.findUnique({
          where: { id },
          include: { asset: { include: { project: true } } },
        })
        if (!comment) throw new HTTPException(404, { message: 'Comment not found' })
        if (!comment.asset.project)
          throw new HTTPException(403, { message: 'Comment asset has no project' })
        return { teamId: comment.asset.project.teamId, projectId: comment.asset.projectId! }
      }

      case ResourceType.QuotaRule: {
        const rule = await prisma.quotaRule.findUnique({
          where: { id },
          select: { teamId: true },
        })
        if (!rule) throw new HTTPException(404, { message: 'Quota rule not found' })
        return { teamId: rule.teamId }
      }

      default:
        throw new HTTPException(403, { message: `Unsupported resource type: ${type}` })
    }
  }

  private checkRole(role: string, permission: Permission): void {
    switch (permission) {
      case Permission.Read:
        return
      case Permission.Edit:
        if (role === 'owner' || role === 'editor') return
        break
      case Permission.Admin:
        if (role === 'owner') return
        break
    }
    throw new HTTPException(403, { message: 'Permission denied' })
  }
}

export const authzService = new AuthzService()
