import { prisma } from '@shumai/db'
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
  Invite = 'invite',
  Comment = 'comment',
  AgentSession = 'agentSession',
}

export interface AuthzRequest {
  user: User
  permission: Permission
  type: ResourceType
  id: string
}

export class AuthzService {
  async hasPermission(req: AuthzRequest): Promise<void> {
    if (!req.user) throw new HTTPException(401, { message: 'User is required' })

    const { teamId, projectId } = await this.resolveContext(req.type, req.id)

    // 1. Check Team Membership
    const member = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: teamId,
          userId: req.user.id,
        },
      },
    })

    if (!member) throw new HTTPException(403, { message: 'User is not a member of the team' })

    // 2. Check Scope
    if (member.scope === 'team') {
      return this.checkRole(member.role, req.permission)
    }

    // 3. Scope is Project
    if (!projectId) {
      // User has project scope but no project context provided (e.g. Team-level resource)
      // If it's a team-level resource, project-scoped users shouldn't have access except for Read maybe?
      // But usually team resources like Skills/Providers are managed by Team Owners/Editors.
      // For now, let's keep the logic: project-scoped users can't access team-level resources unless it's Read (like ListProjects).
      if (req.permission === Permission.Read) {
        return
      }
      throw new HTTPException(403, { message: 'User has only project scope' })
    }

    // Check Project Membership
    const pm = await prisma.projectMember.findUnique({
      where: {
        projectIdTeamMemberId: {
          projectId: projectId,
          teamMemberId: member.id,
        },
      },
    })

    if (!pm) throw new HTTPException(403, { message: `User is not a member of project ${projectId}` })

    return this.checkRole(pm.role, req.permission)
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
        if (!field.teamId) throw new HTTPException(403, { message: 'Metadata field has no context' })
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
        if (!comment.asset.project) throw new HTTPException(403, { message: 'Comment asset has no project' })
        return { teamId: comment.asset.project.teamId, projectId: comment.asset.projectId! }
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
