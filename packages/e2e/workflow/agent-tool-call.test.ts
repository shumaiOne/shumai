import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueAgent } from '@shumai/workflow-core'
import { initAgentWorkflows } from '@shumai/agent'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const agentWorkflowsPath = path.resolve(currentDir, '../../../apps/agent/src/workflows.ts')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - agentToolCall (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let agentWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-toolcall'
      process.env.GEMINI_API_KEY = 'dummy-key'

      workflowService.setExecutorType(mode)
      initAgentWorkflows()

      if (mode === 'temporal') {
        console.log('Starting background worker for tool call Temporal E2E tests...')
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
        await s3Service.deletePrefix('shumai-e2e-test-bucket-toolcall', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    })

    it('should run agentToolCall workflow and execute list_assets successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Tool Call Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Tool Call Project', teamId: team.id },
      })

      const regularUser = await prisma.user.create({
        data: {
          name: 'Regular Editor User',
          email: 'editor@example.com',
          type: 'human',
        },
      })

      // Setup team member with owner/editor role and team scope
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: regularUser.id,
          role: 'editor',
          scope: 'team',
        },
      })

      // Create a folder asset (parent)
      const parentFolder = await prisma.asset.create({
        data: {
          name: 'TestParentFolder',
          type: 'folder',
          status: 'processed',
          projectId: project.id,
        },
      })

      // Create a child file asset inside the parent folder
      const childFile = await prisma.asset.create({
        data: {
          name: 'TestChildFile.png',
          type: 'file',
          status: 'uploaded',
          mediaType: 'image/png',
          projectId: project.id,
          parentId: parentFolder.id,
        },
      })

      // 2. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'agent_tool_call',
          status: 'pending',
          assetId: parentFolder.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            agentToolCall: {
              toolName: 'list_assets',
              args: {
                parent: parentFolder.id,
                page: 1,
                pageSize: 20,
                type: 'all',
              },
              userId: regularUser.id,
            },
          },
        },
      })

      // 3. Wait for workflow to complete
      console.log(`Submitted E2E Tool Call Workflow Task. ID: ${task.id}. Awaiting completion...`)
      const completedTask = await workflowService.executeWait(task, 45000)

      // 4. Verification
      expect(completedTask.status).toBe('completed')

      // Verify task output contains the list of files, and childFile.id is present in assets
      const output = completedTask.output as unknown as { assets: { id: string }[] }
      expect(output).toBeDefined()
      expect(output.assets).toBeDefined()
      expect(output.assets.length).toBeGreaterThan(0)

      const assetIds = output.assets.map((a) => a.id)
      expect(assetIds).toContain(childFile.id)
    }, 50000)
  },
)
