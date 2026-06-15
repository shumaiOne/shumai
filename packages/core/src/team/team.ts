import { prisma } from '@shumai/db'
import { Prisma } from '@shumai/db'
import { PaginatedData, paginateQuery } from '@shumai/core/src/pagination'
import { ProviderService, providerService } from '@shumai/core/src/provider/provider'
import { notificationService } from '@shumai/core/src/notification/notification'
import { getAvatarUrl } from '@shumai/core/src/user/avatar'
import { HTTPException } from 'hono/http-exception'
import {
  ServiceCreateTeamRequest,
  ServiceGetUserTeamsRequest,
  ServiceJoinTeamRequest,
  ServiceGetMeRequest,
  ServiceGetTeamMembersRequest,
  ServiceUpdateTeamMemberRoleRequest,
  TeamInfo,
  GetMeResponse,
  UserInfo,
  SandboxSettings,
} from '@shumai/dtos'

export class TeamService {
  async ensureDefaultTeam() {
    let team = await prisma.team.findFirst({
      where: { name: 'Default Team' },
    })

    if (!team) {
      team = await prisma.team.create({
        data: {
          name: 'Default Team',
          settings: {
            transcode: { videoStrategy: 'best_match' },
          },
          sandbox: { create: {} },
        },
      })
      await providerService.initBuiltinProviders(team.id)
    }

    return team
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createTeam(user: any, req: ServiceCreateTeamRequest): Promise<TeamInfo> {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: req.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          settings: {} as any,
          sandbox: { create: {} },
        },
      })

      const rootFolder = await tx.asset.create({
        data: {
          name: 'root',
          type: 'root',
          status: 'processed',
        },
      })

      const updatedTeam = await tx.team.update({
        where: { id: team.id },
        data: { rootFolderId: rootFolder.id },
        include: { rootFolder: true },
      })

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: 'owner',
          scope: 'team',
        },
      })

      // We use 'any' here because ProviderService expects the full PrismaClient,
      // but the TransactionClient is compatible with the methods we use.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new ProviderService(tx as any).initBuiltinProviders(team.id)

      return this.toTeamInfo(updatedTeam)
    })
  }

  async getUserTeams(req: ServiceGetUserTeamsRequest): Promise<PaginatedData<TeamInfo[]>> {
    const where: Prisma.TeamWhereInput = {
      members: {
        some: {
          userId: req.userId,
        },
      },
    }

    return await paginateQuery(
      async (skip, take) => {
        const teams = await prisma.team.findMany({
          where,
          skip,
          take,
          orderBy: { id: 'desc' },
          include: { rootFolder: true },
        })
        return teams.map(this.toTeamInfo)
      },
      null,
      req.pagination,
    )
  }

  async joinTeam(req: ServiceJoinTeamRequest): Promise<void> {
    const existing = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: req.teamId,
          userId: req.userId,
        },
      },
    })

    if (!existing) {
      await prisma.teamMember.create({
        data: {
          teamId: req.teamId,
          userId: req.userId,
          role: 'reviewer',
          scope: 'team',
        },
      })
    }
  }

  async getMe(req: ServiceGetMeRequest): Promise<GetMeResponse> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: req.teamId,
          userId: req.user.id,
        },
      },
      include: { user: true },
    })

    if (!member) throw new HTTPException(403, { message: 'user is not a team member' })

    const unreadNotificationCount = await notificationService.getUnreadCount(
      req.teamId,
      req.user.id,
    )

    return {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email || undefined,
      role: member.role,
      image: await getAvatarUrl(member.user.image),
      unreadNotificationCount,
    }
  }

  async updateMe(userId: string, req: { name?: string; imageKey?: string | null }): Promise<void> {
    const data: Prisma.UserUpdateInput = {}
    if (req.name !== undefined) {
      data.name = req.name
    }
    if (req.imageKey !== undefined) {
      data.image = req.imageKey
    }
    await prisma.user.update({
      where: { id: userId },
      data,
    })
  }

  async getTeamMembers(req: ServiceGetTeamMembersRequest): Promise<UserInfo[]> {
    const requester = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: req.teamId,
          userId: req.userId,
        },
      },
    })

    if (!requester) {
      throw new HTTPException(403, { message: 'Requester is not a team member' })
    }

    const members = await prisma.teamMember.findMany({
      where: {
        teamId: req.teamId,
        ...(req.includeAgents
          ? {
              user: {
                OR: [
                  { type: 'human' },
                  {
                    type: 'agent',
                    agent: {
                      type: 'chat',
                      enabled: true,
                    },
                  },
                ],
              },
            }
          : { user: { type: { not: 'agent' } } }),
      },
      include: {
        user: true,
        projectMembers: true,
      },
    })

    let filteredMembers = members

    if (requester.scope === 'project') {
      const requesterProjectIds = await prisma.projectMember
        .findMany({
          where: { teamMemberId: requester.id },
          select: { projectId: true },
        })
        .then((pms) => pms.map((pm) => pm.projectId))

      filteredMembers = members.filter((m) => {
        // Team-scoped members are always visible
        if (m.scope === 'team') return true
        // Project-scoped members are visible if they share a project
        return m.projectMembers.some((pm) => requesterProjectIds.includes(pm.projectId))
      })
    }

    return Promise.all(
      filteredMembers.map(async (m) => ({
        id: m.user.id,
        name: m.user.name,
        email: undefined,
        role: m.role,
        type: m.user.type || undefined,
        image: await getAvatarUrl(m.user.image),
        scope: m.scope,
      })),
    )
  }

  async updateMemberRole(req: ServiceUpdateTeamMemberRoleRequest): Promise<void> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: req.teamId,
          userId: req.userId,
        },
      },
    })

    if (!member) throw new HTTPException(404, { message: 'Member not found' })
    if (member.role === 'owner')
      throw new HTTPException(403, { message: 'Cannot change the role of an owner' })

    await prisma.teamMember.update({
      where: { id: member.id },
      data: { role: req.role },
    })
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: {
          teamId: teamId,
          userId: userId,
        },
      },
    })

    if (!member) throw new HTTPException(404, { message: 'Member not found' })
    if (member.role === 'owner') throw new HTTPException(403, { message: 'Cannot remove an owner' })

    await prisma.teamMember.delete({
      where: { id: member.id },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getSettings(teamId: string): Promise<any> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })
    if (!team) throw new HTTPException(404, { message: 'team not found' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (team.settings || {}) as any

    const embeddingAgent = await prisma.agent.findFirst({
      where: { teamId, type: 'embedding', enabled: true },
    })
    settings.semanticSearchEnabled = !!embeddingAgent

    return settings
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateSettings(teamId: string, key: string, value: any): Promise<any> {
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) throw new HTTPException(404, { message: 'team not found' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (team.settings || {}) as any
    settings[key] = value

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { settings },
    })

    return updated.settings || {}
  }

  async getSandboxSettings(teamId: string): Promise<SandboxSettings> {
    const sandbox = await prisma.sandbox.findUnique({
      where: { teamId },
    })
    return {
      allowedDomains: sandbox?.allowedDomains || [],
      pendingDomains: sandbox?.pendingDomains || [],
    }
  }

  async updateSandboxSettings(teamId: string, settings: SandboxSettings): Promise<SandboxSettings> {
    const sandbox = await prisma.sandbox.upsert({
      where: { teamId },
      create: {
        teamId,
        allowedDomains: settings.allowedDomains,
        pendingDomains: settings.pendingDomains,
      },
      update: {
        allowedDomains: settings.allowedDomains,
        pendingDomains: settings.pendingDomains,
      },
    })
    return {
      allowedDomains: sandbox.allowedDomains,
      pendingDomains: sandbox.pendingDomains,
    }
  }

  async getSignupInfo() {
    const count = await prisma.user.count()

    return {
      userCount: count,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toTeamInfo(team: any): TeamInfo {
    return {
      id: team.id,
      name: team.name,
      rootFolder: team.rootFolder?.id || team.rootFolderId || undefined,
      updatedAt: team.updatedAt,
    }
  }
}

export const teamService = new TeamService()
