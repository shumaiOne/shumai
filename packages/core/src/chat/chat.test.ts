import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { chatService } from '@shumai/core/src/chat/chat'
import { describe, expect, it } from 'vitest'

describe('ChatService', () => {
  setupTestDbHooks()

  async function setupBasicData() {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: `test-${Date.now()}@example.com`, password: 'pw' },
    })

    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        settings: { transcode: { videoStrategy: 'best_match' } },
        sandbox: { create: {} },
      },
    })

    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      },
    })

    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        teamId: team.id,
      },
    })

    const rootFolder = await prisma.asset.create({
      data: {
        name: 'root',
        type: 'root',
        status: 'processed',
        projectId: project.id,
      },
    })

    await prisma.project.update({
      where: { id: project.id },
      data: { rootFolderId: rootFolder.id },
    })

    return { user, team, teamMember, project, rootFolder }
  }

  it('should start a new chat session and trigger workflow', async () => {
    const { user, project, rootFolder } = await setupBasicData()

    const { sessionId, taskId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'hello world',
      projectId: project.id,
    })

    expect(sessionId).toBeDefined()
    expect(taskId).toBeDefined()

    // Verify AgentSession is created
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    })
    expect(session).toBeDefined()
    expect(session?.userId).toBe(user.id)
    expect(session?.assetId).toBe(rootFolder.id)

    // Verify comment is created
    const comment = await prisma.assetComment.findFirst({
      where: { sessionId },
    })
    expect(comment).toBeDefined()
    expect(comment?.message).toBe('hello world')
    expect(comment?.creatorId).toBe(user.id)

    // Verify session entry is created
    const entry = await prisma.agentSessionEntry.findFirst({
      where: { sessionId },
    })
    expect(entry).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = entry?.entry as any
    expect(payload.message.content[0].text).toBe('hello world')

    // Verify WorkflowTask is created
    const task = await prisma.workflowTask.findUnique({
      where: { id: taskId },
    })
    expect(task).toBeDefined()
    expect(task?.type).toBe('chat')
    expect(task?.status).toBe('pending')
  })

  it('should continue an existing chat session', async () => {
    const { user, project } = await setupBasicData()

    // Start
    const { sessionId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'first message',
      projectId: project.id,
    })

    // Continue
    const { sessionId: nextSessionId, taskId: nextTaskId } = await chatService.startOrContinueChat(
      user,
      {
        textPrompt: 'second message',
        sessionId,
      },
    )

    expect(nextSessionId).toBe(sessionId)
    expect(nextTaskId).toBeDefined()

    // Verify entries order
    const entries = await prisma.agentSessionEntry.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    })
    expect(entries).toHaveLength(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((entries[0].entry as any).message.content[0].text).toBe('first message')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((entries[1].entry as any).message.content[0].text).toBe('second message')

    // Verify reply comment
    const comments = await prisma.assetComment.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    })
    expect(comments).toHaveLength(2)
    expect(comments[0].replyToId).toBeNull()
    expect(comments[1].replyToId).toBe(comments[0].id)
  })

  it('should inject context of referenced assets and attached files', async () => {
    const { user, project, rootFolder } = await setupBasicData()

    const childFolder = await prisma.asset.create({
      data: {
        name: 'child_folder',
        type: 'folder',
        status: 'processed',
        projectId: project.id,
        parentId: rootFolder.id,
      },
    })

    const textFile = await prisma.asset.create({
      data: {
        name: 'doc.txt',
        type: 'file',
        mediaType: 'text/plain',
        status: 'processed',
        projectId: project.id,
        parentId: childFolder.id,
      },
    })

    const { sessionId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'process file',
      projectId: project.id,
      assetIds: [childFolder.id],
      attachedFiles: [textFile.id],
    })

    const comment = await prisma.assetComment.findFirst({
      where: { sessionId },
    })

    expect(comment?.message).toContain('[Context: Attached Files & Referenced Assets]')
    expect(comment?.message).toContain('doc.txt')
    expect(comment?.message).toContain('child_folder')
    expect(comment?.message).toContain('text/plain')
    expect(comment?.message).toContain('child_folder/doc.txt')
    expect(comment?.message).toContain('process file')
  })

  it('should list sessions of a user', async () => {
    const { user, project } = await setupBasicData()

    await chatService.startOrContinueChat(user, {
      textPrompt: 'chat 1',
      projectId: project.id,
    })

    await chatService.startOrContinueChat(user, {
      textPrompt: 'chat 2',
      projectId: project.id,
    })

    const list = await chatService.listSessions(user.id, { first: 10 })
    expect(list.data).toHaveLength(2)
  })

  it('should list messages mapped correctly', async () => {
    const { user, project } = await setupBasicData()

    const { sessionId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'hello',
      projectId: project.id,
    })

    const messages = await chatService.listMessages(user.id, sessionId)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('hello')
  })

  it('should delete session and cascade', async () => {
    const { user, project } = await setupBasicData()

    const { sessionId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'to delete',
      projectId: project.id,
    })

    await chatService.deleteSession(user.id, sessionId)

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    })
    expect(session).toBeNull()

    const entries = await prisma.agentSessionEntry.findMany({
      where: { sessionId },
    })
    expect(entries).toHaveLength(0)
  })
})
