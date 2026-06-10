import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'

import { AssetType, AssetStatus, Prisma } from '@shumai/db'
import { AssetService } from './asset'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    presign: vi.fn().mockResolvedValue('http://mock-s3-url'),
    putObject: vi.fn().mockResolvedValue(undefined),
    deleteObject: vi.fn().mockResolvedValue(1),
    deletePrefix: vi.fn().mockResolvedValue(1),
    copyObject: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('AssetService', () => {
  setupTestDbHooks()

  let assetService: AssetService

  beforeEach(async () => {
    assetService = new AssetService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const setupBasicAssets = async () => {
    const user = await prisma.user.create({
      data: {
        name: 'TestUser_Asset_' + Date.now(),
        type: 'human',
        email: `test-${Date.now()}@example.com`,
      },
    })
    const team = await prisma.team.create({
      data: { name: 'TestTeam_Asset_' + Date.now() },
    })
    const project = await prisma.project.create({
      data: { name: 'TestProject_Asset', teamId: team.id },
    })
    const team2 = await prisma.team.create({
      data: { name: 'TestTeam2_Asset_' + Date.now() },
    })
    const project2 = await prisma.project.create({
      data: { name: 'TestProject2_Asset', teamId: team2.id },
    })
    const project3 = await prisma.project.create({
      data: { name: 'TestProject3_Asset', teamId: team.id },
    })

    const root = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.folder,
        projectId: project.id,
        creatorId: user.id,
        fileCount: 3,
        sizeByte: 960,
        status: 'uploaded',
      },
    })

    const folderA = await prisma.asset.create({
      data: {
        name: 'folderA',
        type: AssetType.folder,
        projectId: project.id,
        parentId: root.id,
        creatorId: user.id,
        fileCount: 2,
        sizeByte: 300,
        status: 'uploaded',
      },
    })

    const fileA1 = await prisma.asset.create({
      data: {
        name: 'fileA1',
        type: AssetType.file,
        projectId: project.id,
        parentId: folderA.id,
        creatorId: user.id,
        sizeByte: 100,
        status: 'uploaded',
      },
    })

    const fileA2 = await prisma.asset.create({
      data: {
        name: 'fileA2',
        type: AssetType.file,
        projectId: project.id,
        parentId: folderA.id,
        creatorId: user.id,
        sizeByte: 200,
        status: 'uploaded',
      },
    })

    const folderB = await prisma.asset.create({
      data: {
        name: 'folderB',
        type: AssetType.folder,
        projectId: project.id,
        parentId: root.id,
        creatorId: user.id,
        fileCount: 2,
        sizeByte: 410,
        status: 'uploaded',
      },
    })

    const stackB = await prisma.asset.create({
      data: {
        name: 'stackB',
        type: AssetType.version_stack,
        projectId: project.id,
        parentId: folderB.id,
        creatorId: user.id,
        fileCount: 2,
        sizeByte: 110,
        status: 'uploaded',
      },
    })

    const fileB1v1 = await prisma.asset.create({
      data: {
        name: 'fileB1v1',
        type: AssetType.file,
        projectId: project.id,
        parentId: stackB.id,
        creatorId: user.id,
        sizeByte: 50,
        sortIndex: 'a0',
        status: 'uploaded',
      },
    })

    const fileB1v2 = await prisma.asset.create({
      data: {
        name: 'fileB1v2',
        type: AssetType.file,
        projectId: project.id,
        parentId: stackB.id,
        creatorId: user.id,
        sizeByte: 60,
        sortIndex: 'a1',
        status: 'uploaded',
      },
    })

    const fileB2 = await prisma.asset.create({
      data: {
        name: 'fileB2',
        type: AssetType.file,
        projectId: project.id,
        parentId: folderB.id,
        creatorId: user.id,
        sizeByte: 300,
        status: 'uploaded',
      },
    })

    const fileRoot1 = await prisma.asset.create({
      data: {
        name: 'fileRoot1',
        type: AssetType.file,
        projectId: project.id,
        parentId: root.id,
        creatorId: user.id,
        sizeByte: 250,
        status: 'uploaded',
      },
    })

    const root2 = await prisma.asset.create({
      data: {
        name: 'root2',
        type: AssetType.folder,
        projectId: project2.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    const root3 = await prisma.asset.create({
      data: {
        name: 'root3',
        type: AssetType.folder,
        projectId: project3.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    return {
      user,
      project,
      assets: {
        root,
        folderA,
        fileA1,
        fileA2,
        folderB,
        stackB,
        fileB1v1,
        fileB1v2,
        fileB2,
        fileRoot1,
        root2,
        root3,
      },
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verifyAsset = async (id: string, expected: any) => {
    const a = await prisma.asset.findUnique({ where: { id } })
    expect(a).toBeDefined()
    if (!a) return

    if (expected.name !== undefined) expect(a.name).toBe(expected.name)
    expect(a.type).toBe(expected.type)
    expect(a.fileCount).toBe(expected.fileCount)
    expect(a.sizeByte).toBe(expected.size)
  }

  it('can create a folder and list children', async () => {
    const { project } = await setupBasicAssets()

    const rootFolder = await assetService.createAsset({
      name: 'Root Folder',
      type: 'folder',
      projectId: project.id,
    })

    expect(rootFolder.id).toBeDefined()
    expect(rootFolder.name).toBe('Root Folder')

    const childFile = await assetService.createAsset({
      name: 'Child File.txt',
      type: 'file',
      parentId: rootFolder.id,
      contentType: 'text/plain',
      sizeByte: 1024,
    })

    const children = await assetService.listChildren({
      assetId: rootFolder.id,
      assetType: 'file',
      first: 10,
    })

    expect(children.data.length).toBe(1)
    expect(children.data[0].id).toBe(childFile.id)
  })

  it('handles reparenting - Case 1: move into sibling folder', async () => {
    const { user, assets } = await setupBasicAssets()
    await assetService.reparentAssets({
      assetIds: [assets.fileRoot1.id],
      newParentId: assets.folderA.id,
      creatorId: user.id,
    })
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 2,
      size: 960,
    })
    await verifyAsset(assets.folderA.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 550,
    })
  })

  it('handles reparenting - Case 2: move out to immediate parent', async () => {
    const { user, assets } = await setupBasicAssets()
    await assetService.reparentAssets({
      assetIds: [assets.fileA1.id],
      newParentId: assets.root.id,
      creatorId: user.id,
    })
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 4,
      size: 960,
    })
    await verifyAsset(assets.folderA.id, {
      type: AssetType.folder,
      fileCount: 1,
      size: 200,
    })
  })

  it('handles reparenting - Case 3: generic move', async () => {
    const { user, assets } = await setupBasicAssets()
    await assetService.reparentAssets({
      assetIds: [assets.fileA1.id],
      newParentId: assets.folderB.id,
      creatorId: user.id,
    })
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 960,
    })
    await verifyAsset(assets.folderA.id, {
      type: AssetType.folder,
      fileCount: 1,
      size: 200,
    })
    await verifyAsset(assets.folderB.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 510,
    })
  })

  it('handles reparenting - Error: move across teams', async () => {
    const { user, assets } = await setupBasicAssets()
    await expect(
      assetService.reparentAssets({
        assetIds: [assets.fileA1.id],
        newParentId: assets.root2.id,
        creatorId: user.id,
      }),
    ).rejects.toThrow('Cannot move asset')
  })

  it('handles reparenting - Success: move across projects in same team', async () => {
    const { user, assets } = await setupBasicAssets()
    await assetService.reparentAssets({
      assetIds: [assets.fileA1.id],
      newParentId: assets.root3.id,
      creatorId: user.id,
    })
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 860,
    })
    await verifyAsset(assets.folderA.id, {
      type: AssetType.folder,
      fileCount: 1,
      size: 200,
    })
    await verifyAsset(assets.root3.id, {
      type: AssetType.folder,
      fileCount: 1,
      size: 100,
    })
  })

  it('handles copying assets recursively', async () => {
    const { user, assets } = await setupBasicAssets()

    await assetService.copyAssets({
      assetIds: [assets.folderA.id],
      newParentId: assets.root3.id,
      creatorId: user.id,
      withComments: false,
    })

    // Verify root3 now has 1 more folder
    await verifyAsset(assets.root3.id, {
      type: AssetType.folder,
      fileCount: 1,
      size: 300,
    })

    // Verify children of folderA were copied
    const copiedFolders = await prisma.asset.findMany({
      where: { parentId: assets.root3.id, name: 'folderA' },
    })
    expect(copiedFolders.length).toBe(1)
    const newFolderA = copiedFolders[0]

    const children = await prisma.asset.findMany({
      where: { parentId: newFolderA.id },
    })
    expect(children.length).toBe(2)
    expect(children.map((c) => c.name)).toContain('fileA1')
    expect(children.map((c) => c.name)).toContain('fileA2')
  })

  it('handles copying assets with comments and attachments', async () => {
    const { user, assets, project } = await setupBasicAssets()

    // Create a comment with attachment on fileA1
    const attachmentAsset = await prisma.asset.create({
      data: {
        name: 'attach.png',
        type: AssetType.attachment,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
        sizeByte: 50,
      },
    })

    const comment = await prisma.assetComment.create({
      data: {
        assetId: assets.fileA1.id,
        creatorId: user.id,
        message: 'Original Comment',
      },
    })

    await prisma.assetCommentAttachment.create({
      data: {
        commentId: comment.id,
        assetId: attachmentAsset.id,
      },
    })

    await assetService.copyAssets({
      assetIds: [assets.fileA1.id],
      newParentId: assets.root3.id,
      creatorId: user.id,
      withComments: true,
    })

    // Find the copied file
    const copiedFiles = await prisma.asset.findMany({
      where: { parentId: assets.root3.id, name: 'fileA1' },
    })
    expect(copiedFiles.length).toBe(1)
    const newFileA1 = copiedFiles[0]

    // Verify comments were copied
    const newComments = await prisma.assetComment.findMany({
      where: { assetId: newFileA1.id },
      include: { attachments: { include: { asset: true } } },
    })
    expect(newComments.length).toBe(1)
    expect(newComments[0].message).toBe('Original Comment')
    expect(newComments[0].attachments.length).toBe(1)

    // Verify attachment asset was deep copied
    const newAttachmentAsset = newComments[0].attachments[0].asset
    expect(newAttachmentAsset.id).not.toBe(attachmentAsset.id)
    expect(newAttachmentAsset.name).toBe('attach.png')
    expect(newAttachmentAsset.type).toBe(AssetType.attachment)
  })

  it('rejects copying a folder into its own descendant', async () => {
    const { user, assets } = await setupBasicAssets()

    // Create a subfolder inside folderA
    const subfolder = await prisma.asset.create({
      data: {
        name: 'subfolder',
        type: AssetType.folder,
        projectId: assets.folderA.projectId,
        parentId: assets.folderA.id,
        status: 'uploaded',
      },
    })

    await expect(
      assetService.copyAssets({
        assetIds: [assets.folderA.id],
        newParentId: subfolder.id,
        creatorId: user.id,
        withComments: false,
      }),
    ).rejects.toThrow('Cannot copy a folder into its own descendant')
  })

  it('uses destination project when copying comment attachments', async () => {
    const { user, assets, project } = await setupBasicAssets()

    // Set up project 2
    const project2 = await prisma.project.create({
      data: { name: 'Project 2', teamId: project.teamId },
    })
    const root2 = await prisma.asset.create({
      data: { name: 'root2', type: AssetType.folder, projectId: project2.id, status: 'uploaded' },
    })

    // Create a comment with attachment on fileA1
    const attachmentAsset = await prisma.asset.create({
      data: {
        name: 'attach.png',
        type: AssetType.attachment,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
        sizeByte: 50,
      },
    })

    const comment = await prisma.assetComment.create({
      data: {
        assetId: assets.fileA1.id,
        creatorId: user.id,
        message: 'Original Comment',
      },
    })

    await prisma.assetCommentAttachment.create({
      data: {
        commentId: comment.id,
        assetId: attachmentAsset.id,
      },
    })

    // Copy to project 2
    await assetService.copyAssets({
      assetIds: [assets.fileA1.id],
      newParentId: root2.id,
      creatorId: user.id,
      withComments: true,
    })

    // Find the copied file in project 2
    const newFileA1 = await prisma.asset.findFirstOrThrow({
      where: { parentId: root2.id, name: 'fileA1' },
    })

    // Verify comments were copied
    const newComments = await prisma.assetComment.findMany({
      where: { assetId: newFileA1.id },
      include: { attachments: { include: { asset: true } } },
    })
    expect(newComments.length).toBe(1)

    // Verify attachment asset belongs to PROJECT 2
    const newAttachmentAsset = newComments[0].attachments[0].asset
    expect(newAttachmentAsset.projectId).toBe(project2.id)
  })

  it('handles reparenting - Version Stack: move into stack', async () => {
    const { user, assets } = await setupBasicAssets()
    await assetService.reparentAssets({
      assetIds: [assets.fileB2.id],
      newParentId: assets.stackB.id,
      creatorId: user.id,
    })
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 960,
    })
    await verifyAsset(assets.folderB.id, {
      type: AssetType.folder,
      fileCount: 1,
      size: 410,
    })
    await verifyAsset(assets.stackB.id, {
      type: AssetType.version_stack,
      fileCount: 3,
      size: 410,
    })
  })

  describe('fileCount verification', () => {
    it('createAsset should increment parent fileCount', async () => {
      const { user, assets, project } = await setupBasicAssets()

      const parent = assets.folderA
      const initialCount = parent.fileCount // should be 2 from setup (fileA1, fileA2)

      // Create a new folder inside folderA
      await assetService.createAsset({
        name: 'newFolder',
        type: 'folder',
        parentId: parent.id,
        projectId: project.id,
        creatorId: user.id,
      })

      const updatedParent = await prisma.asset.findUnique({ where: { id: parent.id } })
      expect(updatedParent?.fileCount).toBe(initialCount + 1)

      // Create a new file inside folderA
      await assetService.createAsset({
        name: 'newFile',
        type: 'file',
        parentId: parent.id,
        projectId: project.id,
        creatorId: user.id,
      })

      const updatedParent2 = await prisma.asset.findUnique({ where: { id: parent.id } })
      expect(updatedParent2?.fileCount).toBe(initialCount + 2)
    })

    it('reparentAssets should update fileCount when moving folders', async () => {
      const { user, assets } = await setupBasicAssets()

      const sourceParent = assets.root
      const targetParent = assets.folderB
      const folderToMove = assets.folderA

      // folderA is a child of root.
      // root children: folderA, folderB, fileRoot1. count=3.
      // folderB children: stackB, fileB2. count=2.

      await assetService.reparentAssets({
        assetIds: [folderToMove.id],
        newParentId: targetParent.id,
        creatorId: user.id,
      })

      const updatedSourceParent = await prisma.asset.findUnique({ where: { id: sourceParent.id } })
      expect(updatedSourceParent?.fileCount).toBe(2)

      const updatedTargetParent = await prisma.asset.findUnique({ where: { id: targetParent.id } })
      expect(updatedTargetParent?.fileCount).toBe(3)
    })
  })

  it('handles reparenting - Version Stack: dissolve with 1 remaining', async () => {
    const { user, assets } = await setupBasicAssets()
    await assetService.reparentAssets({
      assetIds: [assets.fileB1v1.id],
      newParentId: assets.folderB.id,
      creatorId: user.id,
    })

    const stack = await prisma.asset.findUnique({
      where: { id: assets.stackB.id },
    })
    expect(stack).toBeNull() // Stack should be dissolved

    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 960,
    })
    await verifyAsset(assets.folderB.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 410,
    })
  })

  it('handles soft deleting and restoring assets recursively', async () => {
    const { assets } = await setupBasicAssets()

    // Initially folderA has 2 files and size 300
    // root has 3 files (folderA, folderB, fileRoot1) and size 960
    await assetService.deleteAssets([assets.folderA.id])

    const folderA = await prisma.asset.findUnique({
      where: { id: assets.folderA.id },
    })
    expect(folderA?.isDeleted).toBe(true)

    const fileA1 = await prisma.asset.findUnique({
      where: { id: assets.fileA1.id },
    })
    expect(fileA1?.isDeleted).toBe(true)

    // Verify root size decreased by folderA's size
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 2, // folderA removed from child count
      size: 660, // 960 - 300
    })

    // Restore folderA
    await assetService.restoreAssets([assets.folderA.id])

    const folderRestoredA = await prisma.asset.findUnique({
      where: { id: assets.folderA.id },
    })
    expect(folderRestoredA?.isDeleted).toBe(false)

    expect(folderRestoredA?.deletedAt).toBeNull()

    const fileA1Restored = await prisma.asset.findUnique({
      where: { id: assets.fileA1.id },
    })
    expect(fileA1Restored?.isDeleted).toBe(false)

    // Verify root restored properly
    await verifyAsset(assets.root.id, {
      type: AssetType.folder,
      fileCount: 3,
      size: 960,
    })
  })

  it('can create and list comments', async () => {
    const { user, assets } = await setupBasicAssets()

    const c1 = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'Hello World',
      attachmentIds: [],
    })

    expect(c1.id).toBeDefined()
    expect(c1.message).toBe('Hello World')

    const c2 = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'Reply',
      replyToId: c1.id,
      attachmentIds: [],
    })

    const commentInfo = await assetService.getComment(c1.id)
    expect(commentInfo.replies.length).toBe(1)
    expect(commentInfo.replies[0].id).toBe(c2.id)

    const list = await assetService.listComments(assets.fileA1.id, {
      first: 10,
    })
    expect(list.data.length).toBe(1) // Only parent comments
    expect(list.data[0].id).toBe(c1.id)
    expect(list.data[0].replies.length).toBe(1)
  })

  it('can create and retrieve comments with video timestamp', async () => {
    const { user, assets } = await setupBasicAssets()

    const comment = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'Interesting point at 5.5s',
      second: 5.5,
      attachmentIds: [],
    })

    expect(comment.second).toBe(5.5)

    const retrieved = await assetService.getComment(comment.id)
    expect(retrieved.second).toBe(5.5)

    const list = await assetService.listComments(assets.fileA1.id, {
      first: 10,
    })
    expect(list.data[0].second).toBe(5.5)
  })

  it('correctly handles AI comments with agent identity', async () => {
    const { assets, project } = await setupBasicAssets()

    // Create an agent user
    const agentUser = await prisma.user.create({
      data: {
        id: 'agent-id',
        name: 'Smart Agent',
        email: 'agent@test.com',
        type: 'agent',
      },
    })

    // Create the agent record
    await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: project.teamId,
        type: 'autofill',
        config: {
          provider: 'test',
          model: 'test',
        },
      },
    })

    // Create a real agent session
    const session = await prisma.agentSession.create({
      data: {
        id: 'session-id-123',
        agentId: agentUser.id,
        cwd: process.cwd(),
      },
    })

    // Create an AI comment manually using the activity-like logic
    await prisma.assetComment.create({
      data: {
        assetId: assets.fileA1.id,
        message: 'I am an AI',
        sessionId: session.id,
        creatorId: agentUser.id,
      },
    })

    const list = await assetService.listComments(assets.fileA1.id, {
      first: 10,
    })

    const aiComment = list.data.find((c) => !!c.sessionId)
    expect(aiComment).toBeDefined()
    expect(aiComment?.creator.id).toBe(agentUser.id)
    expect(aiComment?.creator.name).toBe('Smart Agent')
  })

  it('orders comments by id asc', async () => {
    const { user, assets } = await setupBasicAssets()

    const c1 = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'First',
      attachmentIds: [],
    })

    const c2 = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'Second',
      attachmentIds: [],
    })

    const list = await assetService.listComments(assets.fileA1.id, {
      first: 10,
    })

    expect(list.data.length).toBe(2)
    expect(list.data[0].id).toBe(c1.id)
    expect(list.data[1].id).toBe(c2.id)
    expect(list.data[0].message).toBe('First')
    expect(list.data[1].message).toBe('Second')

    // Test replies order
    const r1 = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'Reply 1',
      replyToId: c1.id,
      attachmentIds: [],
    })

    const r2 = await assetService.createComment({
      assetId: assets.fileA1.id,
      userId: user.id,
      message: 'Reply 2',
      replyToId: c1.id,
      attachmentIds: [],
    })

    const c1WithReplies = await assetService.getComment(c1.id)
    expect(c1WithReplies.replies.length).toBe(2)
    expect(c1WithReplies.replies[0].id).toBe(r1.id)
    expect(c1WithReplies.replies[1].id).toBe(r2.id)

    const listWithReplies = await assetService.listComments(assets.fileA1.id, {
      first: 10,
    })
    expect(listWithReplies.data[0].replies.length).toBe(2)
    expect(listWithReplies.data[0].replies[0].id).toBe(r1.id)
    expect(listWithReplies.data[0].replies[1].id).toBe(r2.id)
  })

  it('triggers AI workflow on bot mention', async () => {
    const { user, project } = await setupBasicAssets()

    const file = await prisma.asset.create({
      data: {
        name: 'test-file',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    // Create a bot agent
    const botUser = await prisma.user.create({
      data: {
        name: 'Bot Agent',
        type: 'agent',
        email: 'bot-agent@shumai.ai',
      },
    })
    const agent = await prisma.agent.create({
      data: {
        id: botUser.id,
        teamId: project.teamId,
        type: 'chat',
        config: {
          provider: 'google',
          model: 'gemini-pro',
        },
      },
    })
    await prisma.teamMember.create({
      data: {
        teamId: project.teamId,
        userId: botUser.id,
        role: 'reviewer',
      },
    })

    await assetService.createComment({
      assetId: file.id,
      userId: user.id,
      message: `Hello <@${agent.id}> and <@default>`,
      attachmentIds: [],
    })

    // Check if AI placeholder comments were NOT created here (moved to workflow)
    const comments = await prisma.assetComment.findMany({
      where: { assetId: file.id, sessionId: { not: null } },
    })
    expect(comments.length).toBe(0)

    // Check if workflow tasks were created
    const tasks = await prisma.workflowTask.findMany({
      where: { assetId: file.id, type: 'chat' },
    })
    expect(tasks.length).toBe(2)
    expect(tasks.some((t) => t.payload?.agent?.agentId === agent.id)).toBe(true)
    expect(tasks.some((t) => t.payload?.agent?.agentId === 'default')).toBe(true)
  })

  it('implements agent comment interaction rules (Rule 1, 2, 3)', async () => {
    const { user, project } = await setupBasicAssets()
    const file = await prisma.asset.create({
      data: {
        name: 'rules-file',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    const botUser = await prisma.user.create({
      data: {
        name: 'Bot Agent',
        type: 'agent',
        email: 'rule-bot@shumai.ai',
      },
    })
    const agent = await prisma.agent.create({
      data: {
        id: botUser.id,
        teamId: project.teamId,
        type: 'chat',
        config: {
          provider: 'google',
          model: 'gemini-pro',
        },
      },
    })

    // Rule 1: user mentions agent in chat, and it's not in a reply
    const c1 = await assetService.createComment({
      assetId: file.id,
      userId: user.id,
      message: `Rule 1 test: Hello <@${agent.id}>`,
      attachmentIds: [],
    })

    const tasksRule1 = await prisma.workflowTask.findMany({
      where: { assetId: file.id, payload: { path: ['agent', 'userCommentId'], equals: c1.id } },
    })
    expect(tasksRule1.length).toBe(1)
    const p1 = tasksRule1[0].payload
    expect(p1?.agent?.agentId).toBe(agent.id)
    expect(p1?.agent?.sessionId).toBeUndefined()
    expect(p1?.agent?.explicitMention).toBe(true)
    expect(p1?.agent?.userId).toBe(user.id)

    // Rule 2: user mentions agent in reply, and root is not an agent comment
    const reply1 = await assetService.createComment({
      assetId: file.id,
      userId: user.id,
      message: `Rule 2 reply: <@${agent.id}>`,
      replyToId: c1.id,
      attachmentIds: [],
    })

    const tasksRule2 = await prisma.workflowTask.findMany({
      where: { assetId: file.id, payload: { path: ['agent', 'userCommentId'], equals: reply1.id } },
    })
    expect(tasksRule2.length).toBe(1)
    const p2 = tasksRule2[0].payload
    expect(p2?.agent?.agentId).toBe(agent.id)
    expect(p2?.agent?.sessionId).toBeUndefined()
    expect(p2?.agent?.explicitMention).toBe(true)
    expect(p2?.agent?.userId).toBe(user.id)

    // Create a root user comment
    const userRoot = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: user.id,
        message: 'User root comment',
      },
    })

    // Create an agent session first for the foreign key constraint
    await prisma.agentSession.create({
      data: {
        id: 'test-session-rule3',
        agentId: botUser.id,
        cwd: process.cwd(),
      },
    })

    // Create an agent comment as a reply to userRoot with sessionId
    const agentReply = await prisma.assetComment.create({
      data: {
        assetId: file.id,
        creatorId: botUser.id,
        message: 'Agent reply comment',
        replyToId: userRoot.id,
        sessionId: 'test-session-rule3',
      },
    })

    // Rule 3a: any user creates a reply directly to the agent comment, no explicit mention
    const reply3a = await assetService.createComment({
      assetId: file.id,
      userId: user.id,
      message: 'Rule 3a: reply without mention',
      replyToId: agentReply.id,
      attachmentIds: [],
    })

    // Verify replyToId of reply3a was normalized to the root comment userRoot.id
    const dbReply3a = await prisma.assetComment.findUnique({
      where: { id: reply3a.id },
    })
    expect(dbReply3a?.replyToId).toBe(userRoot.id)

    const tasksRule3a = await prisma.workflowTask.findMany({
      where: {
        assetId: file.id,
        payload: { path: ['agent', 'userCommentId'], equals: reply3a.id },
      },
    })
    expect(tasksRule3a.length).toBe(1)
    const p3a = tasksRule3a[0].payload
    expect(p3a?.agent?.agentId).toBe(botUser.id)
    expect(p3a?.agent?.sessionId).toBe('test-session-rule3')
    expect(p3a?.agent?.explicitMention).toBe(false)
    expect(p3a?.agent?.userId).toBe(user.id)

    // Rule 3b: any user creates a reply directly to the agent comment, explicitly mentions agent
    const reply3b = await assetService.createComment({
      assetId: file.id,
      userId: user.id,
      message: `Rule 3b: reply with mention <@${botUser.id}>`,
      replyToId: agentReply.id,
      attachmentIds: [],
    })

    // Verify replyToId of reply3b was normalized to the root comment userRoot.id
    const dbReply3b = await prisma.assetComment.findUnique({
      where: { id: reply3b.id },
    })
    expect(dbReply3b?.replyToId).toBe(userRoot.id)

    const tasksRule3b = await prisma.workflowTask.findMany({
      where: {
        assetId: file.id,
        payload: { path: ['agent', 'userCommentId'], equals: reply3b.id },
      },
    })
    expect(tasksRule3b.length).toBe(1)
    const p3b = tasksRule3b[0].payload
    expect(p3b?.agent?.agentId).toBe(botUser.id)
    expect(p3b?.agent?.sessionId).toBe('test-session-rule3')
    expect(p3b?.agent?.explicitMention).toBe(true)
    expect(p3b?.agent?.userId).toBe(user.id)
  })

  it('updates asset order correctly', async () => {
    const { user, project } = await setupBasicAssets()

    await prisma.asset.create({
      data: {
        name: 'A',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        sortIndex: 'a0',
        status: 'uploaded',
      },
    })

    const assetB = await prisma.asset.create({
      data: {
        name: 'B',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        sortIndex: 'a1',
        status: 'uploaded',
      },
    })

    const assetC = await prisma.asset.create({
      data: {
        name: 'C',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        sortIndex: 'a2',
        status: 'uploaded',
      },
    })

    // Move C before B
    await assetService.updateAssetOrder(assetC.id, {
      beforeIndex: assetB.sortIndex!,
    })

    const updatedC = await prisma.asset.findUnique({ where: { id: assetC.id } })
    expect(updatedC?.sortIndex && updatedC.sortIndex > 'a0').toBe(true)
    expect(updatedC?.sortIndex && updatedC.sortIndex < 'a1').toBe(true)
  })

  it('updates asset order at the end', async () => {
    const { user, project } = await setupBasicAssets()

    await prisma.asset.create({
      data: {
        name: 'A',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        sortIndex: 'a0',
        status: 'uploaded',
      },
    })

    const assetB = await prisma.asset.create({
      data: {
        name: 'B',
        type: AssetType.file,
        projectId: project.id,
        creatorId: user.id,
        sortIndex: 'a1',
        status: 'uploaded',
      },
    })

    // Move A after B
    const assetA = await prisma.asset.findFirst({ where: { name: 'A' } })
    await assetService.updateAssetOrder(assetA!.id, {
      afterIndex: assetB.sortIndex!,
    })

    const updatedA = await prisma.asset.findUnique({ where: { id: assetA!.id } })
    expect(updatedA?.sortIndex && updatedA.sortIndex > 'a1').toBe(true)
  })

  describe('Symlinks', () => {
    it('toAssetInfo resolves symlink target metadata', async () => {
      const { project, user } = await setupBasicAssets()

      const file = await prisma.asset.create({
        data: {
          name: 'original.png',
          type: AssetType.file,
          projectId: project.id,
          creatorId: user.id,
          sizeByte: 5000,
          mediaType: 'image/png',
          status: 'processed',
          media: {
            thumbnail: { key: 'thumb-key' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        },
      })

      const symlink = await prisma.asset.create({
        data: {
          name: 'link.png',
          type: AssetType.symlink,
          projectId: project.id,
          creatorId: user.id,
          targetId: file.id,
          status: 'processed',
        },
      })

      const info = await assetService.getAsset({ assetId: symlink.id })

      expect(info.id).toBe(symlink.id)
      expect(info.name).toBe('link.png')
      expect(info.type).toBe(AssetType.symlink)
      // Resolved from target
      expect(info.sizeByte).toBe(5000)
      expect(info.mediaType).toBe('image/png')
      expect(info.media).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((info.media as any).thumbnail?.key).toBe('thumb-key')
    })

    it('listChildren includes symlinks by target type', async () => {
      const { project } = await setupBasicAssets()

      const folder = await prisma.asset.create({
        data: {
          name: 'Shared Folder',
          type: AssetType.folder,
          projectId: project.id,
          status: 'processed',
        },
      })

      const file = await prisma.asset.create({
        data: {
          name: 'target.txt',
          type: AssetType.file,
          projectId: project.id,
          status: 'processed',
        },
      })

      await prisma.asset.create({
        data: {
          name: 'symlink.txt',
          type: AssetType.symlink,
          projectId: project.id,
          parentId: folder.id,
          targetId: file.id,
          status: 'processed',
        },
      })

      const res = await assetService.listChildren({
        assetId: folder.id,
        assetType: 'file',
      })

      expect(res.data).toHaveLength(1)
      expect(res.data[0].type).toBe(AssetType.symlink)
      expect(res.data[0].name).toBe('symlink.txt')
    })

    it('populates versionStack and latestVersion correctly when files are reparented', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const project = await prisma.project.create({
        data: { name: 'Test Project', teamId: team.id },
      })
      const user = await prisma.user.create({
        data: { name: 'Test User', email: `test-${Date.now()}@example.com` },
      })

      const parentFolder = await prisma.asset.create({
        data: {
          name: 'Parent Folder',
          type: AssetType.folder,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const fileA = await prisma.asset.create({
        data: {
          name: 'fileA.txt',
          type: AssetType.file,
          projectId: project.id,
          parentId: parentFolder.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 100,
        },
      })

      const fileB = await prisma.asset.create({
        data: {
          name: 'fileB.txt',
          type: AssetType.file,
          projectId: project.id,
          parentId: parentFolder.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 200,
        },
      })

      // Reparent fileB onto fileA to create a version stack
      await assetService.reparentAssets({
        creatorId: user.id,
        assetIds: [fileB.id],
        newParentId: fileA.id,
      })

      // Now list children of the parentFolder
      const res = await assetService.listChildren({
        assetId: parentFolder.id,
        assetType: 'file',
      })

      expect(res.data).toHaveLength(1)
      const stackAsset = res.data[0]
      expect(stackAsset.type).toBe(AssetType.version_stack)
      expect(stackAsset.versionStack).toBeDefined()
      expect(stackAsset.versionStack?.versions).toHaveLength(2)
      const versions = stackAsset.versionStack!.versions
      // Index 0 must be fileB (latest version) since it has lower sortIndex
      expect(versions[0].id).toBe(fileB.id)
      expect(versions[0].version).toBe(2)
      expect(versions[0].current).toBe(true)

      // Index 1 must be fileA (older version) since it has higher sortIndex
      expect(versions[1].id).toBe(fileA.id)
      expect(versions[1].version).toBe(1)
      expect(versions[1].current).toBe(false)
    })
  })

  describe('getAsset', () => {
    it('does not include version_stack in ancestorFolders', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const project = await prisma.project.create({
        data: { name: 'Test Project', teamId: team.id },
      })
      const user = await prisma.user.create({
        data: { name: 'Test User', email: `test-${Date.now()}@example.com` },
      })

      const parentFolder = await prisma.asset.create({
        data: {
          name: 'Parent Folder',
          type: AssetType.folder,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const fileA = await prisma.asset.create({
        data: {
          name: 'fileA.txt',
          type: AssetType.file,
          projectId: project.id,
          parentId: parentFolder.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 100,
        },
      })

      const fileB = await prisma.asset.create({
        data: {
          name: 'fileB.txt',
          type: AssetType.file,
          projectId: project.id,
          parentId: parentFolder.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 200,
        },
      })

      // Reparent fileB onto fileA to create a version stack
      await assetService.reparentAssets({
        creatorId: user.id,
        assetIds: [fileB.id],
        newParentId: fileA.id,
      })

      // Now get stack info
      const stack = await prisma.asset.findFirst({
        where: { parentId: parentFolder.id, type: AssetType.version_stack },
      })
      expect(stack).toBeDefined()

      // Fetch details of version fileB
      const info = await assetService.getAsset({ assetId: fileB.id })

      // Verify that ancestorFolders contains the parent folder but NOT the version stack
      expect(info.ancestorFolders).toBeDefined()
      const containsStack = info.ancestorFolders?.some((f) => f.id === stack!.id)
      expect(containsStack).toBe(false)
      expect(info.ancestorFolders?.find((f) => f.id === parentFolder.id)).toBeDefined()
    })
  })

  describe('getStackVersions', () => {
    it('returns all versions in a stack ordered by sortIndex asc', async () => {
      const team = await prisma.team.create({ data: { name: 'Test Team' } })
      const project = await prisma.project.create({
        data: { name: 'Test Project', teamId: team.id },
      })
      const user = await prisma.user.create({
        data: { name: 'Test User', email: `test-${Date.now()}@example.com` },
      })

      const stack = await prisma.asset.create({
        data: {
          name: 'stack',
          type: AssetType.version_stack,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const file1 = await prisma.asset.create({
        data: {
          name: 'version1.txt',
          type: AssetType.file,
          projectId: project.id,
          parentId: stack.id,
          creatorId: user.id,
          status: 'uploaded',
          sortIndex: 'a1', // older version has higher sortIndex
        },
      })

      const file2 = await prisma.asset.create({
        data: {
          name: 'version2.txt',
          type: AssetType.file,
          projectId: project.id,
          parentId: stack.id,
          creatorId: user.id,
          status: 'uploaded',
          sortIndex: 'a0', // newer/latest version has lower sortIndex
        },
      })

      const versions = await assetService.getStackVersions(stack.id)

      expect(versions).toHaveLength(2)
      expect(versions[0].id).toBe(file2.id) // newer version must be first
      expect(versions[0].version).toBe(2)
      expect(versions[0].name).toBe('version2.txt')
      expect(versions[0].creator?.id).toBe(user.id)
      expect(versions[0].creator?.name).toBe('Test User')

      expect(versions[1].id).toBe(file1.id) // older version must be second
      expect(versions[1].version).toBe(1)
      expect(versions[1].name).toBe('version1.txt')
    })
  })

  describe('Asset Cascade Bug (Reproduction)', () => {
    it('should NOT cascade delete children from DB before their S3 files are deleted', async () => {
      const { project } = await setupBasicAssets()
      const { s3Service } = await import('../s3/s3')

      // 1. Create Folder A
      const folderA = await prisma.asset.create({
        data: {
          name: 'Folder A',
          type: AssetType.folder,
          status: 'pending_purge',
          isDeleted: true,
          projectId: project.id,
        },
      })

      // 2. Create 101 children files for Folder A
      // Each has an S3 key.
      const childCount = 101
      const childData = Array.from({ length: childCount }).map((_, i) => ({
        name: `File ${i}`,
        type: AssetType.file,
        status: AssetStatus.pending_purge,
        isDeleted: true,
        project: { connect: { id: project.id } },
        parent: { connect: { id: folderA.id } },
        storageKey: {
          create: { key: `key-${i}` },
        },
      }))

      for (const data of childData) {
        const asset = await prisma.asset.create({
          data: data as unknown as Prisma.AssetCreateInput,
          include: { storageKey: true },
        })
        await prisma.storageKey.update({
          where: { id: asset.storageKeyId! },
          data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
        })
      }

      // 3. Trigger the purge job
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgePendingAssets()

      // 6. Trigger GC job to physically delete files
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgeUnreferencedStorageKeys()
      // Call it again to process the remaining items (batch size is 100)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgeUnreferencedStorageKeys()

      // 6. Verify S3 deletion was called for EVERY child
      for (let i = 0; i < childCount; i++) {
        expect(s3Service.deleteObject).toHaveBeenCalledWith(expect.any(String), `key-${i}`)
      }

      // Verify folder and all children are gone from DB
      expect(await prisma.asset.findUnique({ where: { id: folderA.id } })).toBeNull()
      const remainingChildren = await prisma.asset.count({ where: { parentId: folderA.id } })
      expect(remainingChildren).toBe(0)
    })

    it('should delete the entire directory prefix for assets with complex keys (e.g., files/ULID/raw)', async () => {
      const { project } = await setupBasicAssets()
      const { s3Service } = await import('../s3/s3')

      // Create an asset with a complex key
      const complexFile = await prisma.asset.create({
        data: {
          name: 'Complex File',
          type: AssetType.file,
          status: AssetStatus.pending_purge,
          isDeleted: true,
          project: { connect: { id: project.id } },
          storageKey: {
            create: {
              key: 'files/01KSBRJVY3DPK111S2MECFKDQ4/raw',
              createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            },
          },
        },
      })

      // 1. Purge the asset record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgePendingAssets()

      // 2. Trigger GC job
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (assetService as any).purgeUnreferencedStorageKeys()

      // Verify deletePrefix was called with the correct prefix instead of just deleteObject
      expect(s3Service.deletePrefix).toHaveBeenCalledWith(
        expect.any(String),
        'files/01KSBRJVY3DPK111S2MECFKDQ4/',
      )

      // Verify record is gone
      expect(await prisma.asset.findUnique({ where: { id: complexFile.id } })).toBeNull()
    })
  })
})

describe('AssetService — natural sort by name', () => {
  setupTestDbHooks()

  let assetService: AssetService

  beforeEach(() => {
    assetService = new AssetService()
  })

  const setupNaturalSortAssets = async (names: string[]) => {
    const user = await prisma.user.create({
      data: {
        name: 'natural-sort-user',
        email: `natural-sort-${Date.now()}@example.com`,
        type: 'human',
      },
    })
    const team = await prisma.team.create({ data: { name: 'natural-sort-team' } })
    const project = await prisma.project.create({
      data: { name: 'natural-sort-proj', teamId: team.id },
    })
    const root = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.folder,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })
    // Create files in a shuffled order so we are not relying on insertion order
    for (const name of names) {
      await prisma.asset.create({
        data: {
          name,
          type: AssetType.file,
          projectId: project.id,
          parentId: root.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 0,
        },
      })
    }
    return { root }
  }

  it('sorts files with numeric suffixes in natural order (asc)', async () => {
    // Insert in non-natural lexicographic order to prove the collation does the work
    const { root } = await setupNaturalSortAssets(['file10', 'file2', 'file20', 'file1'])

    const result = await assetService.listChildren({
      assetId: root.id,
      assetType: AssetType.file,
      sort: 'name',
      order: 'asc',
      first: 20,
    })

    expect(result.data.map((a) => a.name)).toEqual(['file1', 'file2', 'file10', 'file20'])
  })

  it('sorts files with numeric suffixes in natural order (desc)', async () => {
    const { root } = await setupNaturalSortAssets(['file10', 'file2', 'file20', 'file1'])

    const result = await assetService.listChildren({
      assetId: root.id,
      assetType: AssetType.file,
      sort: 'name',
      order: 'desc',
      first: 20,
    })

    expect(result.data.map((a) => a.name)).toEqual(['file20', 'file10', 'file2', 'file1'])
  })

  it('sorts mixed alpha-numeric names correctly', async () => {
    const { root } = await setupNaturalSortAssets(['asset 100', 'asset 9', 'asset 10', 'asset 2'])

    const result = await assetService.listChildren({
      assetId: root.id,
      assetType: AssetType.file,
      sort: 'name',
      order: 'asc',
      first: 20,
    })

    expect(result.data.map((a) => a.name)).toEqual(['asset 2', 'asset 9', 'asset 10', 'asset 100'])
  })

  it('does not regress lexicographic ordering for purely alphabetical names', async () => {
    const { root } = await setupNaturalSortAssets(['banana', 'apple', 'cherry', 'apricot'])

    const result = await assetService.listChildren({
      assetId: root.id,
      assetType: AssetType.file,
      sort: 'name',
      order: 'asc',
      first: 20,
    })

    expect(result.data.map((a) => a.name)).toEqual(['apple', 'apricot', 'banana', 'cherry'])
  })
})
