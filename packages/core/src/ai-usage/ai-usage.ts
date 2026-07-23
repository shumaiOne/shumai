import { prisma } from '@shumai/db'
import type { TeamUsageStatsResponse, Timeframe } from '@shumai/dtos'
import { HTTPException } from 'hono/http-exception'

export interface RecordUsageParams {
  teamId: string
  userId?: string | null
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
  cost: number
  timestamp?: Date
}

export interface GetTeamUsageStatsParams {
  teamId: string
  timeframe: Timeframe
  userId?: string
}

export class AiUsageService {
  private async incrementBucket(params: {
    teamId: string
    userId: string | null
    periodStart: Date
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    totalTokens: number
    cost: number
  }): Promise<void> {
    const existing = await prisma.aiUsage.findFirst({
      where: {
        teamId: params.teamId,
        userId: params.userId,
        periodStart: params.periodStart,
      },
    })

    if (existing) {
      await prisma.aiUsage.update({
        where: { id: existing.id },
        data: {
          inputTokens: { increment: params.inputTokens },
          outputTokens: { increment: params.outputTokens },
          cacheReadTokens: { increment: params.cacheReadTokens },
          totalTokens: { increment: params.totalTokens },
          cost: { increment: params.cost },
        },
      })
    } else {
      await prisma.aiUsage.create({
        data: {
          teamId: params.teamId,
          userId: params.userId,
          periodStart: params.periodStart,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          cacheReadTokens: params.cacheReadTokens,
          totalTokens: params.totalTokens,
          cost: params.cost,
        },
      })
    }
  }

  async recordUsage(params: RecordUsageParams): Promise<void> {
    const timestamp = params.timestamp ?? new Date()
    const periodStart = new Date(timestamp)
    periodStart.setMinutes(0, 0, 0)
    periodStart.setMilliseconds(0)

    // 1. Update/create Team Total record (userId = null)
    await this.incrementBucket({
      teamId: params.teamId,
      userId: null,
      periodStart,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cacheReadTokens: params.cacheReadTokens,
      totalTokens: params.totalTokens,
      cost: params.cost,
    })

    // 2. If triggered by a team member, update/create Member Usage record (userId = params.userId)
    if (params.userId) {
      await this.incrementBucket({
        teamId: params.teamId,
        userId: params.userId,
        periodStart,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        cacheReadTokens: params.cacheReadTokens,
        totalTokens: params.totalTokens,
        cost: params.cost,
      })
    }
  }

  async getTeamUsageStats(params: GetTeamUsageStatsParams): Promise<TeamUsageStatsResponse> {
    const now = new Date()
    const since = new Date(now)

    switch (params.timeframe) {
      case '1h':
        since.setHours(since.getHours() - 1)
        break
      case '24h':
        since.setDate(since.getDate() - 1)
        break
      case '7d':
        since.setDate(since.getDate() - 7)
        break
      case '30d':
        since.setDate(since.getDate() - 30)
        break
    }

    since.setMinutes(0, 0, 0)


    if (!params.userId) {
      // Return Team-Level Usage (userId = null)
      const teamRecords = await prisma.aiUsage.findMany({
        where: {
          teamId: params.teamId,
          userId: null,
          periodStart: { gte: since },
        },
      })

      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let totalTokens = 0
      let cost = 0

      for (const r of teamRecords) {
        inputTokens += r.inputTokens
        outputTokens += r.outputTokens
        cacheReadTokens += r.cacheReadTokens
        totalTokens += r.totalTokens
        cost += r.cost
      }

      return {
        timeframe: params.timeframe,
        team: {
          inputTokens,
          outputTokens,
          cacheReadTokens,
          totalTokens,
          cost: Math.round(cost * 1000000) / 1000000,
        },
      }
    } else {
      // Return Specific Member Usage
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: params.teamId,
          userId: params.userId,
        },
        include: { user: true },
      })

      if (!teamMember) {
        throw new HTTPException(404, { message: 'Team member not found' })
      }

      const memberRecords = await prisma.aiUsage.findMany({
        where: {
          teamId: params.teamId,
          userId: params.userId,
          periodStart: { gte: since },
        },
      })

      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let totalTokens = 0
      let cost = 0

      for (const r of memberRecords) {
        inputTokens += r.inputTokens
        outputTokens += r.outputTokens
        cacheReadTokens += r.cacheReadTokens
        totalTokens += r.totalTokens
        cost += r.cost
      }

      return {
        timeframe: params.timeframe,
        member: {
          userId: teamMember.user.id,
          userName: teamMember.user.name,
          userEmail: teamMember.user.email,
          userImage: teamMember.user.image,
          role: teamMember.role,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          totalTokens,
          cost: Math.round(cost * 1000000) / 1000000,
        },
      }
    }
  }
}

export const aiUsageService = new AiUsageService()
