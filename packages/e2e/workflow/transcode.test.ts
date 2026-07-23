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
  'Workflow E2E - transcodeMedia (executor: %s)',
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

    it('should run transcodeMedia workflow for a video asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Video Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Video Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/video-trans.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'video-trans.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from Fixture
      const mp4Path = path.join(fixturesDir, 'small.mp4')
      const mp4Buffer = fs.readFileSync(mp4Path)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/video-trans.mp4',
        mp4Buffer,
        mp4Buffer.length,
        'video/mp4',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_video',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {
              videoStrategy: 'best_match',
              thumbnail: false,
              poster: true,
              sprite: true,
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Video Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify Asset status is updated to processed
      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      // Verify media info contains videoTranscodes, poster, sprite, and duration details
      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        duration: number
        videoTranscodes: { key: string }[]
        poster: unknown
        sprite: unknown
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('video')
      expect(mediaInfo.duration).toBeCloseTo(1.0, 1)
      expect(mediaInfo.videoTranscodes).toBeDefined()
      expect(mediaInfo.videoTranscodes.length).toBeGreaterThan(0)
      expect(mediaInfo.poster).toBeDefined()
      expect(mediaInfo.sprite).toBeDefined()
    }, 50000)

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

    it('should run transcodeMedia workflow for an audio asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Audio Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Audio Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/audio-trans.wav',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'audio-trans.wav',
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
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/audio-trans.wav',
        wavBuffer,
        wavBuffer.length,
        'audio/wav',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_video',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            transcode: {},
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Audio Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
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
        videoTranscodes: { key: string }[]
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('audio')
      expect(mediaInfo.videoTranscodes).toBeDefined()
      expect(mediaInfo.videoTranscodes.length).toBeGreaterThan(0)
      // Audio proxy key should end with -audio-proxy.mp4
      expect(mediaInfo.videoTranscodes[0].key).toContain('-audio-proxy.mp4')
    }, 50000)

    it('should run transcodeMedia screenshot extraction successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Video Screenshot Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Video Screenshot Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/video-shot.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'video-shot.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from Fixture
      const mp4Path = path.join(fixturesDir, 'small.mp4')
      const mp4Buffer = fs.readFileSync(mp4Path)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/video-shot.mp4',
        mp4Buffer,
        mp4Buffer.length,
        'video/mp4',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_screenshot',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            screenshot: {
              start: 0,
              end: 1,
              count: 1,
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Video Screenshot Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify task output contains list of screenshots
      const output = completedTask.output as unknown as { screenshots: { key: string }[] }
      expect(output).toBeDefined()
      expect(output.screenshots).toBeDefined()
      expect(output.screenshots.length).toBe(1)
      expect(output.screenshots[0].key).toContain('screenshots/')
    }, 50000)

    it('should run transcodeMedia image annotation overlay successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Image Annotation Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Image Annotation Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/image-ann.png',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'image-ann.png',
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
        'projects/e2e/image-ann.png',
        pngBuffer,
        pngBuffer.length,
        'image/png',
      )

      // 3. Create Workflow Task
      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_image_annotation',
          status: 'pending',
          assetId: asset.id,
          projectId: project.id,
          teamId: team.id,
          payload: {
            projectId: project.id,
            imageAnnotation: {
              annotations: [
                {
                  type: 'box',
                  color: '#ff0000',
                  points: [
                    [0.1, 0.1],
                    [0.9, 0.9],
                  ],
                },
              ],
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E Image Annotation Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify task output contains overlay image key
      const output = completedTask.output as unknown as { key: string }
      expect(output).toBeDefined()
      expect(output.key).toContain('annotations/')
    }, 50000)

    it('should run transcodeMedia workflow for a PDF asset successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E PDF Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E PDF Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/test.pdf',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'test.pdf',
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
        'projects/e2e/test.pdf',
        pdfBuffer,
        pdfBuffer.length,
        'application/pdf',
      )

      // 3. Create Workflow Task
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

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E PDF Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
      expect(completedTask.status).toBe('completed')

      // Verify Asset status is updated to processed
      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      // Verify media info contains pdf details, poster, sprite, and pageCount
      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        poster: { key: string }
        sprite: { key: string }
        frames?: number
        pageCount?: number
        metadata?: { totalFrames?: number; pageCount?: number }
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('pdf')
      expect(mediaInfo.poster).toBeDefined()
      expect(mediaInfo.poster.key).toContain('poster.webp')
      expect(mediaInfo.sprite).toBeDefined()
      expect(mediaInfo.sprite.key).toContain('sprite.webp')
      expect(mediaInfo.frames ?? mediaInfo.metadata?.totalFrames).toBeGreaterThan(0)
    }, 50000)

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

    it('should run transcodeMedia workflow for a TXT asset with CJK text to generate PDF proxy successfully', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E CJK TXT Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E CJK TXT Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/cjk-test.txt',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'cjk-test.txt',
          type: 'file',
          status: 'uploaded',
          mediaType: 'text/plain',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage with CJK text
      const cjkText =
        'Hello World\n你好世界 (Chinese)\nこんにちは世界 (Japanese)\n안녕하세요世界 (Korean)\nLine 5 of random text.'
      const txtBuffer = Buffer.from(cjkText, 'utf-8')
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/cjk-test.txt',
        txtBuffer,
        txtBuffer.length,
        'text/plain',
      )

      // 3. Create Workflow Task
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

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E CJK TXT Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
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
    }, 50000)

    it('should process markdown (.md) transcode PDF task correctly', async () => {
      // 1. Create Team, Project, Asset & StorageKey
      const team = await prisma.team.create({
        data: { name: 'E2E MD Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E MD Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/doc.md',
          status: 'active',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'doc.md',
          type: 'file',
          status: 'uploaded',
          mediaType: 'text/markdown',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage with Markdown text
      const mdText = '# Heading\n\nThis is a **markdown** document to be rendered to PDF proxy.'
      const mdBuffer = Buffer.from(mdText, 'utf-8')
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/doc.md',
        mdBuffer,
        mdBuffer.length,
        'text/markdown',
      )

      // 3. Create Workflow Task
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

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E MD Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)

      // 5. Verification
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
    }, 50000)
  },
)
