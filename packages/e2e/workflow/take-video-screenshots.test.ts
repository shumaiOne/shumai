import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { workflowService, TaskQueueTranscode } from '@shumai/workflow-core'
import { initTranscodeWorkflows } from '@shumai/transcode'
import { s3Service } from '@shumai/core/src/s3/s3'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'
import sharp from 'sharp'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const transcodeWorkflowsPath = path.resolve(currentDir, '../../../apps/transcode/src/workflows.ts')
const fixturesDir = path.resolve(currentDir, '../fixtures')

describe.each(['local', 'temporal'] as const)(
  'Workflow E2E - takeVideoScreenshotsWorkflow (executor: %s)',
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

    it('should draw annotation box correctly for 5 random comment timestamps', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Video Screenshot Annotation Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Video Screenshot Annotation Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/video-shot-ann.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'video-shot-ann.mp4',
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
        'projects/e2e/video-shot-ann.mp4',
        mp4Buffer,
        mp4Buffer.length,
        'video/mp4',
      )

      // 3. Generate 5 random comment timestamps between 0.05s and 0.95s
      const randomTimestamps: number[] = []
      for (let i = 0; i < 5; i++) {
        const randomTs = 0.05 + Math.random() * 0.9
        randomTimestamps.push(randomTs)
      }

      console.log('Testing random timestamps:', randomTimestamps)

      const boxAnnotation = [
        {
          type: 'box' as const,
          color: '#ff0000',
          points: [
            [0.2, 0.2],
            [0.8, 0.8],
          ],
        },
      ]

      for (const commentTimestamp of randomTimestamps) {
        // Create Workflow Task with commentTimestamp & annotations
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
                count: 5,
                commentTimestamp,
                annotations: boxAnnotation,
              },
            },
          },
        })

        const completedTask = await workflowService.executeWait(task, 45000)
        expect(completedTask.status).toBe('completed')

        const output = completedTask.output as unknown as {
          screenshots: { key: string; timestamp: number }[]
        }
        expect(output).toBeDefined()
        expect(output.screenshots).toBeDefined()

        // Find the screenshot matching commentTimestamp
        const matchingShot = output.screenshots.find(
          (s) => Math.abs(s.timestamp - commentTimestamp) < 1e-6,
        )
        expect(matchingShot).toBeDefined()

        // Download screenshot buffer from S3
        const s3Obj = await s3Service.getObject(
          'shumai-e2e-test-bucket-transcode',
          matchingShot!.key,
        )
        const shotBuffer = s3Obj.buffer

        // Verify pixel data using sharp to check if red box annotation was overlaid
        const { data, info } = await sharp(shotBuffer).raw().toBuffer({ resolveWithObject: true })

        // Target pixel inside box (e.g. x = 50%, y = 20% near top edge of red box)
        const pixelX = Math.floor(info.width * 0.5)
        const pixelY = Math.floor(info.height * 0.2)
        const offset = (pixelY * info.width + pixelX) * info.channels

        const r = data[offset]
        const g = data[offset + 1]
        const b = data[offset + 2]

        // Red box color #ff0000 should result in high red channel and low green/blue channels
        expect(r).toBeGreaterThan(150)
        expect(g).toBeLessThan(120)
        expect(b).toBeLessThan(120)
      }
    }, 90000)

    it('should overlay annotation when commentTimestamp has rounding mismatch with start/end', async () => {
      // 1. Seed Database
      const team = await prisma.team.create({
        data: { name: 'E2E Video Screenshot Rounding Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E Video Screenshot Rounding Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/video-shot-rounding.mp4',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'video-shot-rounding.mp4',
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
        'projects/e2e/video-shot-rounding.mp4',
        mp4Buffer,
        mp4Buffer.length,
        'video/mp4',
      )

      // Reproduce log scenario: exact timestamp is 0.566666666666667, Agent requested rounded 0.57
      const commentTimestamp = 0.566666666666667
      const start = 0.57
      const end = 0.57

      const boxAnnotation = [
        {
          type: 'box' as const,
          color: '#ff0000',
          points: [
            [0.2, 0.2],
            [0.8, 0.8],
          ],
        },
      ]

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
              start,
              end,
              count: 1,
              commentTimestamp,
              annotations: boxAnnotation,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task, 45000)
      expect(completedTask.status).toBe('completed')

      const output = completedTask.output as unknown as {
        screenshots: { key: string; timestamp: number }[]
      }
      expect(output).toBeDefined()
      expect(output.screenshots).toBeDefined()
      expect(output.screenshots.length).toBe(1)

      const s3Obj = await s3Service.getObject(
        'shumai-e2e-test-bucket-transcode',
        output.screenshots[0].key,
      )
      const shotBuffer = s3Obj.buffer

      const { data, info } = await sharp(shotBuffer).raw().toBuffer({ resolveWithObject: true })

      const pixelX = Math.floor(info.width * 0.5)
      const pixelY = Math.floor(info.height * 0.2)
      const offset = (pixelY * info.width + pixelX) * info.channels

      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]

      expect(r).toBeGreaterThan(150)
      expect(g).toBeLessThan(120)
      expect(b).toBeLessThan(120)
    }, 50000)
  },
)
