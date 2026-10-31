import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { AgentHarness } from '@earendil-works/pi-agent-core'

describe('Workflow E2E - agentAutofillMedia', () => {
  setupTestDbHooks()

  beforeAll(async () => {
    // Set bucket environment
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket'

    // Initialize registries
    initAgentWorkflows()
    initTranscodeWorkflows()

    // Spy on the harness prompt method to intercept the LLM call while running real activities & tools
    vi.spyOn(AgentHarness.prototype, 'prompt').mockImplementation(async function (
      this: AgentHarness,
      ...args: unknown[]
    ) {
      // Find the real tools configured on the harness
      const tools = this.getTools()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tool execution mock for E2E harness test
      const readAssetTool = tools.find((t) => t.name === 'read_asset') as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tool execution mock for E2E harness test
      const autofillTool = tools.find((t) => t.name === 'autofill_metadata') as any

      expect(readAssetTool).toBeDefined()
      expect(autofillTool).toBeDefined()

      const promptText = typeof args[0] === 'string' ? args[0] : ''
      const assetIdMatch = promptText.match(/ID:\s*"([^"]+)"/)

      if (readAssetTool && assetIdMatch) {
        const assetId = assetIdMatch[1]
        const readResult = await readAssetTool.execute(
          'call-read-1',
          { assetId },
          undefined,
          undefined,
          undefined,
        )
        expect(readResult).toBeDefined()
        expect(readResult.content).toBeDefined()
      }

      if (autofillTool) {
        // Execute the real tool callback to perform the actual DB updates
        await autofillTool.execute(
          'call-123',
          {
            title: 'E2E Title Extracted',
            confidence: 0.95,
            completed: true,
          },
          undefined,
          undefined,
          undefined,
        )
      }

      // Return a successful assistant response mock
      /* eslint-disable @typescript-eslint/no-explicit-any -- Mock assistant response structure */
      return {
        content: [{ type: 'text', text: 'Success' }],
        usage: { input: 10, output: 20 },
        stopReason: 'stop',
      } as any
      /* eslint-enable @typescript-eslint/no-explicit-any */
    })

    await workflowService.startWorkers([TaskQueueAgent, TaskQueueTranscode])
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()

    // Restore spied methods
    vi.restoreAllMocks()

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

    // Create Metadata Field (autofillSource = CONTENT, text)
    await prisma.metadataField.create({
      data: {
        key: 'title',
        scope: 'PROJECT',
        projectId: project.id,
        teamId: team.id,
        config: { name: 'Title', type: 'text', autofillSource: 'CONTENT' },
        description: 'Auto-extracted title',
      },
    })

    // Create Metadata Field (autofillSource = CONTENT, number)
    await prisma.metadataField.create({
      data: {
        key: 'confidence',
        scope: 'PROJECT',
        projectId: project.id,
        teamId: team.id,
        config: { name: 'Confidence', type: 'number', autofillSource: 'CONTENT' },
        description: 'AI extraction confidence',
      },
    })

    // Create Metadata Field (autofillSource = CONTENT, boolean)
    await prisma.metadataField.create({
      data: {
        key: 'completed',
        scope: 'PROJECT',
        projectId: project.id,
        teamId: team.id,
        config: { name: 'Completed', type: 'toggle', autofillSource: 'CONTENT' },
        description: 'Completed flag',
      },
    })

    // Create Metadata Field (autofillSource = NONE, text)
    await prisma.metadataField.create({
      data: {
        key: 'manual_notes',
        scope: 'PROJECT',
        projectId: project.id,
        teamId: team.id,
        config: { name: 'Manual Notes', type: 'text', autofillSource: 'NONE' },
        description: 'Manual notes (should not be auto-filled)',
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial MediaInfo mock for testing
        media: { proxyType: 'image' } as any,
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

    // Verify no comments created on successful autofill
    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(comments.length).toBe(0)

    // Verify AssetMetadataValue contains the AI-extracted title
    const titleVal = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: 'title',
        },
      },
    })
    expect(titleVal).toBeDefined()
    expect(titleVal?.stringValue).toBe('E2E Title Extracted')

    // Verify AssetMetadataValue contains the AI-extracted confidence
    const confidenceVal = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: 'confidence',
        },
      },
    })
    expect(confidenceVal).toBeDefined()
    expect(confidenceVal?.numberValue).toBe(0.95)

    // Verify AssetMetadataValue contains the AI-extracted completed flag
    const completedVal = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: 'completed',
        },
      },
    })
    expect(completedVal).toBeDefined()
    expect(completedVal?.booleanValue).toBe(true)

    // Verify manual_notes is NOT auto-filled (remains null/undefined in DB)
    const manualNotesVal = await prisma.assetMetadataValue.findUnique({
      where: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        assetId_fieldKey: {
          assetId: asset.id,
          fieldKey: 'manual_notes',
        },
      },
    })
    expect(manualNotesVal).toBeNull()
  }, 50000)

  it('should post an error comment when agent autofill workflow fails', async () => {
    // 1. Seed Database
    const team = await prisma.team.create({
      data: { name: 'E2E Autofill Fail Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Autofill Fail Project', teamId: team.id },
    })

    await prisma.metadataField.create({
      data: {
        key: 'title_fail_field',
        scope: 'PROJECT',
        projectId: project.id,
        teamId: team.id,
        config: { name: 'Title', type: 'text', autofillSource: 'CONTENT' },
        description: 'AI-extracted document title',
      },
    })

    const user = await prisma.user.create({
      data: {
        name: 'Autofill Fail Agent User',
        email: 'failautofill@shumai.ai',
        type: 'agent',
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'editor',
      },
    })

    const provider = await prisma.provider.create({
      data: {
        name: 'google-fail',
        teamId: team.id,
        config: { api: 'google-generative-ai', apiKey: 'dummy-google-api-key' },
      },
    })

    const model = await prisma.model.create({
      data: {
        modelId: 'gemini-fail',
        name: 'Gemini Fail',
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
        id: user.id,
        type: 'autofill',
        enabled: true,
        teamId: team.id,
        providerId: provider.id,
        modelId: model.id,
        config: { provider: 'google', model: 'gemini-fail' },
      },
    })

    const asset = await prisma.asset.create({
      data: {
        name: 'fail-sample.mp4',
        type: 'file',
        projectId: project.id,
        mediaType: 'video/mp4',
        status: 'uploaded',
        media: {
          proxyType: 'video',
          duration: 12.0,
          videoTranscodes: [{ key: 'files/fail-sample.mp4', width: 1280, height: 720 }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial MediaInfo mock for testing
        } as any,
      },
    })

    // Mock prompt to fail
    vi.spyOn(AgentHarness.prototype, 'prompt').mockRejectedValueOnce(
      new Error('LLM rate limit reached'),
    )

    const task = await prisma.workflowTask.create({
      data: {
        type: 'ai_metadata_autofill',
        status: 'pending',
        assetId: asset.id,
        projectId: project.id,
        teamId: team.id,
        payload: {
          projectId: project.id,
          agent: { sessionId: 'mock-session-fail', agentId: agent.id },
        },
      },
    })

    await expect(workflowService.executeWait(task, 45000)).rejects.toThrow()

    // Verify error comment was created on the asset
    const comments = await prisma.assetComment.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(comments.length).toBe(1)
    expect(comments[0].message).toContain('Autofill failed:')
    expect(comments[0].message).toContain('LLM rate limit reached')
  }, 50000)
})
