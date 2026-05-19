import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { ProjectService } from './project'
import { s3Service } from '@/services/s3/s3'

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    presign: vi.fn(),
  },
}))

describe('ProjectService', () => {
  setupTestDbHooks()
  let projectService: ProjectService

  beforeEach(() => {
    projectService = new ProjectService()
    vi.mocked(s3Service.presign).mockResolvedValue('http://s3/presigned')
  })

  describe('listProjects scoping', () => {
    it('team scope user sees all projects', async () => {
      const team = await prisma.team.create({ data: { name: 'Team A' } })

      await prisma.project.create({ data: { name: 'P1', teamId: team.id } })
      await prisma.project.create({ data: { name: 'P2', teamId: team.id } })
      await prisma.project.create({ data: { name: 'P3', teamId: team.id } })

      const u1 = await prisma.user.create({ data: { name: 'u1', email: 'u1@example.com' } })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: u1.id, role: 'editor', scope: 'team' },
      })

      const res = await projectService.listProjects({
        teamId: team.id,
        userId: u1.id,
        pagination: {},
      })
      expect(res.data).toHaveLength(3)
      const names = res.data.map((p) => p.name).sort()
      expect(names).toEqual(['P1', 'P2', 'P3'])
    })

    it('project scope user sees only assigned projects', async () => {
      const team = await prisma.team.create({ data: { name: 'Team B' } })

      const p1 = await prisma.project.create({ data: { name: 'P1', teamId: team.id } })
      const p2 = await prisma.project.create({ data: { name: 'P2', teamId: team.id } })
      await prisma.project.create({ data: { name: 'P3', teamId: team.id } })

      const u2 = await prisma.user.create({ data: { name: 'u2', email: 'u2@example.com' } })
      const tm2 = await prisma.teamMember.create({
        data: { teamId: team.id, userId: u2.id, role: 'reviewer', scope: 'project' },
      })

      await prisma.projectMember.create({
        data: { projectId: p1.id, teamMemberId: tm2.id, role: 'reviewer' },
      })
      await prisma.projectMember.create({
        data: { projectId: p2.id, teamMemberId: tm2.id, role: 'reviewer' },
      })

      const res = await projectService.listProjects({
        teamId: team.id,
        userId: u2.id,
        pagination: {},
      })
      expect(res.data).toHaveLength(2)
      const names = res.data.map((p) => p.name).sort()
      expect(names).toEqual(['P1', 'P2'])
    })

    it('user not in team fails', async () => {
      const team = await prisma.team.create({ data: { name: 'Team C' } })
      const u3 = await prisma.user.create({ data: { name: 'u3', email: 'u3@example.com' } })

      await expect(
        projectService.listProjects({ teamId: team.id, userId: u3.id, pagination: {} }),
      ).rejects.toThrow('failed to get team member')
    })
  })

  describe('listProjects sorting', () => {
    it('sorts projects by name and creation time', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Sort' } })

      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000)

      await prisma.project.create({ data: { name: 'A', teamId: team.id, createdAt: twoHoursAgo } })
      await prisma.project.create({ data: { name: 'C', teamId: team.id, createdAt: oneHourAgo } })
      await prisma.project.create({
        data: { name: 'B', teamId: team.id, createdAt: thirtyMinsAgo },
      })

      const u = await prisma.user.create({ data: { name: 'u', email: 'u@example.com' } })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: u.id, role: 'editor', scope: 'team' },
      })

      // Default Sort (Name ASC)
      let res = await projectService.listProjects({ teamId: team.id, userId: u.id, pagination: {} })
      expect(res.data).toHaveLength(3)
      expect(res.data[0].name).toBe('A')
      expect(res.data[1].name).toBe('B')
      expect(res.data[2].name).toBe('C')

      // Sort by CreatedAt DESC
      res = await projectService.listProjects({
        teamId: team.id,
        userId: u.id,
        sortBy: 'created_at',
        sortDirection: 'desc',
        pagination: {},
      })
      expect(res.data).toHaveLength(3)
      expect(res.data[0].name).toBe('B') // Newest
      expect(res.data[1].name).toBe('C')
      expect(res.data[2].name).toBe('A') // Oldest

      // Sort by CreatedAt ASC
      res = await projectService.listProjects({
        teamId: team.id,
        userId: u.id,
        sortBy: 'created_at',
        sortDirection: 'asc',
        pagination: {},
      })
      expect(res.data).toHaveLength(3)
      expect(res.data[0].name).toBe('A') // Oldest
      expect(res.data[1].name).toBe('C')
      expect(res.data[2].name).toBe('B') // Newest
    })
  })

  describe('listProjectMembers', () => {
    it('should filter bots in project members', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Bot' } })
      const project = await prisma.project.create({ data: { name: 'P1', teamId: team.id } })

      const human = await prisma.user.create({
        data: { name: 'Human', email: `human-${Date.now()}@example.com`, password: 'pw' },
      })
      const bot = await prisma.user.create({
        data: {
          name: 'Bot',
          email: `bot-${Date.now()}@example.com`,
          password: 'pw',
          type: 'agent',
          agent: {
            create: {
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

      const tmHuman = await prisma.teamMember.create({
        data: { teamId: team.id, userId: human.id, role: 'editor', scope: 'team' },
      })
      const tmBot = await prisma.teamMember.create({
        data: { teamId: team.id, userId: bot.id, role: 'editor', scope: 'team' },
      })

      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: tmHuman.id, role: 'editor' },
      })
      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: tmBot.id, role: 'editor' },
      })

      // Should hide bots by default
      const members = await projectService.listProjectMembers({
        projectId: project.id,
      })
      expect(members).toHaveLength(1)
      expect(members[0].id).toBe(human.id)

      // Should include bots if requested
      const allMembers = await projectService.listProjectMembers({
        projectId: project.id,
        includeAgents: true,
      })
      expect(allMembers).toHaveLength(2)
    })
  })

  describe('createProject', () => {
    it('creates a project with a share_root folder', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Share' } })
      const u = await prisma.user.create({ data: { name: 'u', email: 'share@example.com' } })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: u.id, role: 'owner' },
      })

      const project = await projectService.createProject(u, {
        name: 'Project with Share',
        teamId: team.id,
      })

      expect(project.id).toBeDefined()

      const p = await prisma.project.findUnique({
        where: { id: project.id },
        include: { shareRoot: true },
      })
      expect(p?.shareRootId).toBeDefined()
      expect(p?.shareRoot?.type).toBe('share_root')
      expect(p?.shareRoot?.name).toBe('share_root')
    })
  })
})
