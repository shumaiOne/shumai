import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { VersionStackService } from './versionStack'
import { AssetType } from '@shumai/db'

describe('VersionStackService', () => {
  setupTestDbHooks()

  let service: VersionStackService

  beforeEach(() => {
    service = new VersionStackService()
  })

  describe('createVersionStack', () => {
    it('creates a version stack and reparents files', async () => {
      // Setup: Create team, project, user, and parent folder
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const proj = await prisma.project.create({
        data: { name: 'Test Project', teamId: team.id },
      })
      const user = await prisma.user.create({
        data: { name: 'Test User', email: `test-${Date.now()}@example.com` },
      })

      const root = await prisma.asset.create({
        data: {
          name: 'root',
          type: AssetType.folder,
          status: 'uploaded',
          projectId: proj.id,
          creatorId: user.id,
        },
      })

      const parent = await prisma.asset.create({
        data: {
          name: 'Parent Folder',
          type: AssetType.folder,
          projectId: proj.id,
          parentId: root.id,
          creatorId: user.id,
          status: 'uploaded',
          fileCount: 2,
        },
      })

      // Setup: Create files
      const file1 = await prisma.asset.create({
        data: {
          name: 'file1.txt',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 100,
        },
      })

      const file2 = await prisma.asset.create({
        data: {
          name: 'file2.txt',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 200,
        },
      })

      // Execute
      const stack = await service.createVersionStack({
        fileIds: [file1.id, file2.id],
        projectId: proj.id,
        creatorId: user.id,
      })

      // Verify Stack
      expect(stack).toBeDefined()
      expect(stack.name).toBe('')
      expect(stack.type).toBe(AssetType.version_stack)
      expect(stack.fileCount).toBe(2)
      expect(stack.sizeByte).toBe(300)
      expect(stack.parentId).toBe(parent.id)

      // Verify Parent file count
      const updatedParent = await prisma.asset.findUnique({ where: { id: parent.id } })
      expect(updatedParent?.fileCount).toBe(1)

      // Verify Files
      const updatedFile1 = await prisma.asset.findUnique({ where: { id: file1.id } })
      expect(updatedFile1?.parentId).toBe(stack.id)
      expect(updatedFile1?.sortIndex).toBeDefined()

      const updatedFile2 = await prisma.asset.findUnique({ where: { id: file2.id } })
      expect(updatedFile2?.parentId).toBe(stack.id)
      expect(updatedFile2?.sortIndex).toBeDefined()
      expect(updatedFile2!.sortIndex! > updatedFile1!.sortIndex!).toBe(true)
    })
  })

  describe('changeStackFileVersion', () => {
    it('changes the order of files in a version stack', async () => {
      // Setup
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const proj = await prisma.project.create({
        data: { name: 'Test Project', teamId: team.id },
      })
      const user = await prisma.user.create({
        data: { name: 'Test User', email: `test-${Date.now()}@example.com` },
      })
      const root = await prisma.asset.create({
        data: {
          name: 'root',
          type: AssetType.folder,
          status: 'uploaded',
          projectId: proj.id,
          creatorId: user.id,
        },
      })
      const parent = await prisma.asset.create({
        data: {
          name: 'Parent',
          type: AssetType.folder,
          projectId: proj.id,
          parentId: root.id,
          creatorId: user.id,
          status: 'uploaded',
          fileCount: 3,
        },
      })

      const file1 = await prisma.asset.create({
        data: {
          name: 'f1',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })
      const file2 = await prisma.asset.create({
        data: {
          name: 'f2',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })
      const file3 = await prisma.asset.create({
        data: {
          name: 'f3',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const stack = await service.createVersionStack({
        fileIds: [file1.id, file2.id, file3.id],
        projectId: proj.id,
        creatorId: user.id,
      })

      // Move file2 to be before file1
      await service.changeStackFileVersion({
        stackId: stack.id,
        fileId: file2.id,
        beforeId: file1.id,
      })

      let children = await prisma.asset.findMany({
        where: { parentId: stack.id },
        orderBy: { sortIndex: 'asc' },
      })

      expect(children).toHaveLength(3)
      expect(children.map((c) => c.id).includes(file1.id)).toBe(true)
      expect(children.map((c) => c.id).includes(file2.id)).toBe(true)
      expect(children.map((c) => c.id).includes(file3.id)).toBe(true)

      // Move file1 to the end (-1)
      await service.changeStackFileVersion({
        stackId: stack.id,
        fileId: file1.id,
        beforeId: '-1',
      })

      children = await prisma.asset.findMany({
        where: { parentId: stack.id },
        orderBy: { sortIndex: 'asc' },
      })

      expect(children).toHaveLength(3)
      expect(children.map((c) => c.id).includes(file1.id)).toBe(true)
      expect(children.map((c) => c.id).includes(file2.id)).toBe(true)
      expect(children.map((c) => c.id).includes(file3.id)).toBe(true)
    })
  })
})
