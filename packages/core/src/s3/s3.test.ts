import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { LocalStorageService, S3StorageService } from './s3'

// Mock the AWS SDK
const s3ClientConstructorSpy = vi.fn()
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      constructor(params: unknown) {
        s3ClientConstructorSpy(params)
      }
      send = vi.fn().mockResolvedValue({})
    },
    HeadObjectCommand: class {},
    PutObjectCommand: class {},
    GetObjectCommand: class {},
    ListObjectsV2Command: class {},
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: vi.fn().mockResolvedValue('http://presigned-url'),
  }
})

describe('S3Service implementations', () => {
  beforeEach(async () => {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    vi.mocked(getSignedUrl).mockReset()
    vi.mocked(getSignedUrl).mockResolvedValue('http://presigned-url')
    vi.clearAllMocks()
    delete process.env.PRESIGNED_URL_EXPIRES_IN
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
    })

    it('should cache GET presign URLs', async () => {
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

      vi.mocked(getSignedUrl).mockClear()
      vi.mocked(getSignedUrl).mockResolvedValueOnce('http://presigned-url-1')
      vi.mocked(getSignedUrl).mockResolvedValueOnce('http://presigned-url-2')

      const url1 = await s3.presign('bucket', 'key', 'GET')
      const url2 = await s3.presign('bucket', 'key', 'GET')

      expect(url1).toBe('http://presigned-url-1')
      expect(url2).toBe('http://presigned-url-1')
      expect(vi.mocked(getSignedUrl)).toHaveBeenCalledTimes(1)
    })

    it('should NOT cache PUT presign URLs', async () => {
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

      vi.mocked(getSignedUrl).mockClear()
      vi.mocked(getSignedUrl).mockResolvedValueOnce('http://put-url-1')
      vi.mocked(getSignedUrl).mockResolvedValueOnce('http://put-url-2')

      const url1 = await s3.presign('bucket', 'key', 'PUT')
      const url2 = await s3.presign('bucket', 'key', 'PUT')

      expect(url1).toBe('http://put-url-1')
      expect(url2).toBe('http://put-url-2')
      expect(vi.mocked(getSignedUrl)).toHaveBeenCalledTimes(2)
    })

    it('should respect PRESIGNED_URL_EXPIRES_IN env', async () => {
      process.env.PRESIGNED_URL_EXPIRES_IN = '10'
      const s3 = new S3StorageService('localhost:9000', 'key', 'secret', 'test-bucket', false)
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

      vi.mocked(getSignedUrl).mockClear()
      await s3.presign('bucket', 'key', 'GET')

      expect(vi.mocked(getSignedUrl)).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 10 * 3600 }),
      )

      delete process.env.PRESIGNED_URL_EXPIRES_IN
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

    it('should throw an error for unsupported presign methods', async () => {
      await expect(localS3.presign('b', 'k', 'POST')).rejects.toThrow()
    })
  })
})
