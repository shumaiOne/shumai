import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { s3Service } from '@shumai/core/src/s3/s3'
import { AgentHarness } from '@earendil-works/pi-agent-core'
import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')

describe.each(['local', 'temporal'] as const)('Workflow E2E - agentChat (executor: %s)', (mode) => {
  setupTestDbHooks()

  let agentWorkerPromise: Promise<void> | null = null

  beforeAll(async () => {
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket-chat'
    process.env.GEMINI_API_KEY = 'dummy-key'

    workflowService.setExecutorType(mode)
    initAgentWorkflows()

    vi.spyOn(AgentHarness.prototype, 'prompt').mockResolvedValue({
      content: [{ type: 'text', text: 'E2E Agent Chat Response Success' }],
      usage: { input: 10, output: 20 },
      stopReason: 'stop',
    } as unknown as Awaited<ReturnType<typeof AgentHarness.prototype.prompt>>)

    if (mode === 'temporal') {
      console.log('Starting background worker for chat Temporal E2E tests...')
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
    try {
      console.log('Cleaning up local E2E storage files...')
      await s3Service.deletePrefix('shumai-e2e-test-bucket-chat', '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

  it('should run agentChat workflow with userCommentId and reply comment successfully', async () => {
    // 1. Seed Database
    const team = await prisma.team.create({
      data: { name: 'E2E Chat Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Chat Project', teamId: team.id },
    })

    const agentUser = await prisma.user.create({
      data: {
        name: 'E2E Chat Agent User',
        email: 'e2e-chat-agent@shumai.ai',
        type: 'agent',
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: agentUser.id,
        role: 'editor',
      },
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
          input: ['text', 'image'],
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
        config: {
          provider: 'google',
          model: 'gemini',
        },
      },
    })

    const asset = await prisma.asset.create({
      data: {
        name: 'chat-asset.png',
        type: 'file',
        status: 'uploaded',
        mediaType: 'image/png',
        projectId: project.id,
      },
    })

    // Create a regular user who authors the comment
    const regularUser = await prisma.user.create({
      data: {
        name: 'Regular User',
        email: 'user@example.com',
        type: 'human',
      },
    })

    // Create AgentSession first
    await prisma.agentSession.create({
      data: {
        id: 'chat-session-123',
        agentId: agentUser.id,
        userId: regularUser.id,
        cwd: process.cwd(),
        assetId: asset.id,
      },
    })

    // Create the User Comment
    const userComment = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        message: 'Hello E2E Agent!',
        creatorId: regularUser.id,
        sessionId: 'chat-session-123',
      },
    })

    // 2. Create Workflow Task
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
            sessionId: 'chat-session-123',
            userCommentId: userComment.id,
            userId: regularUser.id,
          },
        },
      },
    })

    // 3. Wait for workflow to complete
    console.log(
      `Submitted E2E Chat Workflow Task with Comment. ID: ${task.id}. Awaiting completion...`,
    )
    const completedTask = await workflowService.executeWait(task, 45000)

    // 4. Verification
    expect(completedTask.status).toBe('completed')

    // Verify reply comment in DB
    const comments = await prisma.assetComment.findMany({
      where: {
        assetId: asset.id,
        replyToId: userComment.id,
      },
    })
    expect(comments.length).toBeGreaterThan(0)
    expect(comments[0].message).toBe('E2E Agent Chat Response Success')
    expect(comments[0].creatorId).toBe(agentUser.id)
  }, 50000)

  it('should run agentChat workflow with direct prompt successfully', async () => {
    // 1. Seed Database
    const team = await prisma.team.create({
      data: { name: 'E2E Direct Chat Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Direct Chat Project', teamId: team.id },
    })

    const agentUser = await prisma.user.create({
      data: {
        name: 'E2E Direct Chat Agent User',
        email: 'e2e-dir-chat-agent@shumai.ai',
        type: 'agent',
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: agentUser.id,
        role: 'editor',
      },
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
        config: {
          provider: 'google',
          model: 'gemini',
        },
      },
    })

    const asset = await prisma.asset.create({
      data: {
        name: 'direct-chat-asset.png',
        type: 'file',
        status: 'uploaded',
        mediaType: 'image/png',
        projectId: project.id,
      },
    })

    const regularUser = await prisma.user.create({
      data: {
        name: 'Regular User 2',
        email: 'user2@example.com',
        type: 'human',
      },
    })

    // Create AgentSession first
    await prisma.agentSession.create({
      data: {
        id: 'direct-session-456',
        agentId: agentUser.id,
        userId: regularUser.id,
        cwd: process.cwd(),
        assetId: asset.id,
      },
    })

    // 2. Create Workflow Task (without userCommentId, but with prompt/sessionId)
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
            sessionId: 'direct-session-456',
            prompt: 'Direct test message',
            userId: regularUser.id,
          },
        },
      },
    })

    // 3. Wait for workflow to complete
    console.log(`Submitted E2E Direct Chat Workflow Task. ID: ${task.id}. Awaiting completion...`)
    const completedTask = await workflowService.executeWait(task, 45000)

    // 4. Verification
    expect(completedTask.status).toBe('completed')
    expect((completedTask.output as unknown as { sessionId: string })?.sessionId).toBe(
      'direct-session-456',
    )
  }, 50000)
})
