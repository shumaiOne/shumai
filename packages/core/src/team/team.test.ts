import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { teamService } from '@shumai/core/src/team/team'
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

  it('should update me', async () => {
    const user = await prisma.user.create({
      data: { name: 'Old Name', email: `test-${Date.now()}@example.com`, password: 'pw' },
    })
    await teamService.updateMe(user.id, {
      name: 'New Name',
      imageKey: 'avatar-s3-key',
    })

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    })
    expect(updatedUser?.name).toBe('New Name')
    expect(updatedUser?.image).toBe('avatar-s3-key')
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
      userId: user1.id,
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
      userId: user.id,
    })
    expect(members).toHaveLength(1)
    expect(members[0].id).toBe(user.id)

    // Should include bots if requested
    const allMembers = await teamService.getTeamMembers({
      teamId: team.id,
      userId: user.id,
      includeAgents: true,
    })
    expect(allMembers).toHaveLength(2)
  })

  it('should filter members for project-scoped members', async () => {
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `owner-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await teamService.createTeam(owner, { name: 'Test Team' })

    const teamMember = await prisma.user.create({
      data: { name: 'Team Member', email: `tm-${Date.now()}@example.com`, password: 'pw' },
    })
    await teamService.joinTeam({ teamId: team.id, userId: teamMember.id })

    const projectMember1 = await prisma.user.create({
      data: { name: 'Proj Member 1', email: `pm1-${Date.now()}@example.com`, password: 'pw' },
    })
    const tm1 = await prisma.teamMember.create({
      data: { teamId: team.id, userId: projectMember1.id, scope: 'project', role: 'editor' },
    })

    const projectMember2 = await prisma.user.create({
      data: { name: 'Proj Member 2', email: `pm2-${Date.now()}@example.com`, password: 'pw' },
    })
    const tm2 = await prisma.teamMember.create({
      data: { teamId: team.id, userId: projectMember2.id, scope: 'project', role: 'editor' },
    })

    const project = await prisma.project.create({
      data: { name: 'Shared Project', teamId: team.id },
    })

    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, teamMemberId: tm1.id, role: 'editor' },
        { projectId: project.id, teamMemberId: tm2.id, role: 'editor' },
      ],
    })

    const projectMember3 = await prisma.user.create({
      data: { name: 'Proj Member 3', email: `pm3-${Date.now()}@example.com`, password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: projectMember3.id, scope: 'project', role: 'editor' },
    })

    // Owner (team scope) should see everyone (4 users)
    const ownerView = await teamService.getTeamMembers({ teamId: team.id, userId: owner.id })
    expect(ownerView).toHaveLength(5) // Owner, Team Member, PM1, PM2, PM3

    // PM1 (project scope) should see: Owner, Team Member, PM2 (shares project), but NOT PM3
    const pm1View = await teamService.getTeamMembers({ teamId: team.id, userId: projectMember1.id })
    const pm1ViewIds = pm1View.map((m) => m.id)
    expect(pm1View).toHaveLength(4)
    expect(pm1ViewIds).toContain(owner.id)
    expect(pm1ViewIds).toContain(teamMember.id)
    expect(pm1ViewIds).toContain(projectMember2.id)
    expect(pm1ViewIds).not.toContain(projectMember3.id)

    // Check scopes are returned
    expect(pm1View.find((m) => m.id === owner.id)?.scope).toBe('team')
    expect(pm1View.find((m) => m.id === projectMember2.id)?.scope).toBe('project')
  })

  it('should get and update settings', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-${Date.now()}@example.com`, password: 'pw' },
    })
    const team = await teamService.createTeam(user, {
      name: 'Test Team',
    })

    const settings = await teamService.getSettings(team.id)
    expect(settings).toEqual({ semanticSearchEnabled: false })

    await teamService.updateSettings(team.id, 'theme', 'dark')

    const newSettings = await teamService.getSettings(team.id)
    expect(newSettings).toEqual({ theme: 'dark', semanticSearchEnabled: false })

    await teamService.updateSettings(team.id, 'transcode.videoStrategy', 'all')

    const finalSettings = await teamService.getSettings(team.id)
    expect(finalSettings).toEqual({
      theme: 'dark',
      transcode: { videoStrategy: 'all' },
      semanticSearchEnabled: false,
    })
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
    expect(settings.pendingDomains).toEqual([])

    // Should update settings
    const updated = await teamService.updateSandboxSettings(team.id, {
      allowedDomains: ['example.com'],
      pendingDomains: ['pending.com'],
    })
    expect(updated.allowedDomains).toEqual(['example.com'])
    expect(updated.pendingDomains).toEqual(['pending.com'])

    // Should persist to DB
    const persisted = await teamService.getSandboxSettings(team.id)
    expect(persisted.allowedDomains).toEqual(['example.com'])
    expect(persisted.pendingDomains).toEqual(['pending.com'])
  })

  it('should return empty allowedDomains if sandbox is missing for old team', async () => {
    const team = await prisma.team.create({
      data: { name: 'Old Team' },
    })

    const settings = await teamService.getSandboxSettings(team.id)
    expect(settings.allowedDomains).toEqual([])
    expect(settings.pendingDomains).toEqual([])
  })
})
