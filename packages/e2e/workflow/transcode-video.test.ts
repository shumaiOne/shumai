import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma, AssetStatus, AssetType } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { assetService } from '@shumai/core/src/asset/asset'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - transcodeVideoWorkflow (executor: %s)',
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

    it('should run transcodeMedia workflow with HLS enabled and serve playlists for version stacks and symlinks', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: {
          name: 'E2E HLS Video Transcode Team',
          settings: {
            transcode: {
              videoStrategy: 'best_match',
              hlsEnabled: true,
              hlsResolutions: ['480p'],
            },
          },
        },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E HLS Video Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/video-hls.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'video-hls.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Seed S3 Storage from Fixture (small-480p.mp4)
      const mp4Path = path.join(fixturesDir, 'small-480p.mp4')
      const mp4Buffer = fs.readFileSync(mp4Path)
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/video-hls.mp4',
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
              hlsEnabled: true,
              hlsResolutions: ['480p'],
            },
          },
        },
      })

      // 4. Wait for workflow to complete
      console.log(
        `Submitted E2E HLS Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      // 5. Verification of HLS generation
      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as PrismaJson.MediaInfo
      expect(mediaInfo.isHls).toBe(true)
      expect(mediaInfo.hls).toBeDefined()
      expect(mediaInfo.hls?.key).toBe('projects/e2e/hls/master.m3u8')
      expect(mediaInfo.hls?.resolutions).toBeDefined()
      expect(mediaInfo.hls?.resolutions?.length).toBeGreaterThan(0)
      expect(mediaInfo.hls?.resolutions?.[0]?.resolution).toBe('480p')

      // Verify master playlist in S3
      const masterObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/hls/master.m3u8',
      )
      const masterPlaylist = masterObj.buffer.toString('utf-8')
      expect(masterPlaylist).toContain('#EXTM3U')
      expect(masterPlaylist).toContain('480p/index.m3u8')

      // Verify variant playlist in S3
      const variantObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/hls/480p/index.m3u8',
      )
      expect(variantObj.buffer.toString('utf-8')).toContain('#EXTM3U')

      // 6. Test Version Stack & Symlink Resolution
      const stack = await prisma.asset.create({
        data: {
          name: 'video-hls-stack',
          type: AssetType.version_stack,
          status: AssetStatus.processed,
          projectId: project.id,
        },
      })

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          parentId: stack.id,
          sortIndex: 'a',
        },
      })

      const symlink = await prisma.asset.create({
        data: {
          name: 'video-hls-symlink',
          type: AssetType.symlink,
          status: AssetStatus.processed,
          projectId: project.id,
          targetId: stack.id,
        },
      })

      // Calling getHlsMasterPlaylist with stack ID
      const stackMaster = await assetService.getHlsMasterPlaylist({ assetId: stack.id })
      expect(stackMaster).toContain('#EXTM3U')
      expect(stackMaster).toContain('480p/index.m3u8')

      // Calling getHlsMasterPlaylist with symlink ID
      const symlinkMaster = await assetService.getHlsMasterPlaylist({ assetId: symlink.id })
      expect(symlinkMaster).toContain('#EXTM3U')
      expect(symlinkMaster).toContain('480p/index.m3u8')

      // Calling getHlsVariantPlaylist with symlink ID
      const symlinkVariant = await assetService.getHlsVariantPlaylist({
        assetId: symlink.id,
        resolution: '480p',
      })
      expect(symlinkVariant).toContain('#EXTM3U')
    }, 60000)

    it('should transcode video with attached picture cover art successfully selecting main video stream', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Cover Art Video Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Cover Art Video Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/cover-video.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'cover-video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      // 2. Generate and Seed S3 Storage with an MP4 containing an attached picture
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-cover-'))
      const coverMp4 = path.join(tmpDir, 'cover-video.mp4')
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-loop',
          '1',
          '-i',
          path.join(fixturesDir, 'small.png'),
          '-i',
          path.join(fixturesDir, 'small.mp4'),
          '-map',
          '0',
          '-map',
          '1:v',
          '-c:v:0',
          'mjpeg',
          '-disposition:v:0',
          'attached_pic',
          '-c:v:1',
          'copy',
          '-t',
          '1',
          coverMp4,
        ])
        const mp4Buffer = fs.readFileSync(coverMp4)
        await s3Service.putObject(
          'shumai-e2e-test-bucket-transcode',
          'projects/e2e/cover-video.mp4',
          mp4Buffer,
          mp4Buffer.length,
          'video/mp4',
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }

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
      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      // 5. Verification
      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        duration: number
        videoTranscodes: { key: string; width: number; height: number }[]
        metadata: { originalWidth: number; originalHeight: number; videoStreamIndex: number }
        poster: unknown
        sprite: unknown
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('video')
      // originalWidth must be 64 (the real video stream), NOT 1 (the attached picture)!
      expect(mediaInfo.metadata.originalWidth).toBe(64)
      expect(mediaInfo.metadata.originalHeight).toBe(64)
      expect(mediaInfo.videoTranscodes.length).toBeGreaterThan(0)
    }, 60000)
  },
)
