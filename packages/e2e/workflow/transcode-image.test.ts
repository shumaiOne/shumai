import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, AssetStatus } from '@shumai/db'
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
  'Workflow E2E - transcodeImageWorkflow (executor: %s)',
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

    it('should run transcodeMedia workflow for an image asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Image Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Image Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/image-trans.png',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'image-trans.png',
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
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/image-trans.png',
        pngBuffer,
        pngBuffer.length,
        'image/png',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_image',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {
              thumbnail: true,
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Image Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        imageTranscodes: unknown[]
        thumbnail: unknown
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('image')
      expect(mediaInfo.imageTranscodes).toBeDefined()
      expect(mediaInfo.imageTranscodes.length).toBeGreaterThan(0)
      expect(mediaInfo.thumbnail).toBeDefined()
    }, 50000)

    it('should run transcodeMedia workflow for a PSD image asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E PSD Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E PSD Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test.psd',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test.psd',
          type: 'file',
          status: 'uploaded',
          mediaType: 'image/vnd.adobe.photoshop',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from fixture test.psd
      const psdPath = path.join(fixturesDir, 'test.psd')
      const psdBuffer = fs.readFileSync(psdPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/test.psd',
        psdBuffer,
        psdBuffer.length,
        'image/vnd.adobe.photoshop',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_image',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {
              thumbnail: true,
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E PSD Image Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        imageTranscodes: unknown[]
        thumbnail: unknown
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('image')
      expect(mediaInfo.imageTranscodes).toBeDefined()
      expect(mediaInfo.imageTranscodes.length).toBeGreaterThan(0)
      expect(mediaInfo.thumbnail).toBeDefined()
    }, 50000)
  },
)
