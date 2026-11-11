import { fauxAssistantMessage } from '@earendil-works/pi-ai'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService } from '@shumai/workflow-core'
import { describe, expect, it, vi } from 'vitest'
import { appendSessionEntries } from '../agent/session-test-utils'
import { chatService } from './chat'

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

  it('should enforce agent permissions in startOrContinueChat', async () => {
    const { team, project } = await setupBasicData()

    // Create an owner-only agent
    const ownerAgentUser = await prisma.user.create({
      data: {
        name: 'Owner Agent User',
        email: `owner-agent-${Date.now()}@shumai.ai`,
        type: 'agent',
      },
    })
    const ownerAgent = await prisma.agent.create({
      data: {
        id: ownerAgentUser.id,
        teamId: team.id,
        type: 'chat',
        permission: 'owner',
        config: { provider: 'p', model: 'm' },
      },
    })

    // Create an editor user and a reviewer user
    const editorUser = await prisma.user.create({
      data: { name: 'Editor User', email: `ed-${Date.now()}@shumai.ai`, password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: editorUser.id, role: 'editor' },
    })

    const reviewerUser = await prisma.user.create({
      data: { name: 'Reviewer User', email: `rev-${Date.now()}@shumai.ai`, password: 'pw' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: reviewerUser.id, role: 'reviewer' },
    })

    // Editor trying to chat with owner-only agent should fail
    await expect(
      chatService.startOrContinueChat(editorUser, team.id, {
        agentId: ownerAgent.id,
        textPrompt: 'test',
        projectId: project.id,
      }),
    ).rejects.toThrow('Permission denied')

    // Reviewer trying to chat with owner-only agent should fail
    await expect(
      chatService.startOrContinueChat(reviewerUser, team.id, {
        agentId: ownerAgent.id,
        textPrompt: 'test',
        projectId: project.id,
      }),
    ).rejects.toThrow('Permission denied')
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

  it('returns native entries with structured context and model messages', async () => {
    const { user, team, project } = await setupBasicData()
    const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
      agentId: 'test-agent-id',
      textPrompt: 'hello',
      projectId: project.id,
    })
    await appendSessionEntries(sessionId, [
      {
        kind: 'shumai.message',
        data: { displayText: 'hello', timestamp: 1, context: {} },
        model: [{ role: 'user', content: 'hello', timestamp: 1 }],
      },
      { kind: 'pi.assistant', model: [fauxAssistantMessage('answer')] },
      { kind: 'pi.compaction', data: { reason: 'manual' } },
    ])
    const messages = await chatService.listMessages(user.id, team.id, sessionId)
    expect(messages.map((entry) => entry.kind)).toEqual([
      'shumai.message',
      'pi.assistant',
      'pi.compaction',
    ])
    expect(messages[0]).toMatchObject({
      data: { displayText: 'hello' },
      model: [{ role: 'user', content: 'hello' }],
    })
    expect(typeof messages[0].id).toBe('number')
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

  describe('getNewSessionMessages', () => {
    it('returns new messages and lastEntryId', async () => {
      const { user, team, project } = await setupBasicData()
      const { sessionId } = await chatService.startOrContinueChat(user, team.id, {
        agentId: 'test-agent-id',
        textPrompt: 'hello',
        projectId: project.id,
      })

      const [entry1, entry2] = await appendSessionEntries(sessionId, [
        { kind: 'pi.user', model: [{ role: 'user', content: 'msg 1', timestamp: 1 }] },
        { kind: 'pi.assistant', model: [fauxAssistantMessage('msg 2')] },
      ])

      // 1. Get all messages
      const res1 = await chatService.getNewSessionMessages(sessionId)
      expect(res1.messages).toHaveLength(2)
      expect(res1.lastEntryId).toBe(String(entry2.id))
      expect(res1.messages[0].id).toBe(entry1.id)

      // 2. Get with lastEntryId
      const res2 = await chatService.getNewSessionMessages(sessionId, String(entry1.id))
      expect(res2.messages).toHaveLength(1)
      expect(res2.lastEntryId).toBe(String(entry2.id))
      expect(res2.messages[0].id).toBe(entry2.id)

      // 3. Get with latest lastEntryId
      const res3 = await chatService.getNewSessionMessages(sessionId, String(entry2.id))
      expect(res3.messages).toHaveLength(0)
      expect(res3.lastEntryId).toBe(String(entry2.id))
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
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: otherUser.id, role: 'reviewer' },
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

  describe('project-aware agent permission checks', () => {
    async function setupProjectRoles() {
      const team = await prisma.team.create({
        data: {
          name: 'Team Roles',
          settings: { transcode: { videoStrategy: 'best_match' }, chatbotAgentId: 'test-agent-id' },
          sandbox: { create: {} },
        },
      })
      const project = await prisma.project.create({
        data: { name: 'Proj Roles', teamId: team.id },
      })
      const rootFolder = await prisma.asset.create({
        data: { name: 'root', type: 'root', status: 'processed', projectId: project.id },
      })
      await prisma.project.update({
        where: { id: project.id },
        data: { rootFolderId: rootFolder.id },
      })

      const createAgent = async (name: string, permission: 'owner' | 'editor' | 'reviewer') => {
        const agentUser = await prisma.user.create({
          data: { name, email: `${name}-${Date.now()}@shumai.ai`, type: 'agent' },
        })
        return prisma.agent.create({
          data: {
            id: agentUser.id,
            teamId: team.id,
            type: 'chat',
            permission,
            config: { provider: 'openai', model: 'gpt-4' },
          },
        })
      }

      const editorAgent = await createAgent('Editor Agent', 'editor')
      const ownerAgent = await createAgent('Owner Agent', 'owner')

      // Team editor demoted to project reviewer
      const demoted = await prisma.user.create({
        data: { name: 'Demoted', email: `dem-${Date.now()}@x.com`, password: 'pw' },
      })
      const demotedTm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: demoted.id, role: 'editor', scope: 'team' },
      })
      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: demotedTm.id, role: 'reviewer' },
      })

      // Project-scoped member invited as editor
      const projEditor = await prisma.user.create({
        data: { name: 'Proj Editor', email: `pe-${Date.now()}@x.com`, password: 'pw' },
      })
      const projEditorTm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: projEditor.id, role: 'reviewer', scope: 'project' },
      })
      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: projEditorTm.id, role: 'editor' },
      })

      // Team reviewer promoted to project owner
      const promoted = await prisma.user.create({
        data: { name: 'Promoted', email: `pro-${Date.now()}@x.com`, password: 'pw' },
      })
      const promotedTm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: promoted.id, role: 'reviewer', scope: 'team' },
      })
      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: promotedTm.id, role: 'owner' },
      })

      // Plain team reviewer (no project override)
      const reviewer = await prisma.user.create({
        data: { name: 'Reviewer', email: `rev-${Date.now()}@x.com`, password: 'pw' },
      })
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: reviewer.id, role: 'reviewer', scope: 'team' },
      })

      return { team, project, editorAgent, ownerAgent, demoted, projEditor, promoted, reviewer }
    }

    it('denies an editor agent to a team editor demoted to project reviewer', async () => {
      const { team, project, editorAgent, demoted } = await setupProjectRoles()
      await expect(
        chatService.startOrContinueChat(demoted, team.id, {
          agentId: editorAgent.id,
          textPrompt: 'hello',
          projectId: project.id,
        }),
      ).rejects.toThrow(/Insufficient role/)
    })

    it('allows an editor agent to a project-scoped member invited as editor', async () => {
      const { team, project, editorAgent, projEditor } = await setupProjectRoles()
      const { sessionId } = await chatService.startOrContinueChat(projEditor, team.id, {
        agentId: editorAgent.id,
        textPrompt: 'hello',
        projectId: project.id,
      })
      expect(sessionId).toBeDefined()
    })

    it('allows an owner agent to a team reviewer promoted to project owner', async () => {
      const { team, project, ownerAgent, promoted } = await setupProjectRoles()
      const { sessionId } = await chatService.startOrContinueChat(promoted, team.id, {
        agentId: ownerAgent.id,
        textPrompt: 'hello',
        projectId: project.id,
      })
      expect(sessionId).toBeDefined()
    })

    it('denies an editor agent to a plain team reviewer', async () => {
      const { team, project, editorAgent, reviewer } = await setupProjectRoles()
      await expect(
        chatService.startOrContinueChat(reviewer, team.id, {
          agentId: editorAgent.id,
          textPrompt: 'hello',
          projectId: project.id,
        }),
      ).rejects.toThrow(/Insufficient role/)
    })

    it('should forward annotations and second to workflow task payload', async () => {
      const { user, team, project } = await setupBasicData()

      const { sessionId, taskId } = await chatService.startOrContinueChat(user, team.id, {
        agentId: 'test-agent-id',
        textPrompt: 'Check out this area',
        projectId: project.id,
        annotations: [{ type: 'rectangle', x: 10, y: 20, width: 30, height: 40 }],
        second: 8.5,
      })

      expect(sessionId).toBeDefined()
      expect(taskId).toBeDefined()

      const task = await prisma.workflowTask.findUnique({
        where: { id: taskId },
      })
      expect(task).toBeDefined()
      expect(task?.payload?.agent?.second).toBe(8.5)
      expect(task?.payload?.agent?.annotations).toEqual([
        { type: 'rectangle', x: 10, y: 20, width: 30, height: 40 },
      ])
    })
  })
})
