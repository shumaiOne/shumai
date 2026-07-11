import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { chatService, buildSessionMessages, mapEntryToMessage, type PathEntry } from './chat'
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
        settings: { transcode: { videoStrategy: 'best_match' }, chatbotAgentId: 'test-agent-id' },
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

    const agentUser = await prisma.user.create({
      data: {
        id: 'test-agent-id',
        name: 'Test Agent',
        email: 'test-agent@shumai.ai',
        type: 'agent',
      },
    })

    const agent = await prisma.agent.create({
      data: {
        id: 'test-agent-id',
        teamId: team.id,
        type: 'chat',
        config: {
          provider: 'openai',
          model: 'gpt-4',
        },
      },
    })

    return { user, team, teamMember, project, rootFolder, agent, agentUser }
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

    // Verify no comment is created
    const comment = await prisma.assetComment.findFirst({
      where: { sessionId },
    })
    expect(comment).toBeNull()

    // Verify no session entry is created yet (it is created automatically when the workflow runs)
    const entry = await prisma.agentSessionEntry.findFirst({
      where: { sessionId },
    })
    expect(entry).toBeNull()

    // Verify WorkflowTask is created with correct payload
    const task = await prisma.workflowTask.findUnique({
      where: { id: taskId },
    })
    expect(task).toBeDefined()
    expect(task?.type).toBe('chat')
    expect(task?.status).toBe('pending')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskPayload = task?.payload as any
    expect(taskPayload?.agent?.prompt).toBe('hello world')
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

    // Verify no entries are created yet (they are created automatically when the workflow runs)
    const entries = await prisma.agentSessionEntry.findMany({
      where: { sessionId },
    })
    expect(entries).toHaveLength(0)

    // Verify WorkflowTask is created with correct payload
    const task = await prisma.workflowTask.findUnique({
      where: { id: nextTaskId },
    })
    expect(task).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskPayload = task?.payload as any
    expect(taskPayload?.agent?.prompt).toBe('second message')
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

    const storageKey = await prisma.storageKey.create({
      data: {
        key: 'doc_s3_key',
      },
    })

    const textFile = await prisma.asset.create({
      data: {
        name: 'doc.jpg',
        type: 'file',
        mediaType: 'image/jpeg',
        status: 'processed',
        projectId: project.id,
        parentId: childFolder.id,
        storageKeyId: storageKey.id,
      },
    })

    const { taskId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'process file',
      projectId: project.id,
      assetIds: [childFolder.id],
      attachedFiles: [textFile.id],
    })

    const task = await prisma.workflowTask.findUnique({
      where: { id: taskId },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskPayload = task?.payload as any

    expect(taskPayload?.agent?.prompt).toBe('process file')
    expect(taskPayload?.agent?.attachedFiles).toContain(textFile.id)
    expect(taskPayload?.agent?.assetIds).toContain(childFolder.id)
    expect(taskPayload?.agent?.imageUrls).toContain('doc_s3_key')
  })

  it('should list sessions of a user and only return chat type sessions', async () => {
    const { user, project } = await setupBasicData()

    await chatService.startOrContinueChat(user, {
      textPrompt: 'chat 1',
      projectId: project.id,
    })

    await chatService.startOrContinueChat(user, {
      textPrompt: 'chat 2',
      projectId: project.id,
    })

    // Create a comment type session (which should be ignored by listSessions)
    const defaultAgent = await prisma.agent.findFirst()
    await prisma.agentSession.create({
      data: {
        agentId: defaultAgent ? defaultAgent.id : 'default',
        userId: user.id,
        cwd: process.cwd(),
        type: 'comment',
      },
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

    // Manually insert a test entry representing user message
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-id',
        sessionId,
        entry: {
          type: 'message',
          id: 'test-entry-id',
          parentId: null,
          timestamp: new Date().toISOString(),
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'hello' }],
            timestamp: Date.now(),
          },
        },
      },
    })

    const messages = await chatService.listMessages(user.id, sessionId)
    expect(messages).toHaveLength(1)
    // Casting to any to access properties of union in test assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = messages[0] as any
    expect(msg.role).toBe('user')
    expect(msg.content).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('should hide customType context messages', async () => {
    const { user, project } = await setupBasicData()

    const { sessionId } = await chatService.startOrContinueChat(user, {
      textPrompt: 'hello',
      projectId: project.id,
    })

    // 1. Manually insert a test entry representing user message
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-1-user',
        sessionId,
        entry: {
          type: 'message',
          id: 'test-entry-1-user',
          parentId: null,
          timestamp: new Date().toISOString(),
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'hello' }],
            timestamp: Date.now(),
          },
        } as unknown as PrismaJson.PiSessionEntry,
      },
    })

    // 2. Manually insert a test entry representing a custom context message
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-2-context',
        sessionId,
        entry: {
          type: 'custom_message',
          id: 'test-entry-2-context',
          parentId: 'test-entry-1-user',
          timestamp: new Date().toISOString(),
          customType: 'context',
          content: 'some context',
          display: 'chat',
        } as unknown as PrismaJson.PiSessionEntry,
      },
    })

    // 3. Manually insert a test entry representing a custom thinking level change
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-3-thinking',
        sessionId,
        entry: {
          type: 'thinking_level_change',
          id: 'test-entry-3-thinking',
          parentId: 'test-entry-2-context',
          timestamp: new Date().toISOString(),
          thinkingLevel: 'deep',
        } as unknown as PrismaJson.PiSessionEntry,
      },
    })

    // 4. Manually insert a test entry representing custom context_display_info entry
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-4-display',
        sessionId,
        entry: {
          type: 'custom',
          id: 'test-entry-4-display',
          parentId: 'test-entry-3-thinking',
          timestamp: new Date().toISOString(),
          customType: 'context_display_info',
          data: {
            assets: [{ id: 'a1', name: 'File A', type: 'file' }],
          },
        } as unknown as PrismaJson.PiSessionEntry,
      },
    })

    // Verify listMessages returns only the user, thinking level change and custom display entry message
    const messages = await chatService.listMessages(user.id, sessionId)
    expect(messages).toHaveLength(3)
    expect(messages[0].id).toBe('test-entry-1-user')
    expect(messages[1].id).toBe('test-entry-3-thinking')
    expect(messages[2].id).toBe('test-entry-4-display')
    expect(messages[2].role).toBe('custom')
    expect((messages[2] as { customType?: string }).customType).toBe('context_display_info')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((messages[2] as any).details).toEqual({
      assets: [{ id: 'a1', name: 'File A', type: 'file' }],
    })

    // Verify mapEntryToMessage returns null for context message
    const contextRecord = await prisma.agentSessionEntry.findUnique({
      where: { id: 'test-entry-2-context' },
    })
    expect(contextRecord).not.toBeNull()
    const mapped = mapEntryToMessage(contextRecord!)
    expect(mapped).toBeNull()
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

  it('should build session messages correctly handling compaction and custom messages', () => {
    const pathEntries = [
      {
        id: 'entry-1',
        type: 'message',
        timestamp: '2026-07-07T00:00:00.000Z',
        message: {
          role: 'user',
          content: 'first message',
        },
      },
      {
        id: 'entry-compaction',
        type: 'compaction',
        timestamp: '2026-07-07T00:01:00.000Z',
        summary: 'Compacted conversation history',
        tokensBefore: 200,
        firstKeptEntryId: 'entry-2',
      },
      {
        id: 'entry-2',
        type: 'message',
        timestamp: '2026-07-07T00:02:00.000Z',
        message: {
          role: 'assistant',
          content: 'kept message',
        },
      },
      {
        id: 'entry-3',
        type: 'thinking_level_change',
        timestamp: '2026-07-07T00:03:00.000Z',
        thinkingLevel: 'high',
      },
      {
        id: 'entry-4',
        type: 'branch_summary',
        timestamp: '2026-07-07T00:04:00.000Z',
        summary: 'Branch summary details',
        fromId: 'entry-old',
      },
    ]

    const messages = buildSessionMessages(pathEntries as unknown as PathEntry[])

    expect(messages).toHaveLength(4)

    // 1. Compaction summary message
    // Casting to any to access properties of union in test assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg0 = messages[0] as any
    expect(msg0.role).toBe('custom')
    expect(msg0.customType).toBe('compaction-summary')
    expect(msg0.content).toBe('Compacted conversation history')
    expect((msg0.details as Record<string, unknown>).tokensBefore).toBe(200)

    // 2. Kept entry (entry-2)
    // Casting to any to access properties of union in test assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg1 = messages[1] as any
    expect(msg1.id).toBe('entry-2')
    expect(msg1.role).toBe('assistant')
    expect(msg1.content).toBe('kept message')

    // 3. Thinking level change (entry-3)
    // Casting to any to access properties of union in test assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg2 = messages[2] as any
    expect(msg2.role).toBe('thinking_level_change')
    expect(msg2.content).toContain('Thinking level changed to high')

    // 4. Branch summary (entry-4)
    // Casting to any to access properties of union in test assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg3 = messages[3] as any
    expect(msg3.role).toBe('custom')
    expect(msg3.customType).toBe('branch-summary')
    expect(msg3.content).toBe('Branch summary details')
    expect((msg3.details as Record<string, unknown>).fromId).toBe('entry-old')
  })
})
