import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { AgentHarness, type AgentTool } from '@earendil-works/pi-agent-core'
import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - agentAutofillMedia (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let agentWorkerPromise: Promise<void> | null = null
    let transcodeWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      // Set bucket environment
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket'

      // Configure the workflow service executor dynamically
      workflowService.setExecutorType(mode)

      // Initialize registries
      initAgentWorkflows()
      initTranscodeWorkflows()

      // Spy on the harness prompt method to intercept the LLM call while running real activities & tools
      vi.spyOn(AgentHarness.prototype, 'prompt').mockImplementation(async function (
        this: AgentHarness,
      ) {
        // Find the real autofill_metadata tool configured on the harness
        const tools = this.getTools()
        const autofillTool = tools.find((t: AgentTool) => t.name === 'autofill_metadata')

        if (autofillTool) {
          // Execute the real tool callback to perform the actual DB updates
          await autofillTool.execute('call-123', {
            title: 'E2E Title Extracted',
            confidence: 0.95,
            completed: true,
          })
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

      if (mode === 'temporal') {
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
      if (mode === 'temporal') {
        console.log('Shutting down Temporal workers...')
        await workflowService.shutdownWorkers()
        await Promise.all([agentWorkerPromise, transcodeWorkerPromise].filter(Boolean))
      }

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

      // Create Metadata Field (aiAutofill = true, text)
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

      // Create Metadata Field (aiAutofill = true, number)
      await prisma.metadataField.create({
        data: {
          key: 'confidence',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Confidence', type: 'number' },
          aiAutofill: true,
          description: 'AI extraction confidence',
        },
      })

      // Create Metadata Field (aiAutofill = true, boolean)
      await prisma.metadataField.create({
        data: {
          key: 'completed',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Completed', type: 'toggle' },
          aiAutofill: true,
          description: 'Completed flag',
        },
      })

      // Create Metadata Field (aiAutofill = false, text)
      await prisma.metadataField.create({
        data: {
          key: 'manual_notes',
          scope: 'PROJECT',
          projectId: project.id,
          teamId: team.id,
          config: { name: 'Manual Notes', type: 'text' },
          aiAutofill: false,
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
  },
)
