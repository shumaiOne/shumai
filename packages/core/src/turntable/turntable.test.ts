import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { TurntableService } from './turntable'

describe('TurntableService', () => {
  setupTestDbHooks()

  const originalEnv = process.env
  let tmpDir: string
  let testFilePath: string

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.TURNTABLE_RENDERER_URL
    delete process.env.TURNTABLE_RENDERER_BASIC_AUTH_USERNAME
    delete process.env.TURNTABLE_RENDERER_BASIC_AUTH_PASSWORD
    delete process.env.TURNTABLE_RENDERER_USERNAME
    delete process.env.TURNTABLE_RENDERER_PASSWORD

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turntable-test-'))
    testFilePath = path.join(tmpDir, 'model.glb')
    fs.writeFileSync(testFilePath, 'fake glb content')
  })

  afterEach(() => {
    process.env = originalEnv
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('resolveConfig', () => {
    it('returns isEnv: false when neither env nor team settings are present', async () => {
      const service = new TurntableService()
      const config = await service.resolveConfig()
      expect(config.url).toBeUndefined()
      expect(config.isEnv).toBe(false)
    })

    it('resolves env configuration with highest priority', async () => {
      process.env.TURNTABLE_RENDERER_URL = 'http://localhost:3000/'
      process.env.TURNTABLE_RENDERER_BASIC_AUTH_USERNAME = 'admin'
      process.env.TURNTABLE_RENDERER_BASIC_AUTH_PASSWORD = 'secret'

      const service = new TurntableService()
      const config = await service.resolveConfig('any-team-id')

      expect(config.url).toBe('http://localhost:3000')
      expect(config.username).toBe('admin')
      expect(config.password).toBe('secret')
      expect(config.isEnv).toBe(true)
    })

    it('falls back to team DB settings when env is not set', async () => {
      const team = await prisma.team.create({
        data: {
          name: 'Test Team 3D',
          settings: {
            turntable: {
              url: 'http://custom-turntable:4000',
              username: 'teamUser',
              password: 'teamPassword',
            },
          },
        },
      })

      const service = new TurntableService()
      const config = await service.resolveConfig(team.id)

      expect(config.url).toBe('http://custom-turntable:4000')
      expect(config.username).toBe('teamUser')
      expect(config.password).toBe('teamPassword')
      expect(config.isEnv).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('returns false if URL is not configured', async () => {
      const service = new TurntableService()
      expect(await service.isAvailable()).toBe(false)
    })

    it('returns true when health check returns 200', async () => {
      process.env.TURNTABLE_RENDERER_URL = 'http://turntable:3000'
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      const service = new TurntableService()
      expect(await service.isAvailable()).toBe(true)
    })

    it('returns false when health check fails or throws', async () => {
      process.env.TURNTABLE_RENDERER_URL = 'http://turntable:3000'
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'))

      const service = new TurntableService()
      expect(await service.isAvailable()).toBe(false)
    })
  })

  describe('testConnection', () => {
    it('returns error when url is empty', async () => {
      const service = new TurntableService()
      const result = await service.testConnection({})
      expect(result.ok).toBe(false)
      expect(result.error).toBe('URL is required')
    })

    it('returns version information upon successful connection', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ version: '0.1.0', blender: '5.2.2' }),
      } as Response)

      const service = new TurntableService()
      const result = await service.testConnection({ url: 'http://localhost:3000' })

      expect(result.ok).toBe(true)
      expect(result.version).toBe('0.1.0')
      expect(result.blender).toBe('5.2.2')
    })
  })

  describe('uploadFile', () => {
    it('posts file buffer to /v1/files and returns file info', async () => {
      process.env.TURNTABLE_RENDERER_URL = 'http://turntable:3000'
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'f_test123', name: 'model.glb', size: 100 }),
      } as Response)

      const service = new TurntableService()
      const res = await service.uploadFile(testFilePath, 'model.glb')

      expect(res.id).toBe('f_test123')
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://turntable:3000/v1/files',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })
  })

  describe('startRender & getTaskStatus & downloadFile & deleteTask', () => {
    beforeEach(() => {
      process.env.TURNTABLE_RENDERER_URL = 'http://turntable:3000'
    })

    it('startRender calls /v1/render and returns sync response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          taskId: 't_test456',
          status: 'queued',
          poster: {
            fileId: 'f_poster',
            size: 200,
            contentType: 'image/png',
            width: 1080,
            height: 1080,
          },
        }),
      } as Response)

      const service = new TurntableService()
      const res = await service.startRender('f_input')
      expect(res.taskId).toBe('t_test456')
      expect(res.poster.fileId).toBe('f_poster')
    })

    it('getTaskStatus queries /v1/render/tasks/:id', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          taskId: 't_test456',
          status: 'completed',
          video: {
            fileId: 'f_video',
            size: 1000,
            contentType: 'video/mp4',
            width: 1080,
            height: 1080,
          },
        }),
      } as Response)

      const service = new TurntableService()
      const res = await service.getTaskStatus('t_test456')
      expect(res.status).toBe('completed')
      expect(res.video?.fileId).toBe('f_video')
    })

    it('downloadFile fetches /v1/files/:id and writes to destination', async () => {
      const destPath = path.join(tmpDir, 'downloaded.mp4')
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from('video data').buffer,
      } as Response)

      const service = new TurntableService()
      await service.downloadFile('f_video', destPath)

      expect(fs.existsSync(destPath)).toBe(true)
      expect(fs.readFileSync(destPath, 'utf8')).toBe('video data')
    })

    it('deleteTask calls DELETE /v1/render/tasks/:id and returns boolean', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      const service = new TurntableService()
      const deleted = await service.deleteTask('t_test456')

      expect(deleted).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://turntable:3000/v1/render/tasks/t_test456',
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
    })
  })
})
