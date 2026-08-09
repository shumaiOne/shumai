import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, AssetStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'
import { GenericContainer, StartedTestContainer } from 'testcontainers'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - Real Gotenberg Transcode (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let transcodeWorkerPromise: Promise<void> | null = null
    let gotenbergContainer: StartedTestContainer | null = null

    beforeAll(async () => {
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-gotenberg'

      console.log('Starting Gotenberg container via testcontainers...')
      try {
        gotenbergContainer = await new GenericContainer('gotenberg/gotenberg:8')
          .withExposedPorts(3000)
          .start()
        const host = gotenbergContainer.getHost()
        const port = gotenbergContainer.getMappedPort(3000)
        process.env.GOTENBERG_URL = `http://${host}:${port}`
        console.log(`Gotenberg container ready at ${process.env.GOTENBERG_URL}`)
      } catch (err) {
        console.error('Failed to start Gotenberg container:', err)
        throw err
      }

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
    }, 120000)

    afterAll(async () => {
      if (mode === 'temporal') {
        console.log('Shutting down Temporal workers...')
        await workflowService.shutdownWorkers()
        await Promise.all([transcodeWorkerPromise].filter(Boolean))
      }
      workflowService.close()
      vi.restoreAllMocks()

      if (gotenbergContainer) {
        console.log('Stopping Gotenberg container...')
        await gotenbergContainer.stop()
      }

      try {
        console.log('Cleaning up E2E storage files...')
        await s3Service.deletePrefix('shumai-e2e-test-bucket-gotenberg', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    }, 120000)

    it('should process real office Word document (.docx) transcode PDF task using Gotenberg', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Gotenberg DOCX Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Gotenberg DOCX Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test.docx',
          status: 'active',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test.docx',
          type: 'file',
          status: 'uploaded',
          mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const docxPath = path.join(fixturesDir, 'test.docx')
      const docxBuffer = fs.readFileSync(docxPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-gotenberg',
        'projects/e2e/test.docx',
        docxBuffer,
        docxBuffer.length,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )

      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_pdf',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {
              poster: true,
              sprite: true,
            },
          },
        },
      })

      console.log(
        `Submitted E2E Gotenberg DOCX Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 60000)

      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType?: string
        pdfTranscode?: { key: string }
        poster?: { key: string }
        sprite?: { key: string }
        frames?: number
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('pdf')
      expect(mediaInfo.pdfTranscode?.key).toBe(`files/${asset.id}/proxy.pdf`)
      expect(mediaInfo.poster?.key).toContain('poster.webp')
      expect(mediaInfo.sprite?.key).toContain('sprite.webp')
      expect(mediaInfo.frames).toBeGreaterThan(0)
    }, 90000)

    it('should process real office PowerPoint presentation (.pptx) transcode PDF task using Gotenberg', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Gotenberg PPTX Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Gotenberg PPTX Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test.pptx',
          status: 'active',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test.pptx',
          type: 'file',
          status: 'uploaded',
          mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const pptxPath = path.join(fixturesDir, 'test.pptx')
      const pptxBuffer = fs.readFileSync(pptxPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-gotenberg',
        'projects/e2e/test.pptx',
        pptxBuffer,
        pptxBuffer.length,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      )

      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_pdf',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {
              poster: true,
              sprite: true,
            },
          },
        },
      })

      console.log(
        `Submitted E2E Gotenberg PPTX Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 60000)

      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType?: string
        pdfTranscode?: { key: string }
        poster?: { key: string }
        sprite?: { key: string }
        frames?: number
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('pdf')
      expect(mediaInfo.pdfTranscode?.key).toBe(`files/${asset.id}/proxy.pdf`)
      expect(mediaInfo.poster?.key).toContain('poster.webp')
      expect(mediaInfo.sprite?.key).toContain('sprite.webp')
      expect(mediaInfo.frames).toBeGreaterThan(0)
    }, 90000)

    it('should process real office Excel spreadsheet (.xlsx) transcode PDF task using Gotenberg', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Gotenberg XLSX Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Gotenberg XLSX Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test.xlsx',
          status: 'active',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test.xlsx',
          type: 'file',
          status: 'uploaded',
          mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const xlsxPath = path.join(fixturesDir, 'test.xlsx')
      const xlsxBuffer = fs.readFileSync(xlsxPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-gotenberg',
        'projects/e2e/test.xlsx',
        xlsxBuffer,
        xlsxBuffer.length,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )

      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_pdf',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {
              poster: true,
              sprite: true,
            },
          },
        },
      })

      console.log(
        `Submitted E2E Gotenberg XLSX Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 60000)

      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType?: string
        pdfTranscode?: { key: string }
        poster?: { key: string }
        sprite?: { key: string }
        frames?: number
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('pdf')
      expect(mediaInfo.pdfTranscode?.key).toBe(`files/${asset.id}/proxy.pdf`)
      expect(mediaInfo.poster?.key).toContain('poster.webp')
      expect(mediaInfo.sprite?.key).toContain('sprite.webp')
      expect(mediaInfo.frames).toBeGreaterThan(0)
    }, 90000)
  },
)
