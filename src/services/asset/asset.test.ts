import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'

import { AssetType } from '@/generated/prisma/client.ts'
import { AssetService } from './asset'

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    presign: vi.fn().mockResolvedValue('http://mock-s3-url'),
    putObject: vi.fn().mockResolvedValue(undefined),
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

  it('reparent file onto another file - creates version stack and keeps it visible', async () => {
    const { user, assets } = await setupBasicAssets()

    // Initially fileA1 is processed, fileA2 is processed
    await prisma.asset.update({
      where: { id: assets.fileA1.id },
      data: { status: 'processed' },
    })
    await prisma.asset.update({
      where: { id: assets.fileA2.id },
      data: { status: 'processed' },
    })

    // Reparent fileA1 onto fileA2
    await assetService.reparentAssets({
      assetIds: [assets.fileA1.id],
      newParentId: assets.fileA2.id,
      creatorId: user.id,
    })

    // Get children of folderA (where fileA2 originally was)
    const children = await assetService.listChildren({
      assetId: assets.folderA.id,
      assetType: 'file',
      first: 10,
    })

    // There should be exactly 1 child in folderA, which is the version stack
    expect(children.data.length).toBe(1)
    const stackInfo = children.data[0]
    expect(stackInfo.type).toBe(AssetType.version_stack)
    // The name of the stack should be fileA1 (since it is the latest version / source asset)
    expect(stackInfo.name).toBe('fileA1')
    // The status of the stack should be 'processed' (inherited from the latest version)
    expect(stackInfo.status).toBe('processed')
  })

  it('handles soft deleting and restoring assets recursively', async () => {
    const { assets } = await setupBasicAssets()

    // Initially folderA has 2 files and size 300
    // root has 3 files (folderA, folderB, fileRoot1) and size 960
    await assetService.deleteAssets([assets.folderA.id])

    const folderA = await prisma.asset.findUnique({
      where: { id: assets.folderA.id },
    })
    expect(folderA?.removed).toBe(true)

    const fileA1 = await prisma.asset.findUnique({
      where: { id: assets.fileA1.id },
    })
    expect(fileA1?.removed).toBe(true)

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
    expect(folderRestoredA?.removed).toBe(false)

    expect(folderRestoredA?.deletedAt).toBeNull()

    const fileA1Restored = await prisma.asset.findUnique({
      where: { id: assets.fileA1.id },
    })
    expect(fileA1Restored?.removed).toBe(false)

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(tasks.some((t) => (t.payload as any).agentId === agent.id)).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(tasks.some((t) => (t.payload as any).agentId === 'default')).toBe(true)
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
      where: { assetId: file.id, payload: { path: ['userCommentId'], equals: c1.id } },
    })
    expect(tasksRule1.length).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p1 = tasksRule1[0].payload as any
    expect(p1.agentId).toBe(agent.id)
    expect(p1.sessionId).toBeUndefined()
    expect(p1.explicitMention).toBe(true)

    // Rule 2: user mentions agent in reply, and root is not an agent comment
    const reply1 = await assetService.createComment({
      assetId: file.id,
      userId: user.id,
      message: `Rule 2 reply: <@${agent.id}>`,
      replyToId: c1.id,
      attachmentIds: [],
    })

    const tasksRule2 = await prisma.workflowTask.findMany({
      where: { assetId: file.id, payload: { path: ['userCommentId'], equals: reply1.id } },
    })
    expect(tasksRule2.length).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p2 = tasksRule2[0].payload as any
    expect(p2.agentId).toBe(agent.id)
    expect(p2.sessionId).toBeUndefined()
    expect(p2.explicitMention).toBe(true)

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
      where: { assetId: file.id, payload: { path: ['userCommentId'], equals: reply3a.id } },
    })
    expect(tasksRule3a.length).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3a = tasksRule3a[0].payload as any
    expect(p3a.agentId).toBe(botUser.id)
    expect(p3a.sessionId).toBe('test-session-rule3')
    expect(p3a.explicitMention).toBe(false)

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
      where: { assetId: file.id, payload: { path: ['userCommentId'], equals: reply3b.id } },
    })
    expect(tasksRule3b.length).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3b = tasksRule3b[0].payload as any
    expect(p3b.agentId).toBe(botUser.id)
    expect(p3b.sessionId).toBe('test-session-rule3')
    expect(p3b.explicitMention).toBe(true)
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
  })
})
