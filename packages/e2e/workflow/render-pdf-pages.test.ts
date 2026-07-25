import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - renderPdfPagesWorkflow (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let transcodeWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-transcode'

      workflowService.setExecutorType(mode)
      initTranscodeWorkflows()

      if (mode === 'temporal') {
        console.log('Starting background worker for transcode Temporal E2E tests...')
        transcodeWorkerPromise = workflowService.startWorkers(TaskQueueTranscode, {
          workflowsPath: transcodeWorkflowsPath,
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
        await Promise.all([transcodeWorkerPromise].filter(Boolean))
      }
      workflowService.close()
      vi.restoreAllMocks()
      try {
        console.log('Cleaning up local E2E storage files...')
        await s3Service.deletePrefix('shumai-e2e-test-bucket-transcode', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    })

    it('should run renderPdfPages workflow for a PDF asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E PDF Pages Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E PDF Pages Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test-pages.pdf',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test-pages.pdf',
          type: 'file',
          status: 'uploaded',
          mediaType: 'application/pdf',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from fixture test.pdf
      const pdfPath = path.join(fixturesDir, 'test.pdf')
      const pdfBuffer = fs.readFileSync(pdfPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/test-pages.pdf',
        pdfBuffer,
        pdfBuffer.length,
        'application/pdf',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_pdf_pages',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            pdfPages: {
              start: 1,
              end: 2,
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(`Submitted E2E PDF Pages Workflow Task. ID: ${task.id}. Awaiting completion...`)
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify output contains rendered pages
      const output = completedTask.output as unknown as { pages: { key: string; page: number }[] }
      expect(output).toBeDefined()
      expect(output.pages).toBeDefined()
      expect(output.pages.length).toBeGreaterThan(0)
    }, 50000)
  },
)
