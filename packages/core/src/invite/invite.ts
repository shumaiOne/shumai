import { prisma } from '@shumai/db'
import { InviteRole, ProjectMemberRole, TeamMemberRole } from '@shumai/db'
import { ulid } from 'ulid'

export interface CreateTeamInviteRequest {
  teamId: string
  role: InviteRole
  inviterId: string
}

export interface CreateProjectInviteRequest {
  projectId: string
  role: InviteRole
  inviterId: string
}

export class InviteService {
  async createTeamInvite(req: CreateTeamInviteRequest) {
    const code = ulid()
    const inv = await prisma.invite.create({
      data: {
        code,
        teamId: req.teamId,
        inviterId: req.inviterId,
        role: req.role,
      },
    })
    return this.getInvite(inv.code)
  }

  async createProjectInvite(req: CreateProjectInviteRequest) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: req.projectId },
      include: { team: true },
    })

    const code = ulid()
    const inv = await prisma.invite.create({
      data: {
        code,
        teamId: project.teamId,
        projectId: project.id,
        inviterId: req.inviterId,
        role: req.role,
      },
    })

    return this.getInvite(inv.code)
  }

  async getInvite(code: string) {
    const inv = await prisma.invite.findUniqueOrThrow({
      where: { code },
      include: {
        team: true,
        project: true,
        inviter: true,
      },
    })

    return inv
  }

  async validateInvite(code: string): Promise<boolean> {
    const inv = await prisma.invite.findUnique({
      where: { code },
    })

    if (!inv) {
      return false
    }

    if (inv.used) {
      return false
    }

    return true
  }

  async consumeInvite(code: string, userId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invite.findUniqueOrThrow({
        where: { code },
        include: { team: true, project: true },
      })

      if (inv.used) {
        throw new Error('invite code already used')
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      })

      let tm = await tx.teamMember.findUnique({
        where: {
          teamIdUserId: {
            teamId: inv.teamId,
            userId: user.id,
          },
        },
      })

      if (!inv.projectId) {
        // Team Invite
        if (tm) {
          if (tm.scope === 'project') {
            await tx.teamMember.update({
              where: { id: tm.id },
              data: {
                scope: 'team',
                role: inv.role as unknown as TeamMemberRole,
              },
            })
          }
        } else {
          await tx.teamMember.create({
            data: {
              teamId: inv.teamId,
              userId: user.id,
              role: inv.role as unknown as TeamMemberRole,
              scope: 'team',
            },
          })
        }
      } else {
        // Project Invite
        if (!tm) {
          tm = await tx.teamMember.create({
            data: {
              teamId: inv.teamId,
              userId: user.id,
              role: 'reviewer', // default fallback for project scope TeamMember
              scope: 'project',
            },
          })
        }

        const pm = await tx.projectMember.findUnique({
          where: {
            projectIdTeamMemberId: {
              projectId: inv.projectId,
              teamMemberId: tm.id,
            },
          },
        })

        if (!pm) {
          await tx.projectMember.create({
            data: {
              projectId: inv.projectId,
              teamMemberId: tm.id,
              role: inv.role as unknown as ProjectMemberRole,
            },
          })
        }
      }

      await tx.invite.update({
        where: { id: inv.id },
        data: { used: true },
      })
    })
  }
}

export const inviteService = new InviteService()
