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

async function sampleFirstFrameRgb(
  buffer: Buffer,
  ext: string = 'mp4',
): Promise<{ r: number; g: number; b: number }> {
  const tmpFile = path.join(
    os.tmpdir(),
    `sample-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  )
  try {
    fs.writeFileSync(tmpFile, buffer)
    const proc = await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        tmpFile,
        '-vframes',
        '1',
        '-s',
        '1x1',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        'pipe:1',
      ],
      { encoding: 'buffer' },
    )
    return {
      r: proc.stdout[0],
      g: proc.stdout[1],
      b: proc.stdout[2],
    }
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

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

    it('Case 1: should ignore attached picture cover art (Red) and select primary video stream (Green)', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Cover Art Video Team' },
      })
      const project = await prisma.project.create({
        data: { name: 'E2E Cover Art Video Project', teamId: team.id },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'projects/e2e/case1/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-case1-'))
      const videoPath = path.join(tmpDir, 'case1.mp4')
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=green:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'color=c=red:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'sine=f=1000:d=2',
          '-map',
          '0:v',
          '-map',
          '1:v',
          '-map',
          '2:a',
          '-c:v:0',
          'libx264',
          '-pix_fmt:v:0',
          'yuv420p',
          '-c:v:1',
          'mjpeg',
          '-pix_fmt:v:1',
          'yuvj420p',
          '-c:a',
          'aac',
          '-disposition:v:1',
          'attached_pic',
          videoPath,
        ])
        const mp4Buffer = fs.readFileSync(videoPath)
        await s3Service.putObject(
          'shumai-e2e-test-bucket-transcode',
          'projects/e2e/case1/video.mp4',
          mp4Buffer,
          mp4Buffer.length,
          'video/mp4',
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }

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
              poster: true,
              sprite: true,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        metadata: { videoStreamIndex: number }
        poster: { key: string }
        sprite: { key: string }
        videoTranscodes: { key: string }[]
      }
      expect(mediaInfo.proxyType).toBe('video')
      expect(mediaInfo.metadata.videoStreamIndex).toBe(0)

      // Verify poster is Green (not Red attached pic)
      expect(mediaInfo.poster?.key).toBeDefined()
      const posterObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.poster.key,
      )
      const posterColor = await sampleFirstFrameRgb(posterObj.buffer, 'webp')
      expect(posterColor.g).toBeGreaterThan(100)
      expect(posterColor.r).toBeLessThan(50)
      expect(posterColor.b).toBeLessThan(50)

      // Verify MP4 proxy is Green
      expect(mediaInfo.videoTranscodes.length).toBeGreaterThan(0)
      const videoObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.videoTranscodes[0].key,
      )
      const videoColor = await sampleFirstFrameRgb(videoObj.buffer, 'mp4')
      expect(videoColor.g).toBeGreaterThan(100)
      expect(videoColor.r).toBeLessThan(50)
      expect(videoColor.b).toBeLessThan(50)

      // Verify sprite sheet exists
      expect(mediaInfo.sprite?.key).toBeDefined()
      await s3Service.headObject('shumai-e2e-test-bucket-transcode', mediaInfo.sprite.key)
    }, 60000)

    it('Case 2: should select higher bitrate stream (Blue) when both streams have default flag', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Bitrate Comparison Team' },
      })
      const project = await prisma.project.create({
        data: { name: 'E2E Bitrate Comparison Project', teamId: team.id },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'projects/e2e/case2/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-case2-'))
      const videoPath = path.join(tmpDir, 'case2.mp4')
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=red:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'color=c=blue:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'sine=f=1000:d=2',
          '-map',
          '0:v',
          '-map',
          '1:v',
          '-map',
          '2:a',
          '-c:v:0',
          'libx264',
          '-b:v:0',
          '200k',
          '-minrate:v:0',
          '200k',
          '-maxrate:v:0',
          '200k',
          '-bufsize:v:0',
          '200k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:0',
          'default',
          '-c:v:1',
          'libx264',
          '-b:v:1',
          '2000k',
          '-minrate:v:1',
          '2000k',
          '-maxrate:v:1',
          '2000k',
          '-bufsize:v:1',
          '2000k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:1',
          'default',
          '-c:a',
          'aac',
          videoPath,
        ])
        const mp4Buffer = fs.readFileSync(videoPath)
        await s3Service.putObject(
          'shumai-e2e-test-bucket-transcode',
          'projects/e2e/case2/video.mp4',
          mp4Buffer,
          mp4Buffer.length,
          'video/mp4',
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }

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
              poster: true,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        metadata: { videoStreamIndex: number }
        poster: { key: string }
        videoTranscodes: { key: string }[]
      }
      expect(mediaInfo.proxyType).toBe('video')
      // Stream 1 (Blue, 2000k) should be selected over Stream 0 (Red, 200k)
      expect(mediaInfo.metadata.videoStreamIndex).toBe(1)

      const posterObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.poster.key,
      )
      const posterColor = await sampleFirstFrameRgb(posterObj.buffer, 'webp')
      expect(posterColor.b).toBeGreaterThan(100)
      expect(posterColor.r).toBeLessThan(50)
      expect(posterColor.g).toBeLessThan(50)

      const videoObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.videoTranscodes[0].key,
      )
      const videoColor = await sampleFirstFrameRgb(videoObj.buffer, 'mp4')
      expect(videoColor.b).toBeGreaterThan(100)
      expect(videoColor.r).toBeLessThan(50)
      expect(videoColor.g).toBeLessThan(50)
    }, 60000)

    it('Case 3: should select stream with default flag (Yellow) over higher bitrate stream without default flag (Blue)', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Default Flag Team' },
      })
      const project = await prisma.project.create({
        data: { name: 'E2E Default Flag Project', teamId: team.id },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'projects/e2e/case3/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-case3-'))
      const videoPath = path.join(tmpDir, 'case3.mp4')
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=yellow:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'color=c=blue:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'sine=f=1000:d=2',
          '-map',
          '0:v',
          '-map',
          '1:v',
          '-map',
          '2:a',
          '-c:v:0',
          'libx264',
          '-b:v:0',
          '200k',
          '-minrate:v:0',
          '200k',
          '-maxrate:v:0',
          '200k',
          '-bufsize:v:0',
          '200k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:0',
          'default',
          '-c:v:1',
          'libx264',
          '-b:v:1',
          '2000k',
          '-minrate:v:1',
          '2000k',
          '-maxrate:v:1',
          '2000k',
          '-bufsize:v:1',
          '2000k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:1',
          '0',
          '-c:a',
          'aac',
          videoPath,
        ])
        const mp4Buffer = fs.readFileSync(videoPath)
        await s3Service.putObject(
          'shumai-e2e-test-bucket-transcode',
          'projects/e2e/case3/video.mp4',
          mp4Buffer,
          mp4Buffer.length,
          'video/mp4',
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }

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
              poster: true,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        metadata: { videoStreamIndex: number }
        poster: { key: string }
        videoTranscodes: { key: string }[]
      }
      expect(mediaInfo.proxyType).toBe('video')
      // Stream 0 (Yellow, default: 1) should win over Stream 1 (Blue, 10x higher bitrate but default: 0)
      expect(mediaInfo.metadata.videoStreamIndex).toBe(0)

      const posterObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.poster.key,
      )
      const posterColor = await sampleFirstFrameRgb(posterObj.buffer, 'webp')
      expect(posterColor.r).toBeGreaterThan(100)
      expect(posterColor.g).toBeGreaterThan(100)
      expect(posterColor.b).toBeLessThan(50)

      const videoObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.videoTranscodes[0].key,
      )
      const videoColor = await sampleFirstFrameRgb(videoObj.buffer, 'mp4')
      expect(videoColor.r).toBeGreaterThan(100)
      expect(videoColor.g).toBeGreaterThan(100)
      expect(videoColor.b).toBeLessThan(50)
    }, 60000)

    it('Case 4: should handle audio-only MP4 with cover art by downgrading to audio proxy (catches audio bug)', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Audio Cover Art Team' },
      })
      const project = await prisma.project.create({
        data: { name: 'E2E Audio Cover Art Project', teamId: team.id },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'projects/e2e/case4/audio-cover.mp4' },
      })
      // Uploaded as video/mp4 because of .mp4 container, even though it only has audio + cover art
      const asset = await prisma.asset.create({
        data: {
          name: 'audio-cover.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-case4-'))
      const videoPath = path.join(tmpDir, 'case4.mp4')
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'sine=f=1000:d=2',
          '-f',
          'lavfi',
          '-i',
          'color=c=magenta:s=320x240:d=2',
          '-map',
          '0:a',
          '-map',
          '1:v',
          '-c:a',
          'aac',
          '-c:v',
          'mjpeg',
          '-pix_fmt:v:0',
          'yuvj420p',
          '-disposition:v:0',
          'attached_pic',
          videoPath,
        ])
        const mp4Buffer = fs.readFileSync(videoPath)
        await s3Service.putObject(
          'shumai-e2e-test-bucket-transcode',
          'projects/e2e/case4/audio-cover.mp4',
          mp4Buffer,
          mp4Buffer.length,
          'video/mp4',
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }

      // Spec requested poster, sprite, videoStrategy as video upload would
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
              poster: true,
              sprite: true,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task, 45000)
      // Must complete without error (previously failed trying to generate poster/sprite for audio)
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        poster?: unknown
        sprite?: unknown
        videoTranscodes: { key: string }[]
      }
      expect(mediaInfo.proxyType).toBe('audio')
      expect(mediaInfo.poster).toBeUndefined()
      expect(mediaInfo.sprite).toBeUndefined()
      expect(mediaInfo.videoTranscodes.length).toBeGreaterThan(0)
      expect(mediaInfo.videoTranscodes[0].key).toContain('-audio-proxy.mp4')
      await s3Service.headObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.videoTranscodes[0].key,
      )
    }, 60000)

    it('Case 5: should rank 3 video streams with HLS enabled and select highest bitrate stream (Blue)', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'E2E Multi Stream HLS Team',
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
        data: { name: 'E2E Multi Stream HLS Project', teamId: team.id },
      })
      const storageKey = await prisma.storageKey.create({
        data: { key: 'projects/e2e/case5/video.mp4' },
      })
      const asset = await prisma.asset.create({
        data: {
          name: 'video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-case5-'))
      const videoPath = path.join(tmpDir, 'case5.mp4')
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=red:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'color=c=green:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'color=c=blue:s=320x240:d=2',
          '-f',
          'lavfi',
          '-i',
          'sine=f=1000:d=2',
          '-map',
          '0:v',
          '-map',
          '1:v',
          '-map',
          '2:v',
          '-map',
          '3:a',
          '-c:v:0',
          'libx264',
          '-b:v:0',
          '100k',
          '-minrate:v:0',
          '100k',
          '-maxrate:v:0',
          '100k',
          '-bufsize:v:0',
          '100k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:0',
          'default',
          '-c:v:1',
          'libx264',
          '-b:v:1',
          '500k',
          '-minrate:v:1',
          '500k',
          '-maxrate:v:1',
          '500k',
          '-bufsize:v:1',
          '500k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:1',
          'default',
          '-c:v:2',
          'libx264',
          '-b:v:2',
          '1500k',
          '-minrate:v:2',
          '1500k',
          '-maxrate:v:2',
          '1500k',
          '-bufsize:v:2',
          '1500k',
          '-nal-hrd',
          'cbr',
          '-disposition:v:2',
          'default',
          '-c:a',
          'aac',
          videoPath,
        ])
        const mp4Buffer = fs.readFileSync(videoPath)
        await s3Service.putObject(
          'shumai-e2e-test-bucket-transcode',
          'projects/e2e/case5/video.mp4',
          mp4Buffer,
          mp4Buffer.length,
          'video/mp4',
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }

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
              poster: true,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType: string
        metadata: { videoStreamIndex: number }
        poster: { key: string }
        isHls: boolean
        hls: { key: string; resolutions: { resolution: string }[] }
      }
      expect(mediaInfo.proxyType).toBe('video')
      // Stream 2 (Blue, 1500k) should be selected
      expect(mediaInfo.metadata.videoStreamIndex).toBe(2)

      const posterObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.poster.key,
      )
      const posterColor = await sampleFirstFrameRgb(posterObj.buffer, 'webp')
      expect(posterColor.b).toBeGreaterThan(100)
      expect(posterColor.r).toBeLessThan(50)
      expect(posterColor.g).toBeLessThan(50)

      expect(mediaInfo.isHls).toBe(true)
      const masterObj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        mediaInfo.hls.key,
      )
      expect(masterObj.buffer.toString('utf-8')).toContain('480p/index.m3u8')
    }, 60000)

    it('should transition both task and asset to failed status with media.error when transcoding fails', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E Failed Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Failed Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: { key: 'projects/e2e/corrupt-video.mp4' },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'corrupt-video.mp4',
          type: 'file',
          status: 'uploaded',
          mediaType: 'video/mp4',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const corruptBuffer = Buffer.from('not a valid mp4 media stream at all')
      await s3Service.putObject(
        'shumai-e2e-test-bucket-transcode',
        'projects/e2e/corrupt-video.mp4',
        corruptBuffer,
        corruptBuffer.length,
        'video/mp4',
      )

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
            },
          },
        },
      })

      await expect(workflowService.executeWait(task, 45000)).rejects.toThrow()

      const failedTask = await prisma.workflowTask.findUnique({
        where: { id: task.id },
      })
      expect(failedTask?.status).toBe('failed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.failed)

      const media = updatedAsset?.media as PrismaJson.MediaInfo
      expect(media?.error).toBeDefined()
      expect(media?.error?.length).toBeGreaterThan(0)
    }, 45000)
  },
)
