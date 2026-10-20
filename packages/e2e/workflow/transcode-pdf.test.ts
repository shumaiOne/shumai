import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, AssetStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe('Workflow E2E - transcodePdfWorkflow', () => {
  setupTestDbHooks()

  beforeAll(async () => {
    process.env.S3_BUCKET = 'shumai-e2e-test-bucket-transcode'

    initTranscodeWorkflows()
    await workflowService.startWorkers(TaskQueueTranscode)
  })

  afterAll(async () => {
    await workflowService.shutdownWorkers()
    workflowService.close()
    vi.restoreAllMocks()
    try {
      console.log('Cleaning up local E2E storage files...')
      await s3Service.deletePrefix('shumai-e2e-test-bucket-transcode', '')
    } catch (err) {
      console.error('Failed to clean up E2E storage folder:', err)
    }
  })

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
    console.log(`Submitted E2E PDF Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`)
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
    expect(mediaInfo.pdfTranscode?.key).toBe('projects/e2e/proxy.pdf')
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
    console.log(`Submitted E2E MD Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`)
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
    expect(mediaInfo.pdfTranscode?.key).toBe('projects/e2e/proxy.pdf')
    expect(mediaInfo.poster?.key).toContain('poster.webp')
    expect(mediaInfo.sprite?.key).toContain('sprite.webp')
    expect(mediaInfo.frames).toBeGreaterThan(0)
  }, 50000)

  it('should recover and complete workflow when intermediate local proxy is deleted before downstream steps', async () => {
    // 1. Create Team, Project, Asset & StorageKey
    const team = await prisma.team.create({
      data: { name: 'E2E Recovery Transcode Team' },
    })

    const project = await prisma.project.create({
      data: { name: 'E2E Recovery Transcode Project', teamId: team.id },
    })

    const storageKey = await prisma.storageKey.create({
      data: {
        key: 'projects/e2e/recovery-doc.md',
        status: 'active',
      },
    })

    const asset = await prisma.asset.create({
      data: {
        name: 'recovery-doc.md',
        type: 'file',
        status: 'uploaded',
        mediaType: 'text/markdown',
        projectId: project.id,
        storageKeyId: storageKey.id,
      },
    })

    // 2. Seed S3 Storage with Markdown text
    const mdText = '# Recovery Test\n\nVerifying that intermediate proxy.pdf recovers from S3.'
    const mdBuffer = Buffer.from(mdText, 'utf-8')
    await s3Service.putObject(
      'shumai-e2e-test-bucket-transcode',
      'projects/e2e/recovery-doc.md',
      mdBuffer,
      mdBuffer.length,
      'text/markdown',
    )

    // 3. Spy on createTempDir and s3Service to intercept proxy.pdf upload and delete it locally
    let capturedTmpDir: string | undefined
    const origCreateTempDir = transcodeService.createTempDir.bind(transcodeService)
    const createTempDirSpy = vi
      .spyOn(transcodeService, 'createTempDir')
      .mockImplementation((prefix: string) => {
        const dir = origCreateTempDir(prefix)
        if (prefix.startsWith('transcode-')) {
          capturedTmpDir = dir
        }
        return dir
      })

    const origPutObject = s3Service.putObject.bind(s3Service)
    const origDownloadToFile = s3Service.downloadToFile.bind(s3Service)
    const downloadedKeys: string[] = []

    const downloadSpy = vi
      .spyOn(s3Service, 'downloadToFile')
      .mockImplementation(async (bucket, key, localPath) => {
        downloadedKeys.push(key)
        return origDownloadToFile(bucket, key, localPath)
      })

    const putSpy = vi.spyOn(s3Service, 'putObject').mockImplementation(async (...args) => {
      const result = await origPutObject(...args)
      const key = String(args[1] || '')
      if (key.endsWith('proxy.pdf') && capturedTmpDir) {
        // Once proxy.pdf has been uploaded to S3 by generatePdfProxyActivity,
        // delete the local file to simulate empty filesystem on a recovery/worker node.
        const localProxyPath = path.join(capturedTmpDir, 'proxy.pdf')
        if (fs.existsSync(localProxyPath)) {
          fs.unlinkSync(localProxyPath)
        }
      }
      return result
    })

    // 4. Create Workflow Task
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

    try {
      console.log(
        `Submitted E2E Recovery Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
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
      expect(mediaInfo.pdfTranscode?.key).toBe('projects/e2e/proxy.pdf')
      expect(mediaInfo.poster?.key).toContain('poster.webp')
      expect(mediaInfo.sprite?.key).toContain('sprite.webp')
      expect(mediaInfo.frames).toBeGreaterThan(0)

      // Verify that proxy.pdf was re-downloaded from S3 via ensureLocalMediaFile
      const proxyDownloadCall = downloadedKeys.find((k) => k.endsWith('proxy.pdf'))
      expect(proxyDownloadCall).toBeDefined()
    } finally {
      createTempDirSpy.mockRestore()
      downloadSpy.mockRestore()
      putSpy.mockRestore()
    }
  }, 50000)
})
