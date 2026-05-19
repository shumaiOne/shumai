import { prisma } from '@/db'
import type { Prisma } from '@/generated/prisma/client.ts'
type User = Prisma.UserGetPayload<Record<string, never>>

export enum Permission {
  Read = 'Read',
  Edit = 'Edit',
  Admin = 'Admin',
}

export interface AuthzRequest {
  teamId?: string
  projectId?: string
  assetId?: string
  user: User
  permission: Permission
}

export class AuthzService {
  async hasPermission(req: AuthzRequest): Promise<void> {
    if (!req.user) throw new Error('User is required')

    let projectId = req.projectId
    let teamId: string | undefined

    // 1. Resolve ProjectID and TeamID
    if (req.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: req.assetId },
        select: { projectId: true },
      })
      if (!asset) throw new Error('Asset not found')
      if (!asset.projectId) throw new Error(`Asset ${req.assetId} does not belong to a project`)

      projectId = asset.projectId
    }

    if (projectId) {
      const proj = await prisma.project.findUnique({
        where: { id: projectId },
        select: { teamId: true },
      })
      if (!proj) throw new Error('Project not found')
      teamId = proj.teamId
    } else {
      if (!req.teamId) throw new Error('Project ID or Team ID is required')
      teamId = req.teamId
    }

    // 2. Check Team Membership
    const member = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: teamId,
          userId: req.user.id,
        },
      },
    })

    if (!member) throw new Error('User is not a member of the team')

    // 3. Check Scope
    if (member.scope === 'team') {
      return this.checkRole(member.role, req.permission)
    }

    // 4. Scope is Project
    if (!projectId) {
      // User has project scope but no project context provided.
      // Allow Read access to team context (e.g. ListProjects)
      if (req.permission === Permission.Read) {
        return
      }
      throw new Error('User has only project scope')
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

    if (!pm) throw new Error(`User is not a member of project ${projectId}`)

    return this.checkRole(pm.role, req.permission)
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
    throw new Error('Permission denied')
  }
}

export const authzService = new AuthzService()
