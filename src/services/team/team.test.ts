import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { teamService } from '@/services/team/team'
import { describe, expect, it } from 'vitest'

describe('TeamService', () => {
  setupTestDbHooks()

  it('should ensure default team', async () => {
    const team = await teamService.ensureDefaultTeam()
    expect(team).toBeDefined()
    expect(team.name).toBe('Default Team')
  })

  it('should create team', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: 'test-user@example.com', password: 'pw' },
    })

    const team = await teamService.createTeam(user, {
      name: 'Test Team',
    })

    expect(team.id).toBeDefined()
    expect(team.name).toBe('Test Team')
    expect(team.rootFolder).toBeDefined()

    // Test that the team member is created
    const members = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    })
    expect(members).toHaveLength(1)
    expect(members[0].userId).toBe(user.id)
    expect(members[0].role).toBe('owner')
  })

  it('should get user teams', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: 'test-user-2@example.com', password: 'pw' },
    })
    const team = await teamService.createTeam(user, {
      name: 'Test Team',
    })

    const teams = await teamService.getUserTeams({
      userId: user.id,
      pagination: { first: 10 },
    })

    expect(teams.data).toHaveLength(1)
    expect(teams.data[0].id).toBe(team.id)
  })

  it('should join team', async () => {
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: 'owner@example.com', password: 'pw' },
    })
    const user = await prisma.user.create({
      data: { name: 'Joiner', email: 'joiner@example.com', password: 'pw' },
    })

    const team = await teamService.createTeam(owner, {
      name: 'Test Team',
    })

    await teamService.joinTeam({
      teamId: team.id,
      userId: user.id,
    })

    const members = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    })
    expect(members).toHaveLength(2)
  })

  it('should get me', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await teamService.createTeam(user, {
      name: 'Test Team',
    })

    const me = await teamService.getMe({
      teamId: team.id,
      user,
    })

    expect(me.id).toBe(user.id)
    expect(me.name).toBe('Test User')
    expect(me.role).toBe('owner')
  })

  it('should get team members', async () => {
    const user1 = await prisma.user.create({
      data: { name: 'Test User 1', email: `test1-${Date.now()}@example.com`, password: 'pw' },
    })
    const user2 = await prisma.user.create({
      data: { name: 'Test User 2', email: `test2-${Date.now()}@example.com`, password: 'pw' },
    })

    const team = await teamService.createTeam(user1, {
      name: 'Test Team',
    })

    await teamService.joinTeam({
      teamId: team.id,
      userId: user2.id,
    })

    const members = await teamService.getTeamMembers({
      teamId: team.id,
    })

    expect(members).toHaveLength(2)
  })

  it('should filter bots in team members', async () => {
    const user = await prisma.user.create({
      data: { name: 'Human', email: `human-${Date.now()}@example.com`, password: 'pw' },
    })

    const team = await teamService.createTeam(user, {
      name: 'Test Team',
    })

    const bot = await prisma.user.create({
      data: {
        name: 'Bot',
        email: `bot-${Date.now()}@example.com`,
        password: 'pw',
        type: 'agent',
        agent: {
          create: {
            teamId: team.id,
            type: 'chat',
            enabled: true,
            config: {
              provider: 'google',
              model: 'gemini',
            },
          },
        },
      },
    })

    await teamService.joinTeam({
      teamId: team.id,
      userId: bot.id,
    })

    // Should hide bots by default
    const members = await teamService.getTeamMembers({
      teamId: team.id,
    })
    expect(members).toHaveLength(1)
    expect(members[0].id).toBe(user.id)

    // Should include bots if requested
    const allMembers = await teamService.getTeamMembers({
      teamId: team.id,
      includeAgents: true,
    })
    expect(allMembers).toHaveLength(2)
  })

  it('should get and update settings', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await teamService.createTeam(user, {
      name: 'Test Team',
    })

    const settings = await teamService.getSettings(team.id)
    expect(settings).toEqual({})

    await teamService.updateSettings(team.id, 'theme', 'dark')

    const newSettings = await teamService.getSettings(team.id)
    expect(newSettings).toEqual({ theme: 'dark' })
  })

  it('should create sandbox when team is created', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-sandbox-${Date.now()}@example.com`, password: 'pw' },
    })

    const team = await teamService.createTeam(user, {
      name: 'Sandbox Team',
    })

    const sandbox = await prisma.sandbox.findUnique({
      where: { teamId: team.id },
    })

    expect(sandbox).toBeDefined()
    expect(sandbox?.allowedDomains).toContain('github.com')
  })

  it('should get and update sandbox settings', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-settings-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await teamService.createTeam(user, {
      name: 'Settings Team',
    })

    // Should have default settings
    const settings = await teamService.getSandboxSettings(team.id)
    expect(settings.allowedDomains).toContain('github.com')

    // Should update settings
    const updated = await teamService.updateSandboxSettings(team.id, {
      allowedDomains: ['example.com'],
    })
    expect(updated.allowedDomains).toEqual(['example.com'])

    // Should persist to DB
    const persisted = await teamService.getSandboxSettings(team.id)
    expect(persisted.allowedDomains).toEqual(['example.com'])
  })

  it('should return empty allowedDomains if sandbox is missing for old team', async () => {
    const team = await prisma.team.create({
      data: { name: 'Old Team' },
    })

    const settings = await teamService.getSandboxSettings(team.id)
    expect(settings.allowedDomains).toEqual([])
  })
})
