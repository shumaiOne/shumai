import { prisma } from '@/db'
import { Prisma } from '@/generated/prisma/client'
import { PaginatedData, paginateQuery } from '@/services/pagination'
import { ProviderService, providerService } from '@/services/provider/provider'
import {
  ServiceCreateTeamRequest,
  ServiceGetUserTeamsRequest,
  ServiceJoinTeamRequest,
  ServiceGetMeRequest,
  ServiceGetTeamMembersRequest,
  TeamInfo,
  GetMeResponse,
  UserInfo,
  SandboxSettings,
} from '@/dtos/team'

export class TeamService {
  async ensureDefaultTeam() {
    let team = await prisma.team.findFirst()

    if (!team) {
      team = await prisma.team.create({
        data: {
          name: 'Default Team',
          settings: {
            enablePublicSignup: true,
            transcode: { videoStrategy: 'disable', imageStrategy: 'disable' },
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
    })

    if (!member) throw new Error('user is not a team member')

    return {
      id: req.user.id,
      name: req.user.name,
      email: undefined,
      role: member.role,
    }
  }

  async getTeamMembers(req: ServiceGetTeamMembersRequest): Promise<UserInfo[]> {
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
      include: { user: true },
    })

    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: undefined,
      role: m.role,
      type: m.user.type || undefined,
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getSettings(teamId: string): Promise<any> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })
    if (!team) throw new Error('team not found')
    return team.settings || {}
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateSettings(teamId: string, key: string, value: any): Promise<any> {
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) throw new Error('team not found')

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
    }
  }

  async updateSandboxSettings(teamId: string, settings: SandboxSettings): Promise<SandboxSettings> {
    const sandbox = await prisma.sandbox.upsert({
      where: { teamId },
      create: {
        teamId,
        allowedDomains: settings.allowedDomains,
      },
      update: {
        allowedDomains: settings.allowedDomains,
      },
    })
    return {
      allowedDomains: sandbox.allowedDomains,
    }
  }

  async getSignupInfo() {
    const count = await prisma.user.count()
    const defaultTeam = await this.ensureDefaultTeam()
    const settings = defaultTeam.settings as {
      enablePublicSignup?: boolean
    } | null

    return {
      userCount: count,
      enablePublicSignup: settings?.enablePublicSignup ?? false,
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
