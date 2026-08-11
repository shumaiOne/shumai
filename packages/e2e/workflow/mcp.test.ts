import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { s3Service } from '@shumai/core/src/s3/s3'
import { mcpService } from '@shumai/core/src/mcp/mcp-service'
import {
  startTestMcpServer,
  standardTestTools,
  type RunningTestMcpServer,
} from '@shumai/core/src/mcp/mcp-test-server'
import { AgentHarness } from '@earendil-works/pi-agent-core'
import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')

describe.each(['local', 'temporal'] as const)('Workflow E2E - MCP tools (executor: %s)', (mode) => {
  setupTestDbHooks()

  let agentWorkerPromise: Promise<void> | null = null
  let mcpTestServer: RunningTestMcpServer

  beforeAll(async () => {
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket-mcp'
    process.env.GEMINI_API_KEY = 'dummy-key'

    // Real in-process MCP server — only AI calls are mocked. It self-reports
    // the name 'e2e-mcp' so discovery auto-fills the DB name/tool prefixes
    // exactly as the tests expect.
    mcpTestServer = await startTestMcpServer({
      tools: standardTestTools(),
      serverInfo: { name: 'e2e-mcp' },
    })

    workflowService.setExecutorType(mode)
    initAgentWorkflows()

    // Mock ONLY the AI model call. The mocked prompt locates the real `mcp`
    // proxy tool on the harness and executes it against the real MCP server,
    // so the full createAgentSession → buildAgentTools → proxy execute →
    // callMcpTool → MCP server path is exercised.
    vi.spyOn(AgentHarness.prototype, 'prompt').mockImplementation(async function (
      this: AgentHarness,
    ) {
      const tools = this.getTools()
      const mcpTool = tools.find((t) => t.name === 'mcp')
      if (!mcpTool) {
        return {
          content: [{ type: 'text', text: 'NO_MCP_TOOL' }],
          usage: { input: 10, output: 20 },
          stopReason: 'stop',
        } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
      }
      const result = await (
        mcpTool.execute as unknown as (
          id: string,
          params: { server: string; tool: string; args: Record<string, unknown> },
        ) => Promise<{ content: Array<{ type: string; text?: string }> }>
      )('e2e-call', {
        server: 'e2e-mcp',
        tool: 'echo',
        args: { text: 'hello from mcp e2e' },
      })
      const text = result.content
        .map((c) => ('text' in c && typeof c.text === 'string' ? c.text : ''))
        .join('\n')
      return {
        content: [{ type: 'text', text }],
        usage: { input: 10, output: 20 },
        stopReason: 'stop',
      } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
    })

    if (mode === 'temporal') {
      console.log('Starting background worker for MCP Temporal E2E tests...')
      agentWorkerPromise = workflowService.startWorkers(TaskQueueAgent, {
        workflowsPath: agentWorkflowsPath,
      })
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } else {
      console.log('Starting local workflow service polling...')
      workflowService.start()
    }
  })

  afterAll(async () => {
    if (mode === 'temporal') {
      console.log('Shutting down Temporal workers...')
      await workflowService.shutdownWorkers()
      await Promise.all([agentWorkerPromise].filter(Boolean))
    }
    workflowService.close()
    vi.restoreAllMocks()
    await mcpService.closeAllConnections()
    await mcpTestServer.stop()
    try {
      console.log('Cleaning up local E2E storage files...')
      await s3Service.deletePrefix('shumai-e2e-test-bucket-mcp', '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

  async function seedChatSetup() {
    const team = await prisma.team.create({
      data: { name: `MCP E2E Team (${mode})` },
    })

    const project = await prisma.project.create({
      data: { name: 'MCP E2E Project', teamId: team.id },
    })

    const agentUser = await prisma.user.create({
      data: {
        name: 'MCP E2E Agent',
        email: `mcp-e2e-${mode}@shumai.ai`,
        type: 'agent',
      },
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

    const asset = await prisma.asset.create({
      data: {
        name: 'mcp-chat-asset.png',
        type: 'file',
        status: 'uploaded',
        mediaType: 'image/png',
        projectId: project.id,
      },
    })

    const regularUser = await prisma.user.create({
      data: {
        name: 'MCP Regular User',
        email: `mcp-user-${mode}@example.com`,
        type: 'human',
      },
    })

    await prisma.teamMember.create({
      data: { teamId: team.id, userId: regularUser.id, role: 'reviewer' },
    })

    await prisma.agentSession.create({
      data: {
        id: `mcp-session-${mode}`,
        agentId: agentUser.id,
        userId: regularUser.id,
        cwd: process.cwd(),
        assetId: asset.id,
      },
    })

    return { team, project, agentUser, asset, regularUser }
  }

  async function createMcpServerAndAssign(teamId: string, agentId: string, config?: object) {
    const server = await prisma.mcpServer.create({
      data: {
        name: 'e2e-mcp',
        url: mcpTestServer.url,
        teamId,
        config: (config ?? {}) as PrismaJson.McpServerConfig,
      },
    })
    await prisma.agentMcpServer.create({ data: { agentId, mcpServerId: server.id } })
    // Mirrors the admin flow: refresh the server so its tools are cached in
    // DB and warmed in the in-process registry (buildAgentTools needs the
    // cache to register direct tools before any chat turn runs).
    await mcpService.refreshServer(server.id)
    return server
  }

  it('runs a chat that calls the mcp proxy tool against a real MCP server', async () => {
    const { team, project, agentUser, asset, regularUser } = await seedChatSetup()
    await createMcpServerAndAssign(team.id, agentUser.id)

    const userComment = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        message: 'Please use the MCP server',
        creatorId: regularUser.id,
        sessionId: `mcp-session-${mode}`,
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
            sessionId: `mcp-session-${mode}`,
            userCommentId: userComment.id,
            userId: regularUser.id,
          },
        },
      },
    })

    console.log(`Submitted MCP E2E Chat Task. ID: ${task.id}. Awaiting completion...`)
    const completedTask = await workflowService.executeWait(task, 45000)

    expect(completedTask.status).toBe('completed')

    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id, replyToId: userComment.id },
    })
    expect(comments.length).toBeGreaterThan(0)
    // The reply is the mocked model's text, which is the REAL MCP echo result.
    expect(comments[0].message).toContain('echo:hello from mcp e2e')
  }, 50000)

  it('runs a chat with direct-tools mode (server-prefixed native tools)', async () => {
    const { team, project, agentUser, asset, regularUser } = await seedChatSetup()
    await createMcpServerAndAssign(team.id, agentUser.id, { directTools: true })

    // For direct mode the model would call `e2e_mcp_echo` directly; simulate
    // that by executing the direct tool on the harness.
    const directSpy = vi
      .spyOn(AgentHarness.prototype, 'prompt')
      .mockImplementationOnce(async function (this: AgentHarness) {
        const tools = this.getTools()
        const echoTool = tools.find((t) => t.name === 'e2e_mcp_echo')
        if (!echoTool) {
          return {
            content: [{ type: 'text', text: 'NO_DIRECT_TOOL' }],
            usage: { input: 1, output: 1 },
            stopReason: 'stop',
          } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
        }
        const result = await (
          echoTool.execute as unknown as (
            id: string,
            params: Record<string, unknown>,
          ) => Promise<{ content: Array<{ type: string; text?: string }> }>
        )('e2e-direct', {
          text: 'direct call',
        })
        const text = result.content
          .map((c) => ('text' in c && typeof c.text === 'string' ? c.text : ''))
          .join('\n')
        return {
          content: [{ type: 'text', text }],
          usage: { input: 1, output: 1 },
          stopReason: 'stop',
        } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>
      })

    const userComment = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        message: 'Use the direct tool',
        creatorId: regularUser.id,
        sessionId: `mcp-session-${mode}`,
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
            sessionId: `mcp-session-${mode}`,
            userCommentId: userComment.id,
            userId: regularUser.id,
          },
        },
      },
    })

    const completedTask = await workflowService.executeWait(task, 45000)
    expect(completedTask.status).toBe('completed')

    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id, replyToId: userComment.id },
    })
    expect(comments.length).toBeGreaterThan(0)
    expect(comments[0].message).toContain('echo:direct call')
    directSpy.mockRestore()
  }, 50000)
})
