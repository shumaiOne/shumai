import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { GotenbergService } from './gotenberg'

describe('GotenbergService', () => {
  setupTestDbHooks()
  const originalEnv = process.env
  let tmpDir: string
  let testFilePath: string

  beforeEach(() => {
    process.env = { ...originalEnv }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gotenberg-test-'))
    testFilePath = path.join(tmpDir, 'test.docx')
    fs.writeFileSync(testFilePath, 'fake docx content')
  })

  afterEach(() => {
    process.env = originalEnv
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('isAvailable', () => {
    it('should return false if GOTENBERG_URL is not set', async () => {
      delete process.env.GOTENBERG_URL
      const service = new GotenbergService()
      expect(await service.isAvailable()).toBe(false)
    })

    it('should return false if GOTENBERG_URL is empty', async () => {
      process.env.GOTENBERG_URL = '   '
      const service = new GotenbergService()
      expect(await service.isAvailable()).toBe(false)
    })

    it('should return true when health check returns 200 OK', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      const service = new GotenbergService()
      const available = await service.isAvailable()

      expect(available).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://gotenberg:3000/health',
        expect.objectContaining({
          method: 'GET',
        }),
      )
    })

    it('should include Basic Auth header if username and password are provided', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      process.env.GOTENBERG_BASIC_AUTH_USERNAME = 'user'
      process.env.GOTENBERG_BASIC_AUTH_PASSWORD = 'pass'

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)

      const service = new GotenbergService()
      await service.isAvailable()

      const expectedBasic = Buffer.from('user:pass').toString('base64')
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://gotenberg:3000/health',
        expect.objectContaining({
          headers: {
            Authorization: `Basic ${expectedBasic}`,
          },
        }),
      )
    })

    it('should return false when fetch fails', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const service = new GotenbergService()
      expect(await service.isAvailable()).toBe(false)
    })
  })

  describe('convertDocumentToPdf', () => {
    it('should throw error if GOTENBERG_URL is not set', async () => {
      delete process.env.GOTENBERG_URL
      const service = new GotenbergService()
      await expect(service.convertDocumentToPdf(testFilePath, 'test.docx')).rejects.toThrow(
        'Gotenberg URL is not configured',
      )
    })

    it('should call libreoffice convert endpoint and return buffer', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000/'
      const mockPdfBuffer = Buffer.from('%PDF-1.7 mock output')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as unknown as Response)

      const service = new GotenbergService()
      const result = await service.convertDocumentToPdf(testFilePath, 'test.docx', {
        landscape: true,
      })

      expect(result).toBeDefined()
      expect(result.toString()).toContain('%PDF-1.7')

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://gotenberg:3000/forms/libreoffice/convert',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      )
    })

    it('should throw error if gotenberg returns non-200', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Conversion failed',
      } as unknown as Response)

      const service = new GotenbergService()
      await expect(service.convertDocumentToPdf(testFilePath, 'test.docx')).rejects.toThrow(
        'Gotenberg conversion failed with status 500: Conversion failed',
      )
    })
  })

  describe('convertHtmlToPdf', () => {
    it('should call chromium html convert endpoint and return buffer', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      const mockPdfBuffer = Buffer.from('%PDF-1.4 html output')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as unknown as Response)

      const htmlPath = path.join(tmpDir, 'test.html')
      fs.writeFileSync(htmlPath, '<h1>Hello</h1>')

      const service = new GotenbergService()
      const result = await service.convertHtmlToPdf(htmlPath, 'test.html')

      expect(result).toBeDefined()
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://gotenberg:3000/forms/chromium/convert/html',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })
  })

  describe('convertMarkdownToPdf', () => {
    it('should call chromium markdown convert endpoint with index.html wrapper and return buffer', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      const mockPdfBuffer = Buffer.from('%PDF-1.4 markdown output')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as unknown as Response)

      const mdPath = path.join(tmpDir, 'test.md')
      fs.writeFileSync(mdPath, '# Hello Gotenberg')

      const service = new GotenbergService()
      const result = await service.convertMarkdownToPdf(mdPath, 'test.md')

      expect(result).toBeDefined()
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://gotenberg:3000/forms/chromium/convert/markdown',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      )
    })

    it('should rename non-.md filenames like README.markdown to file.md for Gotenberg endpoint compatibility', async () => {
      process.env.GOTENBERG_URL = 'http://gotenberg:3000'
      const mockPdfBuffer = Buffer.from('%PDF-1.4 markdown output')
      let capturedFormData: FormData | null = null

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        capturedFormData = options?.body as FormData
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => mockPdfBuffer.buffer,
        } as unknown as Response
      })

      const mdPath = path.join(tmpDir, 'README.markdown')
      fs.writeFileSync(mdPath, '# Hello Gotenberg')

      const service = new GotenbergService()
      await service.convertMarkdownToPdf(mdPath, 'README.markdown')

      expect(capturedFormData).not.toBeNull()
      const indexBlob = (capturedFormData as unknown as FormData).get('files') as File
      const indexHtmlText = await indexBlob.text()
      expect(indexHtmlText).toContain('{{ toHTML "file.md" }}')
    })
  })

  describe('team settings & fallback', () => {
    it('resolves config from team settings when env is not set', async () => {
      delete process.env.GOTENBERG_URL
      const team = await prisma.team.create({
        data: {
          name: 'Gotenberg Team',
          settings: {
            gotenberg: {
              url: 'http://custom-gotenberg:4000',
              username: 'team-user',
              password: 'team-password',
            },
          },
        },
      })

      const service = new GotenbergService()
      const config = await service.resolveConfig(team.id)

      expect(config).toEqual({
        url: 'http://custom-gotenberg:4000',
        username: 'team-user',
        password: 'team-password',
        isEnv: false,
      })
    })

    it('prioritizes environment variables over team settings', async () => {
      process.env.GOTENBERG_URL = 'http://env-gotenberg:3000'
      const team = await prisma.team.create({
        data: {
          name: 'Gotenberg Team',
          settings: {
            gotenberg: {
              url: 'http://custom-gotenberg:4000',
            },
          },
        },
      })

      const service = new GotenbergService()
      const config = await service.resolveConfig(team.id)

      expect(config.url).toBe('http://env-gotenberg:3000')
      expect(config.isEnv).toBe(true)
    })

    it('getSettings returns masked settings response', async () => {
      delete process.env.GOTENBERG_URL
      const team = await prisma.team.create({
        data: {
          name: 'Gotenberg Team',
          settings: {
            gotenberg: {
              url: 'http://custom-gotenberg:4000',
              username: 'team-user',
              password: 'team-password',
            },
          },
        },
      })

      const service = new GotenbergService()
      const settings = await service.getSettings(team.id)

      expect(settings).toEqual({
        url: 'http://custom-gotenberg:4000',
        username: 'team-user',
        hasPassword: true,
        isEnvConfigured: false,
      })
    })

    it('updateSettings updates team settings and rejects edits when env is set', async () => {
      delete process.env.GOTENBERG_URL
      const team = await prisma.team.create({
        data: { name: 'Gotenberg Team' },
      })

      const service = new GotenbergService()
      const updated = await service.updateSettings(team.id, {
        url: 'http://new-gotenberg:3000',
        username: 'admin',
        password: 'secret-password',
      })

      expect(updated.url).toBe('http://new-gotenberg:3000')
      expect(updated.username).toBe('admin')
      expect(updated.hasPassword).toBe(true)

      // When env is set, reject update
      process.env.GOTENBERG_URL = 'http://env-gotenberg:3000'
      await expect(service.updateSettings(team.id, { url: 'http://another:3000' })).rejects.toThrow(
        'Gotenberg settings are configured via environment variables and cannot be edited',
      )
    })
  })

  describe('testConnection', () => {
    it('returns error when url is empty and no team settings exist', async () => {
      delete process.env.GOTENBERG_URL
      const service = new GotenbergService()
      const result = await service.testConnection({})
      expect(result.ok).toBe(false)
      expect(result.error).toBe('URL is required')
    })

    it('successfully connects to /health and enriches with /version', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url)
        if (urlStr.endsWith('/health')) {
          return { ok: true, status: 200 } as Response
        }
        if (urlStr.endsWith('/version')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ version: '8.3.0' }),
          } as Response
        }
        return { ok: false, status: 404 } as Response
      })

      const service = new GotenbergService()
      const result = await service.testConnection({
        url: 'http://gotenberg.local:3000',
        username: 'test-user',
        password: 'test-pass',
      })

      expect(result.ok).toBe(true)
      expect(result.version).toBe('8.3.0')
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://gotenberg.local:3000/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      )
    })
  })
})
