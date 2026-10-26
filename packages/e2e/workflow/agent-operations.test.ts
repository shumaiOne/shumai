import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { s3Service } from '@shumai/core/src/s3/s3'
import { projectService } from '@shumai/core/src/project/project'
import { AgentHarness } from '@earendil-works/pi-agent-core'

type ToolResult = { content: Array<{ type: string; text?: string }> }
type ExecutableTool = {
  execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>
}

const toolText = (result: ToolResult) =>
  result.content.map((c) => (typeof c.text === 'string' ? c.text : '')).join('\n')

/**
 * Exercises the Operation-backed agent tools through the real chat workflow:
 * createAgentSession → buildOperationTools → runOperation → core services → DB.
 * Only the model call is mocked; it invokes the tools the way a model would.
 */
describe('Workflow E2E - agent Operation tools', () => {
  setupTestDbHooks()

  let rootFolderId = ''

  beforeAll(async () => {
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket-agent-ops'
    process.env.GEMINI_API_KEY = 'dummy-key'

    initAgentWorkflows()

    vi.spyOn(AgentHarness.prototype, 'prompt').mockImplementation(async function (
      this: AgentHarness,
    ) {
      const tool = (name: string) =>
        this.getTools().find((t) => t.name === name) as unknown as ExecutableTool | undefined

      const createFolder = tool('create_folder')
      const listAssets = tool('list_assets')
      const deleteAsset = tool('delete_asset')
      if (!createFolder || !listAssets) {
        return {
          content: [{ type: 'text', text: 'MISSING_OPERATION_TOOLS' }],
          usage: { input: 1, output: 1 },
          stopReason: 'stop',
        } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
      }

      const created = JSON.parse(
        toolText(
          await createFolder.execute('call-1', { parent: rootFolderId, name: 'Agent Folder' }),
        ),
      ) as { id: string }
      const listed = JSON.parse(
        toolText(await listAssets.execute('call-2', { parent: rootFolderId, type: null })),
      ) as { data: Array<{ id: string; name: string }> }

      const summary = [
        `created:${created.id}`,
        `listed:${listed.data.map((a) => a.name).join(',')}`,
        // delete_asset is denied by default and must not be registered
        `delete_tool:${deleteAsset ? 'present' : 'absent'}`,
      ].join('|')
      return {
        content: [{ type: 'text', text: summary }],
        usage: { input: 10, output: 20 },
        stopReason: 'stop',
      } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
    })

    await workflowService.startWorkers(TaskQueueAgent)
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()
    vi.restoreAllMocks()
    try {
      await s3Service.deletePrefix('shumai-e2e-test-bucket-agent-ops', '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

  it('creates and lists assets through Operations, attributed to the user and agent', async () => {
    const team = await prisma.team.create({ data: { name: 'E2E Agent Ops Team' } })
    const regularUser = await prisma.user.create({
      data: { name: 'Ops User', email: 'ops-user@example.com', type: 'human' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: regularUser.id, role: 'owner' },
    })
    const project = await projectService.createProject(regularUser, {
      teamId: team.id,
      name: 'E2E Agent Ops Project',
    })
    rootFolderId = project.rootFolder!

    const agentUser = await prisma.user.create({
      data: { name: 'E2E Ops Agent', email: 'e2e-ops-agent@shumai.ai', type: 'agent' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: agentUser.id, role: 'editor' },
    })
    const provider = await prisma.provider.create({
      data: {
        name: 'google',
        teamId: team.id,
        config: { api: 'google-generative-ai', apiKey: 'dummy-google-api-key' },
      },
    })
    const model = await prisma.model.create({
      data: {
        modelId: 'gemini',
        name: 'Gemini',
        providerId: provider.id,
        config: {
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 2048,
          reasoning: false,
        },
      },
    })
    await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'chat',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: { provider: 'google', model: 'gemini' },
      },
    })
    await prisma.agentSession.create({
      data: {
        id: 'agent-ops-session',
        agentId: agentUser.id,
        userId: regularUser.id,
        cwd: process.cwd(),
      },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'brief.png',
        type: 'file',
        status: 'uploaded',
        mediaType: 'image/png',
        projectId: project.id,
        parentId: rootFolderId,
      },
    })
    const userComment = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        message: 'Create a folder called Agent Folder and list the root',
        creatorId: regularUser.id,
        sessionId: 'agent-ops-session',
      },
    })

    const task = await prisma.workflowTask.create({
      data: {
        type: 'chat',
        status: 'pending',
        assetId: asset.id,
        projectId: project.id,
        teamId: team.id,
        payload: {
          projectId: project.id,
          agent: {
            agentId: agentUser.id,
            sessionId: 'agent-ops-session',
            userCommentId: userComment.id,
            userId: regularUser.id,
          },
        },
      },
    })

    const completedTask = await workflowService.executeWait(task, 45000)
    expect(completedTask.status).toBe('completed')

    const folder = await prisma.asset.findFirstOrThrow({
      where: { name: 'Agent Folder', parentId: rootFolderId },
    })
    expect(folder.type).toBe('folder')
    expect(folder.creatorId).toBe(regularUser.id)
    expect(folder.agentId).toBe(agentUser.id)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'folder_create', itemId: folder.id },
    })
    expect(audit).toMatchObject({
      teamId: team.id,
      projectId: project.id,
      userId: regularUser.id,
      agentId: agentUser.id,
      via: 'agent',
    })

    const [reply] = await prisma.assetComment.findMany({
      where: { assetId: asset.id, replyToId: userComment.id },
    })
    expect(reply?.message).toContain(`created:${folder.id}`)
    expect(reply?.message).toMatch(/listed:.*Agent Folder/)
    expect(reply?.message).toContain('delete_tool:absent')
  }, 50000)
})
