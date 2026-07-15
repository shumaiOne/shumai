import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { s3Service } from '@shumai/core/src/s3/s3'
const mockEmbedContent = vi.fn().mockResolvedValue({
  embeddings: [
    {
      values: Array(1536).fill(0.35),
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

import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - queryEmbeddingForSearch (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let agentWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-query'
      process.env.GEMINI_API_KEY = 'dummy-key'

      workflowService.setExecutorType(mode)
      initAgentWorkflows()

      if (mode === 'temporal') {
        console.log('Starting background worker for query embedding Temporal E2E tests...')
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
        await s3Service.deletePrefix('shumai-e2e-test-bucket-query', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    })

    it('should run queryEmbeddingForSearch workflow and return embedding successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Query Embedding Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Query Embedding Project', teamId: team.id },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'dummy-search-asset',
          type: 'file',
          status: 'uploaded',
          mediaType: 'text/plain',
          projectId: project.id,
        },
      })

      // 2. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'query_embedding_for_search',
          status: 'pending',
          teamId: team.id,
          projectId: project.id,
          assetId: asset.id,
          payload: {
            projectId: project.id,
            queryEmbeddingForSearch: {
              text: 'test search query',
            },
          },
        },
      })

      // 3. Wait for workflow to complete
      console.log(
        `Submitted E2E Query Embedding Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 4. Verification
      expect(completedTask.status).toBe('completed')

      // Verify output payload contains correct embedding values and usage metadata
      const output = completedTask.output as unknown as { embedding: number[] }
      expect(output).toBeDefined()
      expect(output.embedding).toEqual(Array(1536).fill(0.35))
      expect(completedTask.model).toBe('gemini-embedding-2')
    }, 50000)
  },
)
