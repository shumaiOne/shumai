import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { ProjectService } from './project'
import { s3Service } from '@shumai/core/src/s3/s3'
import { assetService } from '@shumai/core/src/asset/asset'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    presign: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(1),
    deletePrefix: vi.fn().mockResolvedValue(1),
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

    it('filters agent bots by the requester effective project role', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Bot Filter' } })
      const project = await prisma.project.create({ data: { name: 'P2', teamId: team.id } })

      const createChatAgent = async (name: string, permission: 'owner' | 'editor' | 'reviewer') => {
        const bot = await prisma.user.create({
          data: { name, email: `${name}-${Date.now()}@example.com`, password: 'pw', type: 'agent' },
        })
        await prisma.teamMember.create({
          data: { teamId: team.id, userId: bot.id, role: 'editor', scope: 'team' },
        })
        await prisma.agent.create({
          data: {
            id: bot.id,
            teamId: team.id,
            type: 'chat',
            enabled: true,
            permission,
            config: { provider: 'google', model: 'gemini' },
          },
        })
      }

      await createChatAgent('Reviewer Bot', 'reviewer')
      await createChatAgent('Editor Bot', 'editor')

      // Project-scoped requester invited as reviewer: sees only reviewer bots
      const requester = await prisma.user.create({
        data: { name: 'Req', email: `req-${Date.now()}@example.com`, password: 'pw' },
      })
      const requesterTm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: requester.id, role: 'reviewer', scope: 'project' },
      })
      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: requesterTm.id, role: 'reviewer' },
      })

      const members = await projectService.listProjectMembers({
        projectId: project.id,
        includeAgents: true,
        requesterUserId: requester.id,
      })
      const agentNames = members.filter((m) => m.id !== requester.id).map((m) => m.name)
      expect(agentNames).toContain('Reviewer Bot')
      expect(agentNames).not.toContain('Editor Bot')
    })

    it('should allow upserting custom role override for team-scoped members via updateMemberRole', async () => {
      const team = await prisma.team.create({ data: { name: 'Team Scope Test' } })
      const project = await prisma.project.create({ data: { name: 'Project A', teamId: team.id } })

      const teamEditor = await prisma.user.create({
        data: { name: 'User B', email: `userb-${Date.now()}@example.com`, password: 'pw' },
      })

      await prisma.teamMember.create({
        data: { teamId: team.id, userId: teamEditor.id, role: 'editor', scope: 'team' },
      })

      // Initially in listProjectMembers with default team role and hasCustomRole = false
      const initialMembers = await projectService.listProjectMembers({
        projectId: project.id,
      })
      expect(initialMembers).toHaveLength(1)
      expect(initialMembers[0].id).toBe(teamEditor.id)
      expect(initialMembers[0].role).toBe('editor')
      expect(initialMembers[0].hasCustomRole).toBe(false)

      // Set custom role for User B on project A
      await projectService.updateMemberRole({
        projectId: project.id,
        userId: teamEditor.id,
        role: 'reviewer',
      })

      // Now User B should have hasCustomRole = true and role = 'reviewer'
      const updatedMembers = await projectService.listProjectMembers({
        projectId: project.id,
      })
      expect(updatedMembers).toHaveLength(1)
      expect(updatedMembers[0].id).toBe(teamEditor.id)
      expect(updatedMembers[0].role).toBe('reviewer')
      expect(updatedMembers[0].hasCustomRole).toBe(true)
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

  describe('deleteProject', () => {
    it('detaches and soft-deletes project assets', async () => {
      const team = await prisma.team.create({ data: { name: 'Delete Team' } })
      const u = await prisma.user.create({ data: { name: 'u', email: 'delete@example.com' } })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: u.id, role: 'owner' },
      })

      const project = await projectService.createProject(u, {
        name: 'Project to Delete',
        teamId: team.id,
      })

      // Add some related data
      const asset = await prisma.asset.create({
        data: {
          name: 'Test Asset',
          type: 'file',
          status: 'processed',
          project: { connect: { id: project.id } },
          storageKey: {
            connectOrCreate: {
              where: { key: 'asset-key' },
              create: { key: 'asset-key' },
            },
          },
        },
      })

      // Set cover image key
      await prisma.project.update({
        where: { id: project.id },
        data: { coverImageKey: 'cover-key' },
      })

      // Delete project
      await projectService.deleteProject(project.id)

      // Verify project is deleted
      const p = await prisma.project.findUnique({ where: { id: project.id } })
      expect(p).toBeNull()

      // Verify asset is soft-deleted and detached
      const a = await prisma.asset.findUnique({ where: { id: asset.id } })
      expect(a).toBeDefined()
      expect(a?.isDeleted).toBe(true)
      expect(a?.projectId).toBeNull()
      expect(a?.parentId).toBeNull()

      // Verify S3 project cover cleanup (synchronous)
      expect(s3Service.deleteObject).toHaveBeenCalledWith(expect.any(String), 'cover-key')
      // S3 asset key cleanup is NOT called synchronously
      expect(s3Service.deleteObject).not.toHaveBeenCalledWith(expect.any(String), 'asset-key')
    })

    it('cleans up nested hierarchy asynchronously in background job', async () => {
      const team = await prisma.team.create({ data: { name: 'Nested Team' } })
      const u = await prisma.user.create({ data: { name: 'u', email: 'nested@example.com' } })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: u.id, role: 'owner' },
      })

      const project = await projectService.createProject(u, {
        name: 'Nested Project',
        teamId: team.id,
      })

      const projectDb = await prisma.project.findUnique({ where: { id: project.id } })

      // Create hierarchy: Folder A -> Folder B -> File C
      const folderA = await prisma.asset.create({
        data: {
          name: 'Folder A',
          type: 'folder',
          status: 'processed',
          projectId: project.id,
          parentId: projectDb!.rootFolderId,
        },
      })
      const folderB = await prisma.asset.create({
        data: {
          name: 'Folder B',
          type: 'folder',
          status: 'processed',
          projectId: project.id,
          parentId: folderA.id,
        },
      })
      const fileC = await prisma.asset.create({
        data: {
          name: 'File C',
          type: 'file',
          status: 'processed',
          project: { connect: { id: project.id } },
          parent: { connect: { id: folderB.id } },
          storageKey: {
            connectOrCreate: {
              where: { key: 'file-c-key' },
              create: { key: 'file-c-key' },
            },
          },
        },
      })

      // Add metadata and comments to verify cascade
      await prisma.assetMetadataValue.create({
        data: {
          assetId: fileC.id,
          fieldKey: 'test-field',
          stringValue: 'test-value',
        },
      })
      const comment = await prisma.assetComment.create({
        data: {
          assetId: fileC.id,
          message: 'Test comment',
        },
      })

      // Delete project
      await projectService.deleteProject(project.id)

      // Manually trigger the private cleanup methods for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).expireTrashedAssets()
      // Trigger the purge job
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgePendingAssets()

      // Manually set storage key createdAt to the past so GC picks it up
      await prisma.storageKey.updateMany({
        data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      })

      // Trigger GC job
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgeUnreferencedStorageKeys()

      // Verify everything is wiped from DB
      expect(await prisma.project.findUnique({ where: { id: project.id } })).toBeNull()
      expect(await prisma.asset.findUnique({ where: { id: folderA.id } })).toBeNull()
      expect(await prisma.asset.findUnique({ where: { id: folderB.id } })).toBeNull()
      expect(await prisma.asset.findUnique({ where: { id: fileC.id } })).toBeNull()

      // Verify cascade
      expect(
        await prisma.assetMetadataValue.findUnique({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          where: { assetId_fieldKey: { assetId: fileC.id, fieldKey: 'test-field' } },
        }),
      ).toBeNull()
      expect(await prisma.assetComment.findUnique({ where: { id: comment.id } })).toBeNull()

      // Verify S3 cleanup for file
      expect(s3Service.deleteObject).toHaveBeenCalledWith(expect.any(String), 'file-c-key')
    })
  })

  describe('getUserProjects', () => {
    it('team-scoped member sees all projects in team', async () => {
      const team = await prisma.team.create({ data: { name: 'GUP Team A' } })
      await prisma.project.create({ data: { name: 'P1', teamId: team.id } })
      await prisma.project.create({ data: { name: 'P2', teamId: team.id } })
      await prisma.project.create({ data: { name: 'P3', teamId: team.id } })

      const user = await prisma.user.create({
        data: { name: 'gup-u1', email: 'gup-u1@example.com' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'editor', scope: 'team' },
      })

      const result = await projectService.getUserProjects(user.id)
      expect(result).toHaveLength(3)
      const names = result.map((p) => p.name).sort()
      expect(names).toEqual(['P1', 'P2', 'P3'])
    })

    it('project-scoped member sees only assigned projects', async () => {
      const team = await prisma.team.create({ data: { name: 'GUP Team B' } })
      const p1 = await prisma.project.create({ data: { name: 'P1', teamId: team.id } })
      const p2 = await prisma.project.create({ data: { name: 'P2', teamId: team.id } })
      await prisma.project.create({ data: { name: 'P3', teamId: team.id } })

      const user = await prisma.user.create({
        data: { name: 'gup-u2', email: 'gup-u2@example.com' },
      })
      const tm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'reviewer', scope: 'project' },
      })
      await prisma.projectMember.create({
        data: { projectId: p1.id, teamMemberId: tm.id, role: 'reviewer' },
      })
      await prisma.projectMember.create({
        data: { projectId: p2.id, teamMemberId: tm.id, role: 'reviewer' },
      })

      const result = await projectService.getUserProjects(user.id)
      expect(result).toHaveLength(2)
      const names = result.map((p) => p.name).sort()
      expect(names).toEqual(['P1', 'P2'])
    })

    it('aggregates across multiple teams', async () => {
      const teamA = await prisma.team.create({ data: { name: 'GUP Multi A' } })
      const teamB = await prisma.team.create({ data: { name: 'GUP Multi B' } })
      await prisma.project.create({ data: { name: 'PA1', teamId: teamA.id } })
      await prisma.project.create({ data: { name: 'PB1', teamId: teamB.id } })

      const user = await prisma.user.create({
        data: { name: 'gup-u3', email: 'gup-u3@example.com' },
      })
      await prisma.teamMember.create({
        data: { teamId: teamA.id, userId: user.id, role: 'editor', scope: 'team' },
      })
      await prisma.teamMember.create({
        data: { teamId: teamB.id, userId: user.id, role: 'editor', scope: 'team' },
      })

      const result = await projectService.getUserProjects(user.id)
      expect(result).toHaveLength(2)
      const names = result.map((p) => p.name).sort()
      expect(names).toEqual(['PA1', 'PB1'])
    })

    it('respects limit parameter', async () => {
      const team = await prisma.team.create({ data: { name: 'GUP Limit' } })
      for (let i = 0; i < 5; i++) {
        await prisma.project.create({ data: { name: `PLim${i}`, teamId: team.id } })
      }

      const user = await prisma.user.create({
        data: { name: 'gup-u4', email: 'gup-u4@example.com' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'editor', scope: 'team' },
      })

      const result = await projectService.getUserProjects(user.id, 2)
      expect(result).toHaveLength(2)
    })

    it('returns empty array for user with no teams', async () => {
      const user = await prisma.user.create({
        data: { name: 'gup-u5', email: 'gup-u5@example.com' },
      })

      const result = await projectService.getUserProjects(user.id)
      expect(result).toEqual([])
    })
  })
})
