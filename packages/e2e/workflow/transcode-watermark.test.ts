import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, WatermarkFileStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { watermarkService } from '@shumai/core/src/watermark/watermark'
import { shareService } from '@shumai/core/src/share/share'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'
import type { WatermarkConfigSpec } from '@shumai/dtos'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - transcodeWatermarkWorkflow (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let transcodeWorkerPromise: Promise<void> | null = null

    beforeAll(async () => {
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-watermark'

      workflowService.setExecutorType(mode)
      initTranscodeWorkflows()

      if (mode === 'temporal') {
        console.log('Starting background worker for watermark Temporal E2E tests...')
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
        await s3Service.deletePrefix('shumai-e2e-test-bucket-watermark', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    })

    it('should generate watermark proxy for an image asset and update sharelink status to ready', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Watermark Team' },
      })
      const projectFolder = await prisma.asset.create({
        data: { name: 'root', type: 'root', status: 'processed' },
      })
      const project = await prisma.project.create({
        data: { name: 'E2E Watermark Project', teamId: team.id, rootFolderId: projectFolder.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/e2e-watermark-asset/original.png' },
      })

      const sampleImagePath = path.join(fixturesDir, 'sample.png')
      let sampleBuffer: Buffer
      if (fs.existsSync(sampleImagePath)) {
        sampleBuffer = fs.readFileSync(sampleImagePath)
      } else {
        // Minimal 1x1 PNG fallback if fixture is missing
        sampleBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        )
      }

      await s3Service.putObject(
        'shumai-e2e-test-bucket-watermark',
        storageKey.key,
        sampleBuffer,
        sampleBuffer.length,
        'image/png',
      )

      const asset = await prisma.asset.create({
        data: {
          name: 'sample.png',
          type: 'file',
          mediaType: 'image/png',
          status: 'processed',
          projectId: project.id,
          storageKeyId: storageKey.id,
          media: {
            duration: 0,
            filesize: sampleBuffer.length,
            frames: 0,
            proxyType: 'image',
            imageTranscodes: [
              { key: storageKey.key, width: 100, height: 100, quality: 90, format: 'webp' },
            ],
            videoTranscodes: [],
            videoPreview: { width: 100, height: 100 },
            finishedAt: new Date().toISOString(),
            metadata: {
              originalWidth: 100,
              originalHeight: 100,
              duration: 0,
              bitRate: 0,
              frameRate: 0,
              totalFrames: 0,
              startTimecode: '00:00:00:00',
              hasAudio: false,
              format: {},
            },
            original: {
              key: storageKey.key,
              downloadUrl: '',
              filesizeInBytes: sampleBuffer.length,
              codec: '',
            },
          },
        },
      })

      const shareLink = await shareService.createShareLink(project.id, {
        name: 'Public Watermarked Share',
      })
      await shareService.addAssetToShare(shareLink.id, { assetIds: [asset.id] })

      const watermarkConfig: WatermarkConfigSpec = {
        blocks: [
          {
            id: 'b1',
            type: 'text',
            x: 0.5,
            y: 0.5,
            opacity: 0.5,
            rotation: 0,
            text: 'CONFIDENTIAL E2E',
            size: 0.2,
            color: '#FF0000',
          },
        ],
      }

      // 2. Enable Watermark on Sharelink
      const updatedShare = await watermarkService.updateShareLinkWatermark(
        shareLink.id,
        true,
        watermarkConfig,
      )
      expect(updatedShare.watermarkStatus).toBe('processing')

      // 3. Poll for WorkflowTask completion & ShareLink status 'ready'
      let finalShare = await shareService.getShareLink(shareLink.id)
      const startTime = Date.now()
      while (finalShare.watermarkStatus === 'processing' && Date.now() - startTime < 15000) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        finalShare = await shareService.getShareLink(shareLink.id)
      }

      expect(finalShare.watermarkStatus).toBe('ready')

      // Verify WatermarkFile record was created and completed
      const watermarkFile = await prisma.watermarkFile.findUnique({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          assetId_watermarkConfigId: {
            assetId: asset.id,
            watermarkConfigId: updatedShare.watermarkConfigId!,
          },
        },
      })

      expect(watermarkFile).toBeDefined()
      expect(watermarkFile?.status).toBe(WatermarkFileStatus.completed)
      expect(watermarkFile?.media).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((watermarkFile?.media as any)?.imageTranscodes?.length).toBeGreaterThan(0)
    })

    it('should generate watermark proxy for a video asset and update sharelink status to ready', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Watermark Video Team' },
      })
      const projectFolder = await prisma.asset.create({
        data: { name: 'root', type: 'root', status: 'processed' },
      })
      const project = await prisma.project.create({
        data: {
          name: 'E2E Watermark Video Project',
          teamId: team.id,
          rootFolderId: projectFolder.id,
        },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'files/e2e-watermark-video/original.mp4' },
      })

      const videoPath = path.join(fixturesDir, 'small.mp4')
      const videoBuffer = fs.readFileSync(videoPath)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-watermark',
        storageKey.key,
        videoBuffer,
        videoBuffer.length,
        'video/mp4',
      )

      const asset = await prisma.asset.create({
        data: {
          name: 'small.mp4',
          type: 'file',
          mediaType: 'video/mp4',
          status: 'processed',
          projectId: project.id,
          storageKeyId: storageKey.id,
          media: {
            duration: 1,
            filesize: videoBuffer.length,
            frames: 30,
            proxyType: 'video',
            imageTranscodes: [],
            videoTranscodes: [{ key: storageKey.key, width: 640, height: 360, resolution: '360p' }],
            videoPreview: { width: 640, height: 360 },
            finishedAt: new Date().toISOString(),
            metadata: {
              originalWidth: 640,
              originalHeight: 360,
              duration: 1,
              bitRate: 0,
              frameRate: 30,
              totalFrames: 30,
              startTimecode: '00:00:00:00',
              hasAudio: false,
              format: {},
            },
            original: {
              key: storageKey.key,
              downloadUrl: '',
              filesizeInBytes: videoBuffer.length,
              codec: '',
            },
          },
        },
      })

      const shareLink = await shareService.createShareLink(project.id, {
        name: 'Public Watermarked Video Share',
      })
      await shareService.addAssetToShare(shareLink.id, { assetIds: [asset.id] })

      const watermarkConfig: WatermarkConfigSpec = {
        blocks: [
          {
            id: 'b1',
            type: 'text',
            x: 0.5,
            y: 0.5,
            opacity: 0.5,
            rotation: 0,
            text: 'CONFIDENTIAL VIDEO',
            size: 0.2,
            color: '#FF0000',
          },
        ],
      }

      // 2. Enable Watermark on Sharelink
      const updatedShare = await watermarkService.updateShareLinkWatermark(
        shareLink.id,
        true,
        watermarkConfig,
      )
      expect(updatedShare.watermarkStatus).toBe('processing')

      // 3. Poll for WorkflowTask completion & ShareLink status 'ready'
      let finalShare = await shareService.getShareLink(shareLink.id)
      const startTime = Date.now()
      while (finalShare.watermarkStatus === 'processing' && Date.now() - startTime < 30000) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        finalShare = await shareService.getShareLink(shareLink.id)
      }

      expect(finalShare.watermarkStatus).toBe('ready')

      const watermarkFile = await prisma.watermarkFile.findUnique({
        where: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          assetId_watermarkConfigId: {
            assetId: asset.id,
            watermarkConfigId: updatedShare.watermarkConfigId!,
          },
        },
      })

      expect(watermarkFile).toBeDefined()
      expect(watermarkFile?.status).toBe(WatermarkFileStatus.completed)
      expect(watermarkFile?.media).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((watermarkFile?.media as any)?.videoTranscodes?.length).toBeGreaterThan(0)
    })
  },
)
