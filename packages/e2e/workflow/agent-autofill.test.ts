import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')

// No module mocks needed because we override activities directly in the global registry below

describe('Workflow E2E - agentAutofillMedia', () => {
  setupTestDbHooks()

  let agentWorkerPromise: Promise<void> | null = null
  let transcodeWorkerPromise: Promise<void> | null = null

  beforeAll(async () => {
    // Set bucket environment
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket'

    // Initialize registries
    initAgentWorkflows()
    initTranscodeWorkflows()

    // Override the AI activity with a mock implementation in the global registry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localActs = (globalThis as any).__localActivities
    if (localActs) {
      localActs.autofillAiActivity = async () => {
        return {
          text: JSON.stringify({ title: 'E2E Title Extracted' }),
          usage: { inputTokens: 10, outputTokens: 20, model: 'gemini' },
          sessionId: 'mock-session-123',
        }
      }
    }

    const type = process.env.WORKFLOW_EXECUTOR || 'local'
    if (type === 'temporal') {
      console.log('Starting background workers for Temporal E2E tests...')
      agentWorkerPromise = workflowService.startWorkers(TaskQueueAgent, {
        workflowsPath: agentWorkflowsPath,
      })
      transcodeWorkerPromise = workflowService.startWorkers(TaskQueueTranscode, {
        workflowsPath: transcodeWorkflowsPath,
      })

      // Wait a moment for workers to establish connections
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } else {
      console.log('Starting local workflow service polling...')
      workflowService.start()
    }
  })

  afterAll(async () => {
    const type = process.env.WORKFLOW_EXECUTOR || 'local'
    if (type === 'temporal') {
      console.log('Shutting down Temporal workers...')
      await workflowService.shutdownWorkers()
      await Promise.all([agentWorkerPromise, transcodeWorkerPromise].filter(Boolean))
    }

    workflowService.close()

    // Clean up E2E files in local filesystem storage
    try {
      console.log('Cleaning up local E2E storage files...')
      await s3Service.deletePrefix('shumai-e2e-test-bucket', '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

  it('should run agentAutofillMedia workflow and update asset metadata successfully', async () => {
    // 1. Seed Database Models
    const team = await prisma.team.create({
      data: { name: 'E2E Test Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Test Project', teamId: team.id },
    })

    // Create Metadata Field (aiAutofill = true)
    await prisma.metadataField.create({
      data: {
        key: 'title',
        scope: 'PROJECT',
        projectId: project.id,
        teamId: team.id,
        config: { name: 'Title', type: 'text' },
        aiAutofill: true,
        description: 'Auto-extracted title',
      },
    })

    // Create Agent User
    const agentUser = await prisma.user.create({
      data: {
        name: 'E2E Autofill Agent User',
        email: 'e2e-autofill-agent@shumai.ai',
        type: 'agent',
      },
    })

    // Link Agent User to Team
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: agentUser.id,
        role: 'editor',
      },
    })

    // Setup Agent Provider & Model configuration
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

    const agent = await prisma.agent.create({
      data: {
        id: agentUser.id,
        teamId: team.id,
        type: 'autofill',
        enabled: true,
        providerId: provider.id,
        modelId: model.id,
        config: {
          provider: 'google',
          model: 'gemini',
        },
      },
    })

    // Create StorageKey first
    const storageKey = await prisma.storageKey.create({
      data: {
        key: 'projects/e2e/test-image.png',
      },
    })

    // Create Asset
    const asset = await prisma.asset.create({
      data: {
        name: 'test-image.png',
        type: 'file',
        status: 'uploaded',
        mediaType: 'image/png',
        projectId: project.id,
        storageKeyId: storageKey.id,
      },
    })

    // 2. Seed S3 Storage (LocalStorageService) with a valid 1x1 base64-encoded PNG image
    const base64Png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const pngBuffer = Buffer.from(base64Png, 'base64')
    await s3Service.putObject(
      'shumai-e2e-test-bucket',
      'projects/e2e/test-image.png',
      pngBuffer,
      pngBuffer.length,
      'image/png',
    )

    // 3. Create Workflow Task (ai_metadata_autofill, pending)
    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: asset.id,
        projectId: project.id,
        teamId: team.id,
        payload: {
          projectId: project.id,
          agent: { sessionId: 'mock-session-123', agentId: agent.id },
        },
      },
    })

    // 4. Wait for workflow to complete
    console.log(`Submitted E2E Workflow Task. ID: ${task.id}. Awaiting completion...`)
    const completedTask = await workflowService.executeWait(task, 45000)

    // 5. Verification
    expect(completedTask.status).toBe('completed')

    // Verify placeholder comment is updated correctly
    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(comments.length).toBeGreaterThan(0)
    // The last updated message of placeholder comment should indicate success
    const finalComment = comments[comments.length - 1]
    expect(finalComment.message).toBe('Autofill completed successfully.')

    // Verify AssetMetadataValue contains the AI-extracted title
    const metadataValue = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: 'title',
        },
      },
    })
    expect(metadataValue).toBeDefined()
    expect(metadataValue?.stringValue).toBe('E2E Title Extracted')
  }, 50000)
})
