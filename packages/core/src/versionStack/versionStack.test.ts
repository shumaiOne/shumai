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
          sortIndex: 'abc',
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
      expect(Number(stack.sizeByte)).toBe(300)
      expect(stack.parentId).toBe(parent.id)
      expect(stack.sortIndex).toBe('abc')

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

  describe('removeVersionFromStack', () => {
    it('removes a version from a 3-version stack and turns it into a standalone file adjacent to the stack', async () => {
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
          fileCount: 3,
        },
      })

      const file1 = await prisma.asset.create({
        data: {
          name: 'file1.txt',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 100,
          sortIndex: 'a0',
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
      const file3 = await prisma.asset.create({
        data: {
          name: 'file3.txt',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 300,
        },
      })

      const stack = await service.createVersionStack({
        fileIds: [file1.id, file2.id, file3.id],
        projectId: proj.id,
        creatorId: user.id,
      })

      // Stack should have 3 versions
      expect(stack.fileCount).toBe(3)
      expect(Number(stack.sizeByte)).toBe(600)

      // Parent fileCount should be 1 (the stack)
      const parentBefore = await prisma.asset.findUnique({ where: { id: parent.id } })
      expect(parentBefore?.fileCount).toBe(1)

      // Remove file2 from stack
      await service.removeVersionFromStack({
        stackId: stack.id,
        fileId: file2.id,
      })

      // File2 should now be in parent folder
      const updatedFile2 = await prisma.asset.findUnique({ where: { id: file2.id } })
      expect(updatedFile2?.parentId).toBe(parent.id)
      expect(updatedFile2?.sortIndex).toBeDefined()
      expect(updatedFile2!.sortIndex! > stack.sortIndex!).toBe(true)

      // Parent fileCount should be 2 (stack + file2)
      const updatedParent = await prisma.asset.findUnique({ where: { id: parent.id } })
      expect(updatedParent?.fileCount).toBe(2)

      // Stack should still exist with 2 versions (file1 and file3)
      const updatedStack = await prisma.asset.findUnique({ where: { id: stack.id } })
      expect(updatedStack).toBeDefined()
      expect(updatedStack?.fileCount).toBe(2)
      expect(Number(updatedStack?.sizeByte)).toBe(400)

      const remainingChildren = await prisma.asset.findMany({
        where: { parentId: stack.id },
      })
      expect(remainingChildren).toHaveLength(2)
      expect(remainingChildren.map((c) => c.id).sort()).toEqual([file1.id, file3.id].sort())
    })

    it('dissolves the version stack when removing down to 1 remaining version', async () => {
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

      const file1 = await prisma.asset.create({
        data: {
          name: 'file1.txt',
          type: AssetType.file,
          parentId: parent.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 100,
          sortIndex: 'a0',
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

      const stack = await service.createVersionStack({
        fileIds: [file1.id, file2.id],
        projectId: proj.id,
        creatorId: user.id,
      })

      // Remove file2 from stack
      await service.removeVersionFromStack({
        stackId: stack.id,
        fileId: file2.id,
      })

      // Stack asset should be deleted
      const deletedStack = await prisma.asset.findUnique({ where: { id: stack.id } })
      expect(deletedStack).toBeNull()

      // File1 should now be in parent folder and inherited stack's sortIndex
      const updatedFile1 = await prisma.asset.findUnique({ where: { id: file1.id } })
      expect(updatedFile1?.parentId).toBe(parent.id)
      expect(updatedFile1?.sortIndex).toBe('a0')

      // File2 should also be in parent folder
      const updatedFile2 = await prisma.asset.findUnique({ where: { id: file2.id } })
      expect(updatedFile2?.parentId).toBe(parent.id)

      // Parent fileCount should be 2
      const updatedParent = await prisma.asset.findUnique({ where: { id: parent.id } })
      expect(updatedParent?.fileCount).toBe(2)
    })

    it('updates share link symlinks when normal asset becomes version stack and when stack dissolves back to normal asset', async () => {
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
      const shareRoot = await prisma.asset.create({
        data: {
          name: 'share-root',
          type: AssetType.share_root,
          status: 'uploaded',
          projectId: proj.id,
          creatorId: user.id,
          fileCount: 0,
        },
      })
      const shareLink = await prisma.shareLink.create({
        data: {
          name: 'My Share',
          projectId: proj.id,
          rootFolderId: shareRoot.id,
          creatorId: user.id,
        },
      })

      const file1 = await prisma.asset.create({
        data: {
          name: 'file1.txt',
          type: AssetType.file,
          parentId: root.id,
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
          parentId: root.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 200,
        },
      })

      // Add file1 to share link (create symlink)
      const symlink = await prisma.asset.create({
        data: {
          name: file1.name,
          type: AssetType.symlink,
          parentId: shareLink.rootFolderId,
          targetId: file1.id,
          projectId: proj.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      // 1. Group file1 and file2 into a version stack
      const stack = await service.createVersionStack({
        fileIds: [file1.id, file2.id],
        projectId: proj.id,
        creatorId: user.id,
      })

      // Symlink in share link should now point to stack.id
      const symlinkAfterStack = await prisma.asset.findUnique({ where: { id: symlink.id } })
      expect(symlinkAfterStack?.targetId).toBe(stack.id)

      // 2. Remove file2 from stack -> stack dissolves -> only file1 remains
      await service.removeVersionFromStack({
        stackId: stack.id,
        fileId: file2.id,
      })

      // Symlink in share link should now point directly to file1.id
      const symlinkAfterDissolve = await prisma.asset.findUnique({ where: { id: symlink.id } })
      expect(symlinkAfterDissolve?.targetId).toBe(file1.id)
    })
  })
})
