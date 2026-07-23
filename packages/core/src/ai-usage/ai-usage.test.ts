import { describe, expect, it } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { aiUsageService } from './ai-usage'
import { HTTPException } from 'hono/http-exception'

describe('AiUsageService', () => {
  setupTestDbHooks()

  async function createTestTeamAndUser() {
    const user = await prisma.user.create({
      data: {
        name: 'Usage Test User',
        email: `usage-test-${Date.now()}-${Math.random()}@example.com`,
      },
    })

    const team = await prisma.team.create({
      data: {
        name: 'Usage Test Team',
      },
    })

    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      },
    })

    return { user, team, teamMember }
  }

  it('records usage for both team total and specific member', async () => {
    const { team, user } = await createTestTeamAndUser()

    const now = new Date()
    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: user.id,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 20,
      totalTokens: 150,
      cost: 0.001,
      timestamp: now,
    })

    // Verify database rows
    const records = await prisma.aiUsage.findMany({
      where: { teamId: team.id },
    })

    expect(records).toHaveLength(2)

    const teamRecord = records.find((r) => r.userId === null)
    expect(teamRecord).toBeDefined()
    expect(teamRecord?.inputTokens).toBe(100)
    expect(teamRecord?.outputTokens).toBe(50)
    expect(teamRecord?.cacheReadTokens).toBe(20)
    expect(teamRecord?.totalTokens).toBe(150)
    expect(teamRecord?.cost).toBeCloseTo(0.001)

    const memberRecord = records.find((r) => r.userId === user.id)
    expect(memberRecord).toBeDefined()
    expect(memberRecord?.inputTokens).toBe(100)
    expect(memberRecord?.outputTokens).toBe(50)
    expect(memberRecord?.cacheReadTokens).toBe(20)
    expect(memberRecord?.totalTokens).toBe(150)
    expect(memberRecord?.cost).toBeCloseTo(0.001)
  })

  it('increments existing hourly buckets for team and member', async () => {
    const { team, user } = await createTestTeamAndUser()

    const now = new Date()
    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: user.id,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      totalTokens: 150,
      cost: 0.001,
      timestamp: now,
    })

    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: user.id,
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 30,
      totalTokens: 300,
      cost: 0.002,
      timestamp: now,
    })

    const teamStats = await aiUsageService.getTeamUsageStats({
      teamId: team.id,
      timeframe: '1h',
    })

    expect(teamStats.team).toBeDefined()
    expect(teamStats.team?.inputTokens).toBe(300)
    expect(teamStats.team?.outputTokens).toBe(150)
    expect(teamStats.team?.cacheReadTokens).toBe(40)
    expect(teamStats.team?.totalTokens).toBe(450)
    expect(teamStats.team?.cost).toBeCloseTo(0.003)

    const memberStats = await aiUsageService.getTeamUsageStats({
      teamId: team.id,
      timeframe: '1h',
      userId: user.id,
    })

    expect(memberStats.member).toBeDefined()
    expect(memberStats.member?.userId).toBe(user.id)
    expect(memberStats.member?.inputTokens).toBe(300)
    expect(memberStats.member?.outputTokens).toBe(150)
    expect(memberStats.member?.cacheReadTokens).toBe(40)
    expect(memberStats.member?.totalTokens).toBe(450)
    expect(memberStats.member?.cost).toBeCloseTo(0.003)
  })

  it('handles background system tasks with no userId', async () => {
    const { team } = await createTestTeamAndUser()

    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: null,
      inputTokens: 50,
      outputTokens: 25,
      cacheReadTokens: 5,
      totalTokens: 75,
      cost: 0.0005,
    })

    const records = await prisma.aiUsage.findMany({
      where: { teamId: team.id },
    })

    expect(records).toHaveLength(1)
    expect(records[0].userId).toBeNull()
    expect(records[0].inputTokens).toBe(50)
  })

  it('filters statistics correctly by timeframe', async () => {
    const { team, user } = await createTestTeamAndUser()

    const now = new Date()

    // 30 minutes ago (within 1h)
    const recent = new Date(now.getTime() - 30 * 60 * 1000)
    // 2 hours ago (within 24h, outside 1h)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    // 3 days ago (within 7d, outside 24h)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: user.id,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      totalTokens: 150,
      cost: 0.001,
      timestamp: recent,
    })

    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: user.id,
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 20,
      totalTokens: 300,
      cost: 0.002,
      timestamp: twoHoursAgo,
    })

    await aiUsageService.recordUsage({
      teamId: team.id,
      userId: user.id,
      inputTokens: 400,
      outputTokens: 200,
      cacheReadTokens: 40,
      totalTokens: 600,
      cost: 0.004,
      timestamp: threeDaysAgo,
    })

    // 1h timeframe should only include recent
    const stats1h = await aiUsageService.getTeamUsageStats({
      teamId: team.id,
      timeframe: '1h',
    })
    expect(stats1h.team?.inputTokens).toBe(100)

    // 24h timeframe should include recent + 2 hours ago
    const stats24h = await aiUsageService.getTeamUsageStats({
      teamId: team.id,
      timeframe: '24h',
    })
    expect(stats24h.team?.inputTokens).toBe(300)

    // 7d timeframe should include all 3
    const stats7d = await aiUsageService.getTeamUsageStats({
      teamId: team.id,
      timeframe: '7d',
    })
    expect(stats7d.team?.inputTokens).toBe(700)
  })

  it('throws 404 when querying non-existent team member', async () => {
    const { team } = await createTestTeamAndUser()

    await expect(
      aiUsageService.getTeamUsageStats({
        teamId: team.id,
        timeframe: '30d',
        userId: 'non-existent-user-id',
      }),
    ).rejects.toThrow(HTTPException)
  })
})
