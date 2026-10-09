import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render3dModelActivity,
  start3dRenderActivity,
  waitFor3dVideoRenderActivity,
  generate3dSpriteActivity,
} from './transcode'
import { turntableService } from '@shumai/core/src/turntable/turntable'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core/src/transcode/transcode'
import * as fs from 'fs'

vi.mock('@shumai/core/src/turntable/turntable', () => ({
  turntableService: {
    uploadFile: vi.fn(),
    startRender: vi.fn(),
    getTaskStatus: vi.fn(),
    downloadFile: vi.fn(),
    deleteTask: vi.fn(),
    deleteFile: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    putObject: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/transcode/transcode', () => ({
  transcodeService: {
    convertImageToWebp: vi.fn(),
    generate3dSprite: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/asset/asset', () => ({
  assetService: {
    isAssetPurging: vi.fn().mockResolvedValue(false),
  },
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

describe('3D Transcode Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-bytes'))
    vi.mocked(transcodeService.convertImageToWebp).mockResolvedValue(Buffer.from('webp-bytes'))
    vi.mocked(transcodeService.generate3dSprite).mockResolvedValue()
    vi.mocked(s3Service.putObject).mockResolvedValue({} as never)
    vi.mocked(turntableService.deleteTask).mockResolvedValue(true)
  })

  describe('start3dRenderActivity', () => {
    it('uploads file, starts render, immediately downloads and uploads poster to S3', async () => {
      vi.mocked(turntableService.uploadFile).mockResolvedValue({
        id: 'f_input',
        name: 'model.glb',
        size: 1024,
      })

      vi.mocked(turntableService.startRender).mockResolvedValue({
        taskId: 'task_render_1',
        status: 'queued',
        poster: {
          fileId: 'f_poster',
          contentType: 'image/png',
          width: 1080,
          height: 1080,
          size: 5000,
        },
        metadata: { format: 'glb', vertices: 120 },
      })

      vi.mocked(turntableService.downloadFile).mockResolvedValue(Buffer.from('poster-raw-data'))

      const res = await start3dRenderActivity({
        taskId: 'wf-task-1',
        teamId: 'team-1',
        assetId: 'asset-1',
        assetKey: 'files/asset-1/model.glb',
        filePath: '/tmp/model.glb',
        filename: 'model.glb',
        targetPosterKey: 'files/asset-1/poster.webp',
      })

      expect(turntableService.uploadFile).toHaveBeenCalledWith(
        '/tmp/model.glb',
        'model.glb',
        'team-1',
      )
      expect(turntableService.startRender).toHaveBeenCalledWith('f_input', {}, 'team-1')
      expect(turntableService.downloadFile).toHaveBeenCalledWith('f_poster', undefined, 'team-1')
      expect(transcodeService.convertImageToWebp).toHaveBeenCalledWith(
        Buffer.from('poster-raw-data'),
      )
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        'files/asset-1/poster.webp',
        Buffer.from('webp-bytes'),
        Buffer.from('webp-bytes').length,
        'image/webp',
      )

      expect(res.renderTaskId).toBe('task_render_1')
      expect(res.posterFilePath).toBe('/tmp/poster.webp')
      expect(res.posterWidth).toBe(1080)
      expect(res.posterHeight).toBe(1080)
      expect(res.modelMetadata).toEqual({ format: 'glb', vertices: 120 })
    })

    it('throws ApplicationFailure when poster file ID is missing', async () => {
      vi.mocked(turntableService.uploadFile).mockResolvedValue({
        id: 'f_input',
        name: 'model.glb',
        size: 1024,
      })

      vi.mocked(turntableService.startRender).mockResolvedValue({
        taskId: 'task_render_1',
        status: 'queued',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        poster: undefined as any,
      })

      await expect(
        start3dRenderActivity({
          taskId: 'wf-task-1',
          teamId: 'team-1',
          assetId: 'asset-1',
          assetKey: 'files/asset-1/model.glb',
          filePath: '/tmp/model.glb',
          filename: 'model.glb',
          targetPosterKey: 'files/asset-1/poster.webp',
        }),
      ).rejects.toThrow('Poster file ID missing from turntable render result')

      expect(turntableService.deleteTask).toHaveBeenCalledWith('task_render_1', 'team-1')
    })
  })

  describe('waitFor3dVideoRenderActivity', () => {
    it('polls until complete, downloads video, uploads to S3, and cleans up task', async () => {
      vi.mocked(turntableService.getTaskStatus).mockResolvedValue({
        taskId: 'task_render_1',
        status: 'completed',
        createdAt: new Date().toISOString(),
        video: {
          fileId: 'f_video',
          contentType: 'video/mp4',
          width: 1080,
          height: 1080,
          size: 1000,
        },
      })

      vi.mocked(turntableService.downloadFile).mockResolvedValue(Buffer.from('video-data'))

      const res = await waitFor3dVideoRenderActivity({
        taskId: 'wf-task-1',
        teamId: 'team-1',
        assetKey: 'files/asset-1/model.glb',
        renderTaskId: 'task_render_1',
        targetVideoKey: 'files/asset-1/turntable.mp4',
        tmpDir: '/tmp',
      })

      expect(turntableService.getTaskStatus).toHaveBeenCalledWith('task_render_1', 'team-1')
      expect(turntableService.downloadFile).toHaveBeenCalledWith(
        'f_video',
        '/tmp/turntable.mp4',
        'team-1',
      )
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        'files/asset-1/turntable.mp4',
        Buffer.from('video-data'),
        Buffer.from('video-data').length,
        'video/mp4',
      )
      expect(turntableService.deleteTask).toHaveBeenCalledWith('task_render_1', 'team-1')
      expect(res.videoFilePath).toBe('/tmp/turntable.mp4')
    })

    it('throws ApplicationFailure when render fails on turntable-renderer', async () => {
      vi.mocked(turntableService.getTaskStatus).mockResolvedValue({
        taskId: 'task_render_2',
        status: 'failed',
        createdAt: new Date().toISOString(),
        error: {
          code: 'render_failed',
          message: 'Blender failed to import model',
        },
      })

      await expect(
        waitFor3dVideoRenderActivity({
          taskId: 'wf-task-2',
          teamId: 'team-1',
          assetKey: 'files/asset-1/model.glb',
          renderTaskId: 'task_render_2',
          targetVideoKey: 'files/asset-1/turntable.mp4',
          tmpDir: '/tmp',
        }),
      ).rejects.toThrow('Blender failed to import model')

      expect(turntableService.deleteTask).toHaveBeenCalledWith('task_render_2', 'team-1')
    })
  })

  describe('render3dModelActivity (legacy wrapper)', () => {
    it('uploads file, starts render, polls until complete, and uploads to S3', async () => {
      vi.mocked(turntableService.uploadFile).mockResolvedValue({
        id: 'f_input',
        name: 'model.glb',
        size: 1024,
      })

      vi.mocked(turntableService.startRender).mockResolvedValue({
        taskId: 'task_render_1',
        status: 'queued',
        poster: {
          fileId: 'f_poster',
          contentType: 'image/png',
          width: 1080,
          height: 1080,
          size: 5000,
        },
        metadata: { format: 'glb', vertices: 120 },
      })

      vi.mocked(turntableService.getTaskStatus).mockResolvedValue({
        taskId: 'task_render_1',
        status: 'completed',
        createdAt: new Date().toISOString(),
        video: {
          fileId: 'f_video',
          contentType: 'video/mp4',
          width: 1080,
          height: 1080,
          size: 1000,
        },
      })

      vi.mocked(turntableService.downloadFile).mockResolvedValue(Buffer.from('downloaded-data'))

      const res = await render3dModelActivity({
        taskId: 'wf-task-1',
        teamId: 'team-1',
        assetId: 'asset-1',
        assetKey: 'files/asset-1/model.glb',
        filePath: '/tmp/model.glb',
        filename: 'model.glb',
        targetVideoKey: 'files/asset-1/turntable.mp4',
        targetPosterKey: 'files/asset-1/poster.webp',
      })

      expect(turntableService.uploadFile).toHaveBeenCalledWith(
        '/tmp/model.glb',
        'model.glb',
        'team-1',
      )
      expect(turntableService.startRender).toHaveBeenCalledWith('f_input', {}, 'team-1')
      expect(turntableService.getTaskStatus).toHaveBeenCalledWith('task_render_1', 'team-1')
      expect(turntableService.downloadFile).toHaveBeenCalledWith(
        'f_video',
        '/tmp/turntable.mp4',
        'team-1',
      )
      expect(turntableService.downloadFile).toHaveBeenCalledWith('f_poster', undefined, 'team-1')
      expect(transcodeService.convertImageToWebp).toHaveBeenCalledWith(expect.any(Buffer))

      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        'files/asset-1/turntable.mp4',
        expect.any(Buffer),
        expect.any(Number),
        'video/mp4',
      )
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        'files/asset-1/poster.webp',
        expect.any(Buffer),
        expect.any(Number),
        'image/webp',
      )

      expect(turntableService.deleteTask).toHaveBeenCalledWith('task_render_1', 'team-1')
      expect(res.modelMetadata).toEqual({ format: 'glb', vertices: 120 })
      expect(res.videoFilePath).toBe('/tmp/turntable.mp4')
      expect(res.posterFilePath).toBe('/tmp/poster.webp')
    })
  })

  describe('generate3dSpriteActivity', () => {
    it('generates 3d sprite sheet and uploads to S3', async () => {
      const res = await generate3dSpriteActivity({
        taskId: 'wf-task-3',
        assetKey: 'files/asset-1/model.glb',
        videoFilePath: '/tmp/turntable.mp4',
        spriteKey: 'files/asset-1/sprite.webp',
      })

      expect(transcodeService.generate3dSprite).toHaveBeenCalledWith(
        '/tmp/turntable.mp4',
        '/tmp/sprite.webp',
        undefined,
      )
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        'files/asset-1/sprite.webp',
        expect.any(Buffer),
        expect.any(Number),
        'image/webp',
      )
      expect(res.spriteKey).toBe('files/asset-1/sprite.webp')
    })
  })
})
