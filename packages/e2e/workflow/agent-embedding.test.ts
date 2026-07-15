import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, WorkflowTaskStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent, TaskQueueTranscode } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'

const mockEmbedContent = vi.fn().mockResolvedValue({
  embeddings: [
    {
      values: Array(1536).fill(0.2),
    },
  ],
})

vi.mock('@google/genai', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    GoogleGenAI: class {
      models = {
        embedContent: mockEmbedContent,
      }
    },
  }
})

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - agentEmbeddingMedia (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let agentWorkerPromise: Promise<void> | null = null
    let transcodeWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      // Set bucket environment
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-embedding'
      process.env.GEMINI_API_KEY = 'dummy-key'

      // Configure the workflow service executor dynamically
      workflowService.setExecutorType(mode)

      // Initialize registries
      initAgentWorkflows()
      initTranscodeWorkflows()

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
        await s3Service.deletePrefix('shumai-e2e-test-bucket-embedding', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    })

    it('should run agentEmbeddingMedia workflow for an image asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Image Embedding Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Image Embedding Project', teamId: team.id },
      })

      const agentUser = await prisma.user.create({
        data: {
          name: 'E2E Image Embedding Agent User',
          email: 'e2e-img-emb-agent@shumai.ai',
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
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: {
            provider: 'google',
            model: 'gemini',
          },
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test-image.png',
        },
      })

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

      // 2. Seed S3 Storage from Fixture
      const pngPath = path.join(fixturesDir, 'small.png')
      const pngBuffer = fs.readFileSync(pngPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-embedding',
        'projects/e2e/test-image.png',
        pngBuffer,
        pngBuffer.length,
        'image/png',
      )

      // 3. Create Workflow Task (ai_embedding, pending)
      const task = await prisma.workflowTask.create({
        data: {
          type: 'ai_embedding',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            agent: { agentId: agentUser.id },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Image Embedding Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify AssetComment indicates success
      const comments = await prisma.assetComment.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: 'asc' },
      })
      expect(comments.length).toBeGreaterThan(0)
      const finalComment = comments[comments.length - 1]
      expect(finalComment.message).toBe('Embedding completed successfully.')

      // Verify raw embedding is saved in DB
      const dbEmbeddings = (await prisma.$queryRaw`
      SELECT id, asset_id as "assetId", start_time as "startTime", end_time as "endTime"
      FROM asset_embeddings
      WHERE asset_id = ${asset.id}
    `) as { id: string; startTime: number | null; endTime: number | null }[]
      expect(dbEmbeddings.length).toBe(1)
      expect(dbEmbeddings[0].startTime).toBeNull()
      expect(dbEmbeddings[0].endTime).toBeNull()
    }, 50000)

    it('should run agentEmbeddingMedia workflow for a video asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Video Embedding Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Video Embedding Project', teamId: team.id },
      })

      const agentUser = await prisma.user.create({
        data: {
          name: 'E2E Video Embedding Agent User',
          email: 'e2e-vid-emb-agent@shumai.ai',
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
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: {
            provider: 'google',
            model: 'gemini',
          },
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test-video.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test-video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          media: { duration: 1.0 } as unknown as PrismaJson.MediaInfo, // 1-second video
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from Fixture
      const mp4Path = path.join(fixturesDir, 'small.mp4')
      const mp4Buffer = fs.readFileSync(mp4Path)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-embedding',
        'projects/e2e/test-video.mp4',
        mp4Buffer,
        mp4Buffer.length,
        'video/mp4',
      )

      // 3. Create Workflow Task (ai_embedding, pending)
      const task = await prisma.workflowTask.create({
        data: {
          type: 'ai_embedding',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            agent: { agentId: agentUser.id },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Video Embedding Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify raw embedding is saved in DB with start and end times
      const dbEmbeddings = (await prisma.$queryRaw`
      SELECT id, asset_id as "assetId", start_time as "startTime", end_time as "endTime"
      FROM asset_embeddings
      WHERE asset_id = ${asset.id}
      ORDER BY start_time ASC
    `) as { id: string; startTime: number | null; endTime: number | null }[]
      expect(dbEmbeddings.length).toBeGreaterThan(0)
      expect(dbEmbeddings[0].startTime).toBe(0)
      expect(dbEmbeddings[0].endTime).toBe(1)
    }, 50000)

    it('should fail agentEmbeddingMedia workflow for an unsupported audio asset', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Audio Embedding Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Audio Embedding Project', teamId: team.id },
      })

      const agentUser = await prisma.user.create({
        data: {
          name: 'E2E Audio Embedding Agent User',
          email: 'e2e-aud-emb-agent@shumai.ai',
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
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: {
            provider: 'google',
            model: 'gemini',
          },
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test-audio.wav',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test-audio.wav',
          type: 'file',
          status: 'uploaded',
          mediaType: 'audio/wav',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from Fixture
      const wavPath = path.join(fixturesDir, 'small.wav')
      const wavBuffer = fs.readFileSync(wavPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-embedding',
        'projects/e2e/test-audio.wav',
        wavBuffer,
        wavBuffer.length,
        'audio/wav',
      )

      // 3. Create Workflow Task (ai_embedding, pending)
      const task = await prisma.workflowTask.create({
        data: {
          type: 'ai_embedding',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            agent: { agentId: agentUser.id },
          },
        },
      })

      // 4. Wait for workflow to fail and verify error message
      console.log(
        `Submitted E2E Audio Embedding Workflow Task. ID: ${task.id}. Awaiting failure...`,
      )
      await expect(workflowService.executeWait(task, 45000)).rejects.toThrow(
        'unsupported media type for embeddings: audio/wav',
      )

      // Verify task status in DB is failed
      const dbTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })
      expect(dbTask?.status).toBe(WorkflowTaskStatus.failed)
    }, 50000)
  },
)
