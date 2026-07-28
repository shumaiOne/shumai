import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { chatService, buildSessionMessages, mapEntryToMessage, type PathEntry } from './chat'
import { describe, expect, it, vi } from 'vitest'
import { workflowService } from '@shumai/workflow-core'

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
    const { user, team, project, rootFolder } = await setupBasicData()

    const { sessionId, taskId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
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
    expect(['pending', 'processing']).toContain(task?.status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskPayload = task?.payload as any
    expect(taskPayload?.agent?.prompt).toBe('hello world')
  })

  it('should continue an existing chat session', async () => {
    const { user, team, project } = await setupBasicData()

    // Start
    const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'first message',
      projectId: project.id,
    })

    // Continue
    const { sessionId: nextSessionId, taskId: nextTaskId } = await chatService.startOrContinueChat(
      user,
      team.id,
      {
        agentId: 'test-agent-id',
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
    expect(taskPayload?.agent?.hasAssetChanged).toBe(false)
  })

  it('should update session assetId and set hasAssetChanged when continuing chat with a new contextAssetId', async () => {
    const { user, team, project, rootFolder } = await setupBasicData()

    const newFolder = await prisma.asset.create({
      data: {
        name: 'new_folder',
        type: 'folder',
        status: 'processed',
        projectId: project.id,
        parentId: rootFolder.id,
      },
    })

    // Start session on rootFolder
    const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'message in root folder',
      projectId: project.id,
      contextAssetId: rootFolder.id,
    })

    const sessionBefore = await prisma.agentSession.findUnique({ where: { id: sessionId } })
    expect(sessionBefore?.assetId).toBe(rootFolder.id)

    // Continue session on newFolder
    const { taskId: nextTaskId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'message after switching to new folder',
      sessionId,
      contextAssetId: newFolder.id,
    })

    // Verify session assetId updated
    const sessionAfter = await prisma.agentSession.findUnique({ where: { id: sessionId } })
    expect(sessionAfter?.assetId).toBe(newFolder.id)

    // Verify task payload has assetId set to newFolder.id and hasAssetChanged is true
    const task = await prisma.workflowTask.findUnique({ where: { id: nextTaskId } })
    expect(task?.assetId).toBe(newFolder.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskPayload = task?.payload as any
    expect(taskPayload?.agent?.hasAssetChanged).toBe(true)
  })

  it('should inject context of referenced assets and attached files', async () => {
    const { user, team, project, rootFolder } = await setupBasicData()

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial MediaInfo mock for testing
        media: { proxyType: 'image' } as any,
        status: 'processed',
        projectId: project.id,
        parentId: childFolder.id,
        storageKeyId: storageKey.id,
      },
    })

    const { taskId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
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
    const { user, team, project } = await setupBasicData()

    await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'chat 1',
      projectId: project.id,
    })

    await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
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

    const list = await chatService.listSessions(user.id, team.id, { first: 10 })
    expect(list.data).toHaveLength(2)
  })

  it('should list messages mapped correctly', async () => {
    const { user, team, project } = await setupBasicData()

    const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'hello',
      projectId: project.id,
    })

    // Manually insert a test entry representing user message
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-id',
        sessionId,
        type: 'message',
        parentId: null,
        data: {
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'hello' }],
            timestamp: Date.now(),
          },
        } as PrismaJson.PiSessionEntryData,
      },
    })

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { leafId: 'test-entry-id' },
    })

    const messages = await chatService.listMessages(user.id, team.id, sessionId)
    expect(messages).toHaveLength(1)
    // Casting to any to access properties of union in test assertions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = messages[0] as any
    expect(msg.role).toBe('user')
    expect(msg.content).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('should hide customType context messages', async () => {
    const { user, team, project } = await setupBasicData()

    const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'hello',
      projectId: project.id,
    })

    // 1. Manually insert a test entry representing user message
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-1-user',
        sessionId,
        type: 'message',
        parentId: null,
        data: {
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'hello' }],
            timestamp: Date.now(),
          },
        } as PrismaJson.PiSessionEntryData,
      },
    })

    // 2. Manually insert a test entry representing a custom context message
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-2-context',
        sessionId,
        type: 'custom_message',
        parentId: 'test-entry-1-user',
        data: {
          customType: 'context',
          content: 'some context',
          display: 'chat',
        } as PrismaJson.PiSessionEntryData,
      },
    })

    // 3. Manually insert a test entry representing a custom thinking level change
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-3-thinking',
        sessionId,
        type: 'thinking_level_change',
        parentId: 'test-entry-2-context',
        data: {
          thinkingLevel: 'deep',
        } as PrismaJson.PiSessionEntryData,
      },
    })

    // 4. Manually insert a test entry representing custom context_display_info entry
    await prisma.agentSessionEntry.create({
      data: {
        id: 'test-entry-4-display',
        sessionId,
        type: 'custom',
        parentId: 'test-entry-3-thinking',
        data: {
          customType: 'context_display_info',
          data: {
            assets: [{ id: 'a1', name: 'File A', type: 'file' }],
          },
        } as PrismaJson.PiSessionEntryData,
      },
    })

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { leafId: 'test-entry-4-display' },
    })

    // Verify listMessages returns only the user, thinking level change and custom display entry message
    const messages = await chatService.listMessages(user.id, team.id, sessionId)
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
    const { user, team, project } = await setupBasicData()

    const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'to delete',
      projectId: project.id,
    })

    await chatService.deleteSession(user.id, team.id, sessionId)

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

  describe('getNewSessionMessages', () => {
    it('returns new messages and lastEntryId', async () => {
      const { user, team, project } = await setupBasicData()
      const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
        agentId: 'test-agent-id',
        textPrompt: 'hello',
        projectId: project.id,
      })

      // Insert two entries
      const entry1 = await prisma.agentSessionEntry.create({
        data: {
          id: 'entry-id-1',
          sessionId,
          type: 'message',
          parentId: null,
          data: {
            message: {
              role: 'user',
              content: [{ type: 'text', text: 'msg 1' }],
            },
          } as PrismaJson.PiSessionEntryData,
        },
      })

      const entry2 = await prisma.agentSessionEntry.create({
        data: {
          id: 'entry-id-2',
          sessionId,
          type: 'message',
          parentId: 'entry-id-1',
          data: {
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'msg 2' }],
            },
          } as PrismaJson.PiSessionEntryData,
        },
      })

      // 1. Get all messages
      const res1 = await chatService.getNewSessionMessages(sessionId)
      expect(res1.messages).toHaveLength(2)
      expect(res1.lastEntryId).toBe(entry2.id)
      expect(res1.messages[0].id).toBe(entry1.id)

      // 2. Get with lastEntryId
      const res2 = await chatService.getNewSessionMessages(sessionId, entry1.id)
      expect(res2.messages).toHaveLength(1)
      expect(res2.lastEntryId).toBe(entry2.id)
      expect(res2.messages[0].id).toBe(entry2.id)

      // 3. Get with latest lastEntryId
      const res3 = await chatService.getNewSessionMessages(sessionId, entry2.id)
      expect(res3.messages).toHaveLength(0)
      expect(res3.lastEntryId).toBe(entry2.id)
    })
  })

  describe('getChatWorkflowStatus', () => {
    it('returns task status and output', async () => {
      const { team, project } = await setupBasicData()
      const rootFolder = await prisma.asset.findFirst({
        where: { projectId: project.id, type: 'root' },
      })
      const task = await prisma.workflowTask.create({
        data: {
          assetId: rootFolder!.id,
          type: 'chat',
          status: 'completed',
          teamId: team.id,
          projectId: project.id,
          payload: { projectId: project.id },
          output: { success: true },
        },
      })

      const statusRes = await chatService.getChatWorkflowStatus(task.id)
      expect(statusRes).not.toBeNull()
      expect(statusRes?.status).toBe('completed')
      expect(statusRes?.output).toEqual({ success: true })
    })

    it('returns null if task not found', async () => {
      const statusRes = await chatService.getChatWorkflowStatus('non-existent-task')
      expect(statusRes).toBeNull()
    })
  })

  describe('abortSession', () => {
    it('cancels active task and marks failed/aborted', async () => {
      const { user, team, project } = await setupBasicData()
      const { sessionId, taskId } = await chatService.startOrContinueChat(user, team.id, {
        agentId: 'test-agent-id',
        textPrompt: 'long execution',
        projectId: project.id,
      })

      // Mark the task as processing
      await prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: 'processing' },
      })

      const cancelSpy = vi.spyOn(workflowService, 'cancel').mockResolvedValue(undefined)

      await chatService.abortSession(user.id, sessionId)

      expect(cancelSpy).toHaveBeenCalledWith(taskId)

      const updatedTask = await prisma.workflowTask.findUnique({
        where: { id: taskId },
      })
      expect(updatedTask?.status).toBe('failed')
      expect(updatedTask?.output).toEqual({ error: 'aborted' })

      cancelSpy.mockRestore()
    })

    it('throws error if session not found', async () => {
      await expect(chatService.abortSession('user-1', 'non-existent-session')).rejects.toThrow(
        'Session not found',
      )
    })

    it('throws error if unauthorized', async () => {
      const { team, project } = await setupBasicData()
      const otherUser = await prisma.user.create({
        data: { name: 'Other User', email: `other-${Date.now()}@example.com`, password: 'pw' },
      })
      const { sessionId } = await chatService.startOrContinueChat(otherUser, team.id, {
        agentId: 'test-agent-id',
        textPrompt: 'hello',
        projectId: project.id,
      })

      await expect(chatService.abortSession('different-user-id', sessionId)).rejects.toThrow(
        'Unauthorized session access',
      )
    })

    it('throws error if no active task', async () => {
      const { user, team, project } = await setupBasicData()
      const { sessionId, taskId } = await chatService.startOrContinueChat(user, team.id, {
        agentId: 'test-agent-id',
        textPrompt: 'hello',
        projectId: project.id,
      })

      // Complete the task
      await prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: 'completed' },
      })

      await expect(chatService.abortSession(user.id, sessionId)).rejects.toThrow(
        'No active execution found for this session',
      )
    })
  })
})
