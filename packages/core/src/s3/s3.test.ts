import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { LocalStorageService, S3StorageService } from './s3'

// Mock Bun S3Client
const s3ClientConstructorSpy = vi.fn()
const s3FileSpy = vi.fn()
const s3WriteSpy = vi.fn()
const s3DeleteSpy = vi.fn()
const s3ListSpy = vi.fn()
const s3ExistsSpy = vi.fn()
const s3PresignSpy = vi.fn()

vi.mock('bun', () => {
  return {
    S3Client: class {
      constructor(params: unknown) {
        s3ClientConstructorSpy(params)
      }
      file = s3FileSpy.mockReturnValue({
        size: Promise.resolve(123),
        exists: vi.fn().mockResolvedValue(true),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
        type: 'text/plain',
      })
      write = s3WriteSpy.mockResolvedValue({})
      delete = s3DeleteSpy.mockResolvedValue({})
      list = s3ListSpy.mockResolvedValue({ contents: [], isTruncated: false })
      exists = s3ExistsSpy.mockResolvedValue(true)
      presign = s3PresignSpy.mockReturnValue('http://presigned-url')
    },
  }
})

describe('S3Service implementations', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    delete process.env.PRESIGNED_URL_EXPIRES_IN
    s3PresignSpy.mockReturnValue('http://presigned-url')
  })

  describe('S3StorageService', () => {
    it('should correctly build standard endpoints', () => {
      const s3 = new S3StorageService('s3.example.com', 'key', 'secret', 'test-bucket', true)
      expect(s3).toBeDefined()
      expect(s3ClientConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'auto' }),
      )
    })

    it('should use provided region', () => {
      s3ClientConstructorSpy.mockClear()
      const s3 = new S3StorageService(
        's3.example.com',
        'key',
        'secret',
        'test-bucket',
        true,
        'ap-singapore',
      )
      expect(s3).toBeDefined()
      expect(s3ClientConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'ap-singapore' }),
      )
    })

    it('should implement presign correctly', async () => {
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)
      const url = await s3.presign('bucket', 'key', 'GET')
      expect(url).toBe('http://presigned-url')
      expect(s3PresignSpy).toHaveBeenCalledWith('key', expect.objectContaining({ method: 'GET' }))
    })

    it('should cache GET presign URLs', async () => {
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)

      s3PresignSpy.mockClear()
      s3PresignSpy.mockReturnValueOnce('http://presigned-url-1')
      s3PresignSpy.mockReturnValueOnce('http://presigned-url-2')

      const url1 = await s3.presign('bucket', 'key', 'GET')
      const url2 = await s3.presign('bucket', 'key', 'GET')

      expect(url1).toBe('http://presigned-url-1')
      expect(url2).toBe('http://presigned-url-1')
      expect(s3PresignSpy).toHaveBeenCalledTimes(1)
    })

    it('should NOT cache PUT presign URLs', async () => {
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)

      s3PresignSpy.mockReset()
      s3PresignSpy.mockReturnValueOnce('http://unique-put-url-1')
      s3PresignSpy.mockReturnValueOnce('http://unique-put-url-2')

      const url1 = await s3.presign('bucket', 'key', 'PUT')
      const url2 = await s3.presign('bucket', 'key', 'PUT')

      expect(url1).toBe('http://unique-put-url-1')
      expect(url2).toBe('http://unique-put-url-2')
      expect(s3PresignSpy).toHaveBeenCalledTimes(2)
    })

    it('should respect PRESIGNED_URL_EXPIRES_IN env', async () => {
      process.env.PRESIGNED_URL_EXPIRES_IN = '10'
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)

      s3PresignSpy.mockClear()
      await s3.presign('bucket', 'key', 'GET')

      expect(s3PresignSpy).toHaveBeenCalledWith(
        'key',
        expect.objectContaining({ expiresIn: 10 * 3600 }),
      )

      delete process.env.PRESIGNED_URL_EXPIRES_IN
    })

    it('should pass filename to presign', async () => {
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)
      await s3.presign('bucket', 'key', 'GET', 'test.txt')

      expect(s3PresignSpy).toHaveBeenCalledWith(
        'key',
        expect.objectContaining({
          contentDisposition: 'attachment; filename="test.txt"',
        }),
      )
    })
  })

  describe('LocalStorageService', () => {
    const TEST_BASE_PATH = path.join(process.cwd(), 'data-test', 's3', 'data')
    let localS3: LocalStorageService

    beforeEach(() => {
      if (fs.existsSync(TEST_BASE_PATH)) {
        fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true })
      }
      fs.mkdirSync(TEST_BASE_PATH, { recursive: true })
      localS3 = new LocalStorageService('http://localhost:3000', TEST_BASE_PATH)
    })

    afterEach(() => {
      if (fs.existsSync(TEST_BASE_PATH)) {
        fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true })
      }
    })

    it('should implement putObject and getObjectSize correctly', async () => {
      await localS3.putObject('test-bucket', 'test.txt', 'hello world', 11)
      const size = await localS3.getObjectSize('test-bucket', 'test.txt')
      expect(size).toBe(11)
    })

    it('should list objects', async () => {
      await localS3.putObject('test-bucket', 'dir1/file1.txt', 'abc', 3)
      await localS3.putObject('test-bucket', 'dir1/file2.txt', 'def', 3)
      await localS3.putObject('test-bucket', 'dir2/file3.txt', 'ghi', 3)

      const keys1 = await localS3.listObjects('test-bucket', 'dir1')
      expect(keys1.length).toBe(2)
      expect(keys1).toContain('dir1/file1.txt')
      expect(keys1).toContain('dir1/file2.txt')

      const keysAll = await localS3.listObjects('test-bucket', '')
      expect(keysAll.length).toBe(3)
    })

    it('should handle headObject correctly', async () => {
      await localS3.putObject('test-bucket', 'test.txt', 'hello world', 11)
      const head = await localS3.headObject('test-bucket', 'test.txt')

      expect(head.key).toBe('test.txt')
      expect(head.size).toBe(11)
      expect(head.eTag).toContain('"')
    })

    it('should generate a local presign URL', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET')
      expect(url).toBe('http://localhost:3000/files/my-bucket/dir/file.txt')
    })

    it('should generate a local presign URL with filename', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', 'original.txt')
      expect(url).toBe('http://localhost:3000/files/my-bucket/dir/file.txt?filename=original.txt')
    })

    it('should throw an error for unsupported presign methods', async () => {
      await expect(localS3.presign('b', 'k', 'POST')).rejects.toThrow()
    })
  })
})
