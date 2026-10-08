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
  'Workflow E2E - 3D Asset Transcode (executor: %s)',
  (mode) => {
    setupTestDbHooks()

    let transcodeWorkerPromise: Promise<void> | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockTurntableServer: any = null

    beforeAll(async () => {
      process.env.S3_BUCKET = 'shumai-e2e-test-bucket-3d'

      const smallPngBuffer = fs.readFileSync(path.join(fixturesDir, 'small.png'))
      const smallMp4Buffer = fs.readFileSync(path.join(fixturesDir, 'small.mp4'))

      mockTurntableServer = Bun.serve({
        port: 0,
        fetch(req) {
          const url = new URL(req.url)
          if (url.pathname === '/version') {
            return Response.json({ version: '1.0.0', runtime: 'bun', blender: '5.2.0' })
          }
          if (url.pathname === '/v1/files' && req.method === 'POST') {
            return Response.json({ id: 'f_input3d', name: 'model.glb', size: 100 }, { status: 201 })
          }
          if (url.pathname === '/v1/render' && req.method === 'POST') {
            return Response.json(
              {
                taskId: 't_render3d',
                status: 'completed',
                poster: {
                  fileId: 'f_poster3d',
                  size: smallPngBuffer.length,
                  contentType: 'image/png',
                  width: 1080,
                  height: 1080,
                },
                metadata: { format: 'glb' },
              },
              { status: 201 },
            )
          }
          if (url.pathname === '/v1/render/tasks/t_render3d') {
            if (req.method === 'DELETE') {
              return Response.json({ ok: true })
            }
            return Response.json({
              taskId: 't_render3d',
              status: 'completed',
              posterFileId: 'f_poster3d',
              video: {
                fileId: 'f_video3d',
                size: smallMp4Buffer.length,
                contentType: 'video/mp4',
                width: 1080,
                height: 1080,
              },
            })
          }
          if (url.pathname === '/v1/files/f_poster3d') {
            return new Response(smallPngBuffer, {
              headers: { 'Content-Type': 'image/png' },
            })
          }
          if (url.pathname === '/v1/files/f_video3d') {
            return new Response(smallMp4Buffer, {
              headers: { 'Content-Type': 'video/mp4' },
            })
          }
          return new Response('Not Found', { status: 404 })
        },
      })

      process.env.TURNTABLE_RENDERER_URL = `http://localhost:${mockTurntableServer.port}`

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

      if (mockTurntableServer) {
        mockTurntableServer.stop()
      }

      delete process.env.TURNTABLE_RENDERER_URL

      try {
        console.log('Cleaning up E2E storage files...')
        await s3Service.deletePrefix('shumai-e2e-test-bucket-3d', '')
      } catch (err) {
        console.error('Failed to clean up E2E storage folder:', err)
      }
    }, 120000)

    it('should process 3D model transcode workflow task', async () => {
      const team = await prisma.team.create({
        data: { name: 'E2E 3D Transcode Team' },
      })

      const project = await prisma.project.create({
        data: { name: 'E2E 3D Transcode Project', teamId: team.id },
      })

      const storageKey = await prisma.storageKey.create({
        data: {
          key: 'projects/e2e/model.glb',
          status: 'active',
        },
      })

      const asset = await prisma.asset.create({
        data: {
          name: 'model.glb',
          type: 'file',
          status: 'uploaded',
          mediaType: 'model/gltf-binary',
          projectId: project.id,
          storageKeyId: storageKey.id,
        },
      })

      const dummyGlbBuffer = Buffer.from('dummy glb content')
      await s3Service.putObject(
        'shumai-e2e-test-bucket-3d',
        'projects/e2e/model.glb',
        dummyGlbBuffer,
        dummyGlbBuffer.length,
        'model/gltf-binary',
      )

      const task = await prisma.workflowTask.create({
        data: {
          type: 'transcode_3d',
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
        `Submitted E2E 3D Transcode Workflow Task. ID: ${task.id}. Awaiting completion...`,
      )
      const completedTask = await workflowService.executeWait(task, 60000)

      expect(completedTask.status).toBe('completed')

      const updatedAsset = await prisma.asset.findUnique({
        where: { id: asset.id },
      })
      expect(updatedAsset?.status).toBe(AssetStatus.processed)

      const mediaInfo = updatedAsset?.media as unknown as {
        proxyType?: string
        videoPreview?: { key: string }
        poster?: { key: string }
        sprite?: { key: string }
      }
      expect(mediaInfo).toBeDefined()
      expect(mediaInfo.proxyType).toBe('3d')
      expect(mediaInfo.videoPreview?.key).toBe('projects/e2e/turntable.mp4')
      expect(mediaInfo.poster?.key).toBe('projects/e2e/poster.webp')
      expect(mediaInfo.sprite?.key).toBe('projects/e2e/sprite.webp')
    }, 90000)
  },
)
