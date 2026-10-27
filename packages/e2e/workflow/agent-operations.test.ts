import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { s3Service } from '@shumai/core/src/s3/s3'
import { metadataService } from '@shumai/core/src/metadata/metadata'
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
  let scenario: 'organize' | 'review' = 'organize'
  // Used by the review scenario
  let projectId = ''
  let reviewFieldKey = ''
  let promptFieldKey = ''

  const reply = (text: string) =>
    ({
      content: [{ type: 'text', text }],
      usage: { input: 10, output: 20 },
      stopReason: 'stop',
    }) as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>

  beforeAll(async () => {
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket-agent-ops'
    process.env.GEMINI_API_KEY = 'dummy-key'

    initAgentWorkflows()

    vi.spyOn(AgentHarness.prototype, 'prompt').mockImplementation(async function (
      this: AgentHarness,
    ) {
      const tool = (name: string) =>
        this.getTools().find((t) => t.name === name) as unknown as ExecutableTool | undefined
      const call = async (name: string, params: Record<string, unknown>) => {
        const t = tool(name)
        if (!t) throw new Error(`missing tool ${name}`)
        return JSON.parse(toolText(await t.execute(`call-${name}`, params))) as unknown
      }

      if (scenario === 'review') {
        const found = (await call('search_assets', { parent: rootFolderId, query: 'brief' })) as {
          data: Array<{ id: string; name: string }>
        }
        const assetId = found.data[0].id
        const comment = (await call('create_comment', {
          assetId,
          message: 'The logo is too small',
        })) as { id: string }
        const listed = (await call('list_comments', { assetId })) as {
          data: Array<{ id: string; message: string }>
        }
        await call('resolve_comment', { commentId: comment.id })
        const { fields } = (await call('list_metadata_fields', { projectId })) as {
          fields: Array<{ key: string; creationContext: boolean }>
        }
        await call('update_asset_metadata', {
          assetId,
          values: { [reviewFieldKey]: 'Needs changes' },
        })
        const file = (await call('create_file', {
          parent: rootFolderId,
          name: 'review-notes.md',
          content: '# Review\n\nLogo too small.',
          metadata: { [promptFieldKey]: 'Summarize the review' },
        })) as { id: string }
        const creationFields = fields.filter((f) => f.creationContext).map((f) => f.key)
        return reply(
          [
            `found:${found.data.map((a) => a.name).join(',')}`,
            `comment:${comment.id}`,
            `listed:${listed.data.map((c) => c.message).join(',')}`,
            `creation_fields:${creationFields.join(',')}`,
            `file:${file.id}`,
            `complete_tool:${tool('complete_upload') ? 'present' : 'absent'}`,
          ].join('|'),
        )
      }

      const createFolder = tool('create_folder')
      const listAssets = tool('list_assets')
      const deleteAsset = tool('delete_asset')
      if (!createFolder || !listAssets) {
        return reply('MISSING_OPERATION_TOOLS')
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
      return reply(summary)
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

  /** A team, project, chat agent, and a user comment asking the agent to act; returns the task. */
  async function setupChat(label: string, message: string) {
    const team = await prisma.team.create({ data: { name: `E2E Agent Ops Team ${label}` } })
    const regularUser = await prisma.user.create({
      data: { name: 'Ops User', email: `ops-user-${label}@example.com`, type: 'human' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: regularUser.id, role: 'owner' },
    })
    const project = await projectService.createProject(regularUser, {
      teamId: team.id,
      name: `E2E Agent Ops Project ${label}`,
    })
    rootFolderId = project.rootFolder!
    projectId = project.id

    const agentUser = await prisma.user.create({
      data: { name: 'E2E Ops Agent', email: `e2e-ops-agent-${label}@shumai.ai`, type: 'agent' },
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
    const sessionId = `agent-ops-session-${label}`
    await prisma.agentSession.create({
      data: { id: sessionId, agentId: agentUser.id, userId: regularUser.id, cwd: process.cwd() },
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
      data: { assetId: asset.id, message, creatorId: regularUser.id, sessionId },
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
            sessionId,
            userCommentId: userComment.id,
            userId: regularUser.id,
          },
        },
      },
    })
    return { team, project, regularUser, agentUser, asset, userComment, task }
  }

  async function agentReply(assetId: string, userCommentId: string) {
    const [reply] = await prisma.assetComment.findMany({
      where: { assetId, replyToId: userCommentId },
    })
    return reply?.message ?? ''
  }

  it('creates and lists assets through Operations, attributed to the user and agent', async () => {
    scenario = 'organize'
    const { team, project, regularUser, agentUser, asset, userComment, task } = await setupChat(
      'organize',
      'Create a folder called Agent Folder and list the root',
    )

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

    const message = await agentReply(asset.id, userComment.id)
    expect(message).toContain(`created:${folder.id}`)
    expect(message).toMatch(/listed:.*Agent Folder/)
    expect(message).toContain('delete_tool:absent')
  }, 50000)

  it('reviews a file: search, comment, resolve, set metadata, and write notes with Creation Context', async () => {
    scenario = 'review'
    const setup = await setupChat('review', 'Review the brief and write up notes')
    const { team, project, regularUser, agentUser, asset, userComment, task } = setup
    const review = await metadataService.createProjectField(project.id, {
      config: { name: 'Review', type: 'text' },
      description: '',
    })
    const prompt = await metadataService.createProjectField(project.id, {
      config: { name: 'Prompt', type: 'text', autofillSource: 'CREATION_CONTEXT' },
      description: 'What the agent was asked to do',
    })
    reviewFieldKey = review.key
    promptFieldKey = prompt.key

    const completedTask = await workflowService.executeWait(task, 45000)
    expect(completedTask.status).toBe('completed')

    const message = await agentReply(asset.id, userComment.id)
    expect(message).toContain('found:brief.png')
    expect(message).toMatch(/listed:[^|]*The logo is too small/)
    expect(message).toContain(`creation_fields:${prompt.key}`)
    // The agent finishes its own uploads; complete_upload is an MCP-only tool
    expect(message).toContain('complete_tool:absent')

    // The comment is posted as the user, resolved, and audited as coming from the agent
    const comment = await prisma.assetComment.findFirstOrThrow({
      where: { assetId: asset.id, message: 'The logo is too small' },
    })
    expect(comment.creatorId).toBe(regularUser.id)
    expect(comment.isCompleted).toBe(true)
    for (const action of ['comment_create', 'comment_complete']) {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action, itemId: comment.id },
      })
      expect(audit).toMatchObject({
        teamId: team.id,
        userId: regularUser.id,
        agentId: agentUser.id,
        via: 'agent',
      })
    }

    const reviewValue = await prisma.assetMetadataValue.findFirstOrThrow({
      where: { assetId: asset.id, fieldKey: review.key },
    })
    expect(reviewValue.stringValue).toBe('Needs changes')

    // The notes file is stored, attributed to the user and agent, with Creation Context
    const fileId = /file:([A-Z0-9]+)/.exec(message)?.[1]
    const notes = await prisma.asset.findUniqueOrThrow({
      where: { id: fileId },
      include: { storageKey: true, metadataValues: true },
    })
    expect(notes).toMatchObject({
      name: 'review-notes.md',
      parentId: rootFolderId,
      creatorId: regularUser.id,
      agentId: agentUser.id,
    })
    const stored = await s3Service.getObject(
      'shumai-e2e-test-bucket-agent-ops',
      notes.storageKey!.key,
    )
    expect(stored.buffer.toString('utf-8')).toBe('# Review\n\nLogo too small.')
    expect(notes.metadataValues).toContainEqual(
      expect.objectContaining({ fieldKey: prompt.key, stringValue: 'Summarize the review' }),
    )
    const fileAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'file_create', itemId: notes.id },
    })
    expect(fileAudit).toMatchObject({ agentId: agentUser.id, via: 'agent' })
  }, 50000)
})
