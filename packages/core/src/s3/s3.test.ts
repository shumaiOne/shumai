import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import {
  buildContentDisposition,
  getPresignedUrlExpirySeconds,
  LocalStorageService,
  S3StorageService,
  signLocalGetUrl,
  signLocalUrl,
  verifyLocalGetUrlSignature,
  verifyLocalUrlSignature,
} from './s3'

const s3ClientConstructorSpy = vi.fn()
const s3SendSpy = vi.fn()
const getSignedUrlSpy = vi.fn()

vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>()
  return {
    ...actual,
    S3Client: class {
      constructor(params: unknown) {
        s3ClientConstructorSpy(params)
      }
      send = s3SendSpy
    },
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: vi.fn((client, command, options) => getSignedUrlSpy(client, command, options)),
  }
})

describe('S3Service implementations', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    getSignedUrlSpy.mockReset()
    delete process.env.PRESIGNED_URL_EXPIRES_IN
    delete process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN
    getSignedUrlSpy.mockResolvedValue('http://presigned-url')
    s3SendSpy.mockResolvedValue({})
  })

  describe('S3StorageService', () => {
    it('should correctly build standard endpoints', () => {
      const s3 = new S3StorageService('https://s3.example.com', 'key', 'secret', 'test-bucket')
      expect(s3).toBeDefined()
      expect(s3ClientConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'auto' }),
      )
    })

    it('should use provided region', () => {
      s3ClientConstructorSpy.mockClear()
      const s3 = new S3StorageService(
        'https://s3.example.com',
        'key',
        'secret',
        'test-bucket',
        'ap-singapore',
      )
      expect(s3).toBeDefined()
      expect(s3ClientConstructorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'ap-singapore' }),
      )
    })

    it('should implement presign correctly', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      const url = await s3.presign('bucket', 'key', 'GET')
      expect(url).toBe('http://presigned-url')
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        expect.objectContaining({ expiresIn: 43200 }),
      )
    })

    it('should cache GET presign URLs', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      getSignedUrlSpy.mockResolvedValueOnce('http://presigned-url-1')
      getSignedUrlSpy.mockResolvedValueOnce('http://presigned-url-2')

      const url1 = await s3.presign('bucket', 'key', 'GET')
      const url2 = await s3.presign('bucket', 'key', 'GET')

      expect(url1).toBe('http://presigned-url-1')
      expect(url2).toBe('http://presigned-url-1')
      expect(getSignedUrlSpy).toHaveBeenCalledTimes(1)
    })

    it('should refresh cached default GET presign URLs after half their lifetime', async () => {
      let wallNow = 1_700_000_000_000
      let perfNow = 1_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => wallNow)
      const perfNowSpy = vi.spyOn(performance, 'now').mockImplementation(() => perfNow)

      try {
        const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
        getSignedUrlSpy.mockClear()
        getSignedUrlSpy.mockResolvedValueOnce('http://presigned-url-1')
        getSignedUrlSpy.mockResolvedValueOnce('http://presigned-url-2')

        const url1 = await s3.presign('bucket', 'key', 'GET')
        expect(url1).toBe('http://presigned-url-1')

        // Default GET lifetime is 12h; before 6h the cached URL should still be reused
        const almostHalfMs = 6 * 3600 * 1000 - 1_000
        wallNow += almostHalfMs
        perfNow += almostHalfMs
        expect(await s3.presign('bucket', 'key', 'GET')).toBe('http://presigned-url-1')
        expect(getSignedUrlSpy).toHaveBeenCalledTimes(1)

        // Past 6h (half of the 12h lifetime), the cache must expire so callers never get nearly expired URLs
        wallNow += 2_000
        perfNow += 2_000
        expect(await s3.presign('bucket', 'key', 'GET')).toBe('http://presigned-url-2')
        expect(getSignedUrlSpy).toHaveBeenCalledTimes(2)
      } finally {
        dateNowSpy.mockRestore()
        perfNowSpy.mockRestore()
      }
    })

    it('should invalidate cached GET presign URLs after system sleep when wall clock advances but monotonic clock pauses', async () => {
      let wallNow = 1_700_000_000_000
      let perfNow = 1_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => wallNow)
      const perfNowSpy = vi.spyOn(performance, 'now').mockImplementation(() => perfNow)

      try {
        const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
        getSignedUrlSpy.mockClear()
        getSignedUrlSpy.mockResolvedValueOnce('http://presigned-url-1')
        getSignedUrlSpy.mockResolvedValueOnce('http://presigned-url-2')

        const url1 = await s3.presign('bucket', 'sleep-key', 'GET')
        expect(url1).toBe('http://presigned-url-1')

        // Simulate 15 hours of host sleep: wall clock jumps 15h while performance.now() barely moves
        wallNow += 15 * 3600 * 1000
        perfNow += 1_000

        const url2 = await s3.presign('bucket', 'sleep-key', 'GET')
        expect(url2).toBe('http://presigned-url-2')
        expect(getSignedUrlSpy).toHaveBeenCalledTimes(2)
      } finally {
        dateNowSpy.mockRestore()
        perfNowSpy.mockRestore()
      }
    })

    it('signs with an explicit lifetime and caches it separately from the default', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      getSignedUrlSpy.mockClear()
      getSignedUrlSpy.mockResolvedValueOnce('http://default-url')
      getSignedUrlSpy.mockResolvedValueOnce('http://short-url')

      const defaultUrl = await s3.presign('bucket', 'expiry-key', 'GET')
      const shortUrl = await s3.presign(
        'bucket',
        'expiry-key',
        'GET',
        false,
        undefined,
        false,
        3600,
      )
      const shortAgain = await s3.presign(
        'bucket',
        'expiry-key',
        'GET',
        false,
        undefined,
        false,
        3600,
      )

      expect(defaultUrl).toBe('http://default-url')
      expect(shortUrl).toBe('http://short-url')
      expect(shortAgain).toBe('http://short-url')
      expect(getSignedUrlSpy).toHaveBeenCalledTimes(2)
      expect(getSignedUrlSpy).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        expect.objectContaining({ expiresIn: 3600 }),
      )
    })

    it('should NOT cache PUT presign URLs', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      getSignedUrlSpy.mockResolvedValueOnce('http://unique-put-url-1')
      getSignedUrlSpy.mockResolvedValueOnce('http://unique-put-url-2')

      const url1 = await s3.presign('bucket', 'key', 'PUT')
      const url2 = await s3.presign('bucket', 'key', 'PUT')

      expect(url1).toBe('http://unique-put-url-1')
      expect(url2).toBe('http://unique-put-url-2')
      expect(getSignedUrlSpy).toHaveBeenCalledTimes(2)
    })

    it('should respect PRESIGNED_URL_EXPIRES_IN env for GET', async () => {
      process.env.PRESIGNED_URL_EXPIRES_IN = '10'
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      await s3.presign('bucket', 'key', 'GET')

      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        expect.objectContaining({ expiresIn: 10 * 3600 }),
      )

      delete process.env.PRESIGNED_URL_EXPIRES_IN
      delete process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN
    })

    it('should default PUT presign and multipart to 12 hours (43200 seconds)', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      await s3.presign('bucket', 'key', 'PUT')
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 12 * 3600 }),
      )

      getSignedUrlSpy.mockClear()
      await s3.presignMultipart('bucket', 'key', {
        method: 'PUT',
        key: 'key',
        fileId: 'file-1',
        uploadId: 'up-1',
        partNumber: 1,
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(UploadPartCommand),
        expect.objectContaining({ expiresIn: 12 * 3600 }),
      )
    })

    it('should respect PRESIGNED_UPLOAD_URL_EXPIRES_IN env for PUT and multipart', async () => {
      process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN = '24'
      process.env.PRESIGNED_URL_EXPIRES_IN = '5'
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      await s3.presign('bucket', 'key', 'PUT')
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 24 * 3600 }),
      )

      getSignedUrlSpy.mockClear()
      await s3.presignMultipart('bucket', 'key', {
        method: 'PUT',
        key: 'key',
        fileId: 'file-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 24 * 3600 }),
      )

      delete process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN
      delete process.env.PRESIGNED_URL_EXPIRES_IN
    })

    it('should allow PRESIGNED_URL_EXPIRES_IN to override PUT if PRESIGNED_UPLOAD_URL_EXPIRES_IN is unset', async () => {
      process.env.PRESIGNED_URL_EXPIRES_IN = '8'
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      await s3.presign('bucket', 'key', 'PUT')
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 8 * 3600 }),
      )

      delete process.env.PRESIGNED_URL_EXPIRES_IN
    })

    it('should support float values for PRESIGNED_URL_EXPIRES_IN and PRESIGNED_UPLOAD_URL_EXPIRES_IN', async () => {
      process.env.PRESIGNED_URL_EXPIRES_IN = '0.1'
      process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN = '1.5'
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      await s3.presign('bucket', 'key', 'GET')
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        expect.objectContaining({ expiresIn: 360 }),
      )

      getSignedUrlSpy.mockClear()
      await s3.presign('bucket', 'key', 'PUT')
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 5400 }),
      )

      getSignedUrlSpy.mockClear()
      await s3.presignMultipart('bucket', 'key', {
        method: 'PUT',
        key: 'key',
        fileId: 'file-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.objectContaining({ expiresIn: 5400 }),
      )

      delete process.env.PRESIGNED_URL_EXPIRES_IN
      delete process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN
    })

    it('should not set contentDisposition for normal GET presign', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      await s3.presign('bucket', 'key', 'GET')

      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.not.objectContaining({
            ResponseContentDisposition: expect.anything(),
          }),
        }),
        expect.anything(),
      )
    })

    it('should set contentDisposition attachment when download is true', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      await s3.presign('bucket', 'key', 'GET', true)

      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            ResponseContentDisposition: 'attachment',
          }),
        }),
        expect.anything(),
      )
    })

    it('should set contentDisposition with the filename when download filename is provided', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      await s3.presign('bucket', 'key', 'GET', true, 'foo.png')

      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            ResponseContentDisposition:
              'attachment; filename="foo.png"; filename*=UTF-8\'\'foo.png',
          }),
        }),
        expect.anything(),
      )
    })

    it('should include an RFC 5987 filename* for non-ASCII filenames', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      await s3.presign('bucket', 'key', 'GET', true, '报告.png')

      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            ResponseContentDisposition: "attachment; filename*=UTF-8''%E6%8A%A5%E5%91%8A.png",
          }),
        }),
        expect.anything(),
      )
    })

    it('should not cache download presign URLs', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      getSignedUrlSpy.mockClear()
      getSignedUrlSpy.mockResolvedValueOnce('http://download-url-1')
      getSignedUrlSpy.mockResolvedValueOnce('http://download-url-2')

      const url1 = await s3.presign('bucket', 'key', 'GET', true)
      const url2 = await s3.presign('bucket', 'key', 'GET', true)

      expect(url1).toBe('http://download-url-1')
      expect(url2).toBe('http://download-url-2')
      expect(getSignedUrlSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle ReadableStream in putObject', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      s3SendSpy.mockClear()

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('stream content'))
          controller.close()
        },
      })

      await s3.putObject('test-bucket', 'file.txt', stream, 14, 'text/plain')

      expect(s3SendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'file.txt',
            ContentType: 'text/plain',
            ContentLength: 14,
          }),
        }),
      )
    })

    it('should handle ArrayBuffer in putObject', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      s3SendSpy.mockClear()

      const arrayBuffer = new TextEncoder().encode('array buffer content').buffer

      await s3.putObject('test-bucket', 'file.txt', arrayBuffer, 20, 'text/plain')

      expect(s3SendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'file.txt',
            ContentType: 'text/plain',
            ContentLength: 20,
          }),
        }),
      )
    })

    it('should presign multipart operations correctly', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')

      // PUT part
      await s3.presignMultipart('bucket', 'key', {
        method: 'PUT',
        key: 'key',
        fileId: 'file-1',
        uploadId: 'up-1',
        partNumber: 1,
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(UploadPartCommand),
        expect.anything(),
      )

      // PUT single
      await s3.presignMultipart('bucket', 'key', {
        method: 'PUT',
        key: 'key',
        fileId: 'file-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(PutObjectCommand),
        expect.anything(),
      )

      // POST create multipart
      await s3.presignMultipart('bucket', 'key', {
        method: 'POST',
        key: 'key',
        fileId: 'file-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(CreateMultipartUploadCommand),
        expect.anything(),
      )

      // POST complete multipart
      await s3.presignMultipart('bucket', 'key', {
        method: 'POST',
        key: 'key',
        fileId: 'file-1',
        uploadId: 'up-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(CompleteMultipartUploadCommand),
        expect.anything(),
      )

      // GET list parts
      await s3.presignMultipart('bucket', 'key', {
        method: 'GET',
        key: 'key',
        fileId: 'file-1',
        uploadId: 'up-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(ListPartsCommand),
        expect.anything(),
      )

      // DELETE abort multipart
      await s3.presignMultipart('bucket', 'key', {
        method: 'DELETE',
        key: 'key',
        fileId: 'file-1',
        uploadId: 'up-1',
      })
      expect(getSignedUrlSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(AbortMultipartUploadCommand),
        expect.anything(),
      )

      // Expect GET without uploadId to throw
      await expect(
        s3.presignMultipart('bucket', 'key', {
          method: 'GET',
          key: 'key',
          fileId: 'file-1',
        }),
      ).rejects.toThrow('List parts requires uploadId')

      // Expect DELETE without uploadId to throw
      await expect(
        s3.presignMultipart('bucket', 'key', {
          method: 'DELETE',
          key: 'key',
          fileId: 'file-1',
        }),
      ).rejects.toThrow('Abort multipart upload requires uploadId')
    })

    it('should resolveInput using presign GET in S3StorageService', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      const presignSpy = vi.spyOn(s3, 'presign').mockResolvedValue('https://presigned.s3.url')

      const input = await s3.resolveInput('test-bucket', 'video.mp4')
      expect(input).toBe('https://presigned.s3.url')
      expect(presignSpy).toHaveBeenCalledWith(
        'test-bucket',
        'video.mp4',
        'GET',
        false,
        undefined,
        true,
      )
    })

    it('should support separate publicEndpoint for presigning while resolveInput uses internal client', async () => {
      const s3 = new S3StorageService(
        'http://internal-s3:9000',
        'key',
        'secret',
        'test-bucket',
        'us-east-1',
        'https://public.example.com',
      )

      getSignedUrlSpy.mockClear()
      await s3.presign('test-bucket', 'asset.mp4', 'GET')
      const presignClientCall = getSignedUrlSpy.mock.calls[0][0]

      getSignedUrlSpy.mockClear()
      await s3.resolveInput('test-bucket', 'asset.mp4')
      const resolveClientCall = getSignedUrlSpy.mock.calls[0][0]

      expect(presignClientCall).not.toBe(resolveClientCall)
    })

    it('should stream in uploadFileToKey', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      s3SendSpy.mockClear()

      const tmpFile = path.join(process.cwd(), 'data-test-stream.txt')
      fs.writeFileSync(tmpFile, 'streaming content from file')

      try {
        await s3.uploadFileToKey(tmpFile, 'test/key.txt', 'text/plain')

        expect(s3SendSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              Bucket: 'test-bucket',
              Key: 'test/key.txt',
              ContentType: 'text/plain',
              ContentLength: 27,
              Body: expect.any(fs.ReadStream),
            }),
          }),
        )

        // Wait for stream to open and close before unlinking
        const callArg = s3SendSpy.mock.calls[0]?.[0]
        const stream = callArg?.input?.Body as fs.ReadStream | undefined
        if (stream) {
          if (!stream.destroyed) {
            await new Promise((resolve) => {
              if (stream.pending) {
                stream.once('open', resolve)
              } else {
                resolve(null)
              }
            })
            stream.destroy()
            await new Promise((resolve) => {
              stream.once('close', resolve)
            })
          }
        }
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile)
        }
      }
    })

    it('should abort multipart upload in S3', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      s3SendSpy.mockClear()

      await s3.abortMultipartUpload('test-bucket', 'file.txt', 'upload-123')

      expect(s3SendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'file.txt',
            UploadId: 'upload-123',
          }),
        }),
      )
    })

    it('should stream in downloadToFile without buffering or calling transformToByteArray', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      s3SendSpy.mockClear()

      async function* chunkedBody() {
        yield new Uint8Array([1, 2])
        yield new Uint8Array([3, 4])
      }

      const transformSpy = vi.fn()
      const mockBody = Object.assign(chunkedBody(), {
        transformToByteArray: transformSpy,
      })

      s3SendSpy.mockResolvedValueOnce({ Body: mockBody })

      const tmpDir = path.join(process.cwd(), 'data-test-download', 'subdir')
      const targetPath = path.join(tmpDir, 'downloaded.bin')

      try {
        await s3.downloadToFile('test-bucket', 'file.bin', targetPath)

        expect(transformSpy).not.toHaveBeenCalled()
        const written = await fs.promises.readFile(targetPath)
        expect(Array.from(written)).toEqual([1, 2, 3, 4])
      } finally {
        if (fs.existsSync(path.join(process.cwd(), 'data-test-download'))) {
          fs.rmSync(path.join(process.cwd(), 'data-test-download'), {
            recursive: true,
            force: true,
          })
        }
      }
    })

    it('should clean up partial file if downloadToFile fails midway', async () => {
      const s3 = new S3StorageService('http://localhost:9000', 'key', 'secret', 'test-bucket')
      s3SendSpy.mockClear()

      async function* failingBody() {
        yield new Uint8Array([1, 2])
        throw new Error('Network interruption')
      }

      s3SendSpy.mockResolvedValueOnce({ Body: failingBody() })

      const tmpDir = path.join(process.cwd(), 'data-test-download', 'fail')
      const targetPath = path.join(tmpDir, 'downloaded.bin')

      try {
        await expect(s3.downloadToFile('test-bucket', 'file.bin', targetPath)).rejects.toThrow(
          'Network interruption',
        )

        expect(fs.existsSync(targetPath)).toBe(false)
      } finally {
        if (fs.existsSync(path.join(process.cwd(), 'data-test-download'))) {
          fs.rmSync(path.join(process.cwd(), 'data-test-download'), {
            recursive: true,
            force: true,
          })
        }
      }
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

    it('removes empty embedding chunk directories after deleting the last chunk', async () => {
      const key = 'files/asset-1/tmp-embedding-chunks/chunk.mp4'
      await localS3.putObject('test-bucket', key, 'chunk', 5)

      expect(await localS3.deleteObject('test-bucket', key)).toBe(1)

      expect(fs.existsSync(path.join(TEST_BASE_PATH, 'test-bucket', 'files', 'asset-1'))).toBe(
        false,
      )
      expect(fs.existsSync(path.join(TEST_BASE_PATH, 'test-bucket', 'files'))).toBe(true)
    })

    it('should write Node.js Readable stream in putObject without corrupting to [object Object]', async () => {
      const { Readable } = await import('stream')
      const stream = Readable.from(['hello ', 'node ', 'stream'])

      await localS3.putObject('test-bucket', 'stream.txt', stream, 17)

      const content = await fs.promises.readFile(
        path.join(TEST_BASE_PATH, 'test-bucket', 'stream.txt'),
        'utf8',
      )
      expect(content).toBe('hello node stream')
    })

    it('should write Web ReadableStream in putObject', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('web stream content'))
          controller.close()
        },
      })

      await localS3.putObject('test-bucket', 'web-stream.txt', stream, 18)

      const content = await fs.promises.readFile(
        path.join(TEST_BASE_PATH, 'test-bucket', 'web-stream.txt'),
        'utf8',
      )
      expect(content).toBe('web stream content')
    })

    it('should downloadToFile creating destination directory recursively if it does not exist', async () => {
      await localS3.putObject('test-bucket', 'source.txt', 'hello download', 14)
      const nestedDest = path.join(TEST_BASE_PATH, 'downloads', 'deep', 'nested', 'target.txt')

      await localS3.downloadToFile('test-bucket', 'source.txt', nestedDest)

      const content = await fs.promises.readFile(nestedDest, 'utf8')
      expect(content).toBe('hello download')
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

    it('lists a nested prefix without scanning unrelated directories', async () => {
      await localS3.putObject('test-bucket', 'temp/generated/one.jpg', 'one', 3)
      await localS3.putObject('test-bucket', 'files/unrelated.txt', 'abc', 3)
      const readDirectory = vi.spyOn(fs.promises, 'readdir')
      try {
        await expect(localS3.listObjects('test-bucket', 'temp/generated/')).resolves.toEqual([
          'temp/generated/one.jpg',
        ])
        expect(readDirectory.mock.calls.map(([directory]) => directory)).toEqual([
          path.join(TEST_BASE_PATH, 'test-bucket', 'temp', 'generated'),
        ])
        readDirectory.mockClear()
        await expect(localS3.listObjects('test-bucket', 'temp/missing/')).resolves.toEqual([])
        expect(readDirectory.mock.calls.map(([directory]) => directory)).not.toContain(
          path.join(TEST_BASE_PATH, 'test-bucket'),
        )
        await expect(localS3.listObjects('test-bucket', 'temp/generated/on')).resolves.toEqual([
          'temp/generated/one.jpg',
        ])
      } finally {
        readDirectory.mockRestore()
      }
    })

    it('continues listing when a file disappears during a local prefix scan', async () => {
      const removedKey = 'temp/generated/removed.jpg'
      const remainingKey = 'temp/generated/remaining.jpg'
      await localS3.putObject('test-bucket', removedKey, 'old', 3)
      await localS3.putObject('test-bucket', remainingKey, 'new', 3)
      const stat = fs.promises.stat
      const removedPath = path.join(TEST_BASE_PATH, 'test-bucket', removedKey)
      const statSpy = vi.spyOn(fs.promises, 'stat').mockImplementation(async (target, options) => {
        if (target === removedPath) await fs.promises.unlink(removedPath)
        return stat(target, options)
      })
      try {
        await expect(localS3.listObjects('test-bucket', 'temp/generated/')).resolves.toEqual([
          remainingKey,
        ])
      } finally {
        statSpy.mockRestore()
      }
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
      expect(url).toContain('http://localhost:3000/files/my-bucket/dir/file.txt?')
      expect(url).toContain('Signature=')
      expect(url).toContain('Expires=')
    })

    it('should generate a local presign URL with download param', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true)
      expect(url).toContain('http://localhost:3000/files/my-bucket/dir/file.txt?')
      expect(url).toContain('Signature=')
      expect(url).toContain('Expires=')
      expect(url).toContain('download=1')
    })

    it('should include an encoded filename in the local download URL', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true, 'foo bar.png')
      expect(url).toContain('http://localhost:3000/files/my-bucket/dir/file.txt?')
      expect(url).toContain('Signature=')
      expect(url).toContain('Expires=')
      expect(url).toContain('download=1&filename=foo%20bar.png')
    })

    it('should not append a filename param when none is provided', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true)
      expect(url).not.toContain('filename=')
    })

    it('should cache GET presigned URLs using LRU cache', async () => {
      const url1 = await localS3.presign('my-bucket', 'dir/file.txt', 'GET')
      const url2 = await localS3.presign('my-bucket', 'dir/file.txt', 'GET')
      expect(url1).toBe(url2)

      const urlOther = await localS3.presign('my-bucket', 'dir/other.txt', 'GET')
      expect(urlOther).not.toBe(url1)
    })

    it('should not return expired local GET presigned URLs after system sleep when wall clock advances but monotonic clock pauses', async () => {
      let wallNow = 1_700_000_000_000
      let perfNow = 1_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => wallNow)
      const perfNowSpy = vi.spyOn(performance, 'now').mockImplementation(() => perfNow)

      try {
        const url1 = await localS3.presign('my-bucket', 'dir/sleep.png', 'GET')
        const parsed1 = new URL(url1)
        expect(
          verifyLocalGetUrlSignature(
            'my-bucket',
            'dir/sleep.png',
            parsed1.searchParams.get('Signature'),
            parsed1.searchParams.get('Expires'),
          ),
        ).toBe(true)

        // Simulate 15 hours of host sleep: wall clock advances past the 12h expiry while performance.now() pauses
        wallNow += 15 * 3600 * 1000
        perfNow += 1_000

        const url2 = await localS3.presign('my-bucket', 'dir/sleep.png', 'GET')
        expect(url2).not.toBe(url1)

        const parsed2 = new URL(url2)
        expect(
          verifyLocalGetUrlSignature(
            'my-bucket',
            'dir/sleep.png',
            parsed2.searchParams.get('Signature'),
            parsed2.searchParams.get('Expires'),
          ),
        ).toBe(true)
      } finally {
        dateNowSpy.mockRestore()
        perfNowSpy.mockRestore()
      }
    })

    it('should not cache download URLs', async () => {
      const url1 = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true)
      const url2 = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true)
      // download URLs include download=1
      expect(url1).toContain('download=1')
      expect(url2).toContain('download=1')
    })

    it('should throw an error for unsupported presign methods', async () => {
      await expect(localS3.presign('b', 'k', 'POST')).rejects.toThrow()
    })

    it('should default local GET and PUT presign expiry to 12 hours', async () => {
      const fixedNow = 1_700_000_000_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
      try {
        const expectedExpires = String(Math.floor(fixedNow / 1000) + 12 * 3600)

        const getUrl = new URL(await localS3.presign('my-bucket', 'dir/default.txt', 'GET'))
        expect(getUrl.searchParams.get('Expires')).toBe(expectedExpires)

        const putUrl = new URL(await localS3.presign('my-bucket', 'dir/default.txt', 'PUT'))
        expect(putUrl.pathname).toBe('/api/upload/local')
        expect(putUrl.searchParams.get('Expires')).toBe(expectedExpires)
        expect(
          verifyLocalUrlSignature(
            'my-bucket',
            'dir/default.txt',
            putUrl.searchParams.get('Signature'),
            putUrl.searchParams.get('Expires'),
          ),
        ).toBe(true)
      } finally {
        dateNowSpy.mockRestore()
      }
    })

    it('should respect PRESIGNED_URL_EXPIRES_IN (including floats) for local GET and PUT fallback', async () => {
      const fixedNow = 1_700_000_000_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
      process.env.PRESIGNED_URL_EXPIRES_IN = '0.1'
      try {
        const expectedExpires = String(Math.floor(fixedNow / 1000) + 360)

        const getUrl = new URL(await localS3.presign('my-bucket', 'dir/float.txt', 'GET'))
        expect(getUrl.searchParams.get('Expires')).toBe(expectedExpires)

        const putUrl = new URL(await localS3.presign('my-bucket', 'dir/float.txt', 'PUT'))
        expect(putUrl.searchParams.get('Expires')).toBe(expectedExpires)
      } finally {
        dateNowSpy.mockRestore()
        delete process.env.PRESIGNED_URL_EXPIRES_IN
      }
    })

    it('should respect PRESIGNED_UPLOAD_URL_EXPIRES_IN (including floats) for local PUT and presignMultipart', async () => {
      const fixedNow = 1_700_000_000_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
      process.env.PRESIGNED_URL_EXPIRES_IN = '2'
      process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN = '1.5'
      try {
        const expectedGetExpires = String(Math.floor(fixedNow / 1000) + 2 * 3600)
        const expectedPutExpires = String(Math.floor(fixedNow / 1000) + 5400)

        const getUrl = new URL(await localS3.presign('my-bucket', 'dir/upload-env.txt', 'GET'))
        expect(getUrl.searchParams.get('Expires')).toBe(expectedGetExpires)

        const putUrl = new URL(await localS3.presign('my-bucket', 'dir/upload-env.txt', 'PUT'))
        expect(putUrl.searchParams.get('Expires')).toBe(expectedPutExpires)

        const { url: multipartUrlStr } = await localS3.presignMultipart(
          'my-bucket',
          'dir/upload-env.txt',
          {
            method: 'PUT',
            key: 'dir/upload-env.txt',
            fileId: 'file-1',
          },
        )
        const multipartUrl = new URL(multipartUrlStr)
        expect(multipartUrl.searchParams.get('Expires')).toBe(expectedPutExpires)
      } finally {
        dateNowSpy.mockRestore()
        delete process.env.PRESIGNED_URL_EXPIRES_IN
        delete process.env.PRESIGNED_UPLOAD_URL_EXPIRES_IN
      }
    })

    it('should respect explicit expiresInSeconds override for local GET and PUT', async () => {
      const fixedNow = 1_700_000_000_000
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
      try {
        const expectedExpires = String(Math.floor(fixedNow / 1000) + 600)

        const getUrl = new URL(
          await localS3.presign('my-bucket', 'dir/custom.txt', 'GET', false, undefined, false, 600),
        )
        expect(getUrl.searchParams.get('Expires')).toBe(expectedExpires)

        const putUrl = new URL(
          await localS3.presign('my-bucket', 'dir/custom.txt', 'PUT', false, undefined, false, 600),
        )
        expect(putUrl.searchParams.get('Expires')).toBe(expectedExpires)
      } finally {
        dateNowSpy.mockRestore()
      }
    })

    it('should resolveInput to local file path if file exists on disk', async () => {
      await localS3.putObject('my-bucket', 'video.mp4', 'dummy content', 13)
      const input = await localS3.resolveInput('my-bucket', 'video.mp4')
      expect(input).toBe(path.join(TEST_BASE_PATH, 'my-bucket', 'video.mp4'))
    })

    it('should resolveInput to presigned URL if file does not exist on disk', async () => {
      const input = await localS3.resolveInput('my-bucket', 'nonexistent.mp4')
      expect(input).toContain('http://localhost:3000/files/my-bucket/nonexistent.mp4?')
      expect(input).toContain('Signature=')
      expect(input).toContain('Expires=')
    })
  })

  describe('s3Service initialization', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should initialize LocalStorageService with default localhost and SHUMAI_SERVER_PORT when AWS_ENDPOINT_URL_S3 is not set', async () => {
      process.env.STORAGE_BACKEND = 'local'
      delete process.env.AWS_ENDPOINT_URL_S3
      process.env.SHUMAI_SERVER_PORT = '4567'

      vi.resetModules()
      const { s3Service } = await import('./s3')
      const url = await s3Service.presign('bucket', 'key', 'GET')
      expect(url).toContain('http://localhost:4567')
    })

    it('should initialize LocalStorageService with exact AWS_ENDPOINT_URL_S3 when it is set', async () => {
      process.env.STORAGE_BACKEND = 'local'
      process.env.AWS_ENDPOINT_URL_S3 = 'http://123.456.7.8:12345'
      process.env.SHUMAI_SERVER_PORT = '4567'

      vi.resetModules()
      const { s3Service } = await import('./s3')
      const url = await s3Service.presign('bucket', 'key', 'GET')
      expect(url).toContain('http://123.456.7.8:12345')
      expect(url).not.toContain('4567')
    })

    it('should initialize S3StorageService with AWS_PUBLIC_ENDPOINT_URL_S3 when set', async () => {
      process.env.STORAGE_BACKEND = 's3'
      process.env.AWS_ENDPOINT_URL_S3 = 'http://garage.shumai.svc.cluster.local:3900'
      process.env.AWS_PUBLIC_ENDPOINT_URL_S3 = 'http://localhost:3900'

      vi.resetModules()
      const { s3Service } = await import('./s3')
      expect(s3Service).toBeDefined()
    })
  })

  describe('buildContentDisposition', () => {
    it('returns plain attachment when no filename is provided', () => {
      expect(buildContentDisposition()).toBe('attachment')
      expect(buildContentDisposition('')).toBe('attachment')
      expect(buildContentDisposition(null)).toBe('attachment')
    })

    it('builds a disposition with quoted filename and RFC 5987 filename*', () => {
      expect(buildContentDisposition('foo.png')).toBe(
        'attachment; filename="foo.png"; filename*=UTF-8\'\'foo.png',
      )
    })

    it('strips control characters and quotes to prevent header injection', () => {
      expect(buildContentDisposition('a\r\nb"c\\d')).toBe(
        'attachment; filename="abcd"; filename*=UTF-8\'\'abcd',
      )
    })

    it('percent-encodes reserved RFC 5987 characters', () => {
      expect(buildContentDisposition("it's (final).png")).toBe(
        "attachment; filename=\"it's (final).png\"; filename*=UTF-8''it%27s%20%28final%29.png",
      )
    })

    it('percent-encodes the * character in filename*', () => {
      expect(buildContentDisposition('foo*bar.png')).toBe(
        'attachment; filename="foo*bar.png"; filename*=UTF-8\'\'foo%2Abar.png',
      )
    })

    it('omits the quoted filename fallback for non-ASCII names to keep the header ASCII', () => {
      expect(buildContentDisposition('幻境边界.pptx')).toBe(
        "attachment; filename*=UTF-8''%E5%B9%BB%E5%A2%83%E8%BE%B9%E7%95%8C.pptx",
      )
      // The whole header value must remain pure ASCII so Bun/Node Headers accept it
      expect(
        [...buildContentDisposition('幻境边界.pptx')].every((ch) => ch.charCodeAt(0) <= 0x7f),
      ).toBe(true)
    })
  })

  describe('signLocalGetUrl and verifyLocalGetUrlSignature', () => {
    it('signs and verifies valid local get url', () => {
      const { signature, expires } = signLocalGetUrl('my-bucket', 'files/123/file.mp4')
      expect(signature).toBeDefined()
      expect(expires).toBeGreaterThan(Math.floor(Date.now() / 1000))

      const isValid = verifyLocalGetUrlSignature(
        'my-bucket',
        'files/123/file.mp4',
        signature,
        String(expires),
      )
      expect(isValid).toBe(true)
    })

    it('rejects expired local get url signature', () => {
      // 10 seconds in the past
      const { signature, expires } = signLocalGetUrl('my-bucket', 'files/123/file.mp4', -10)
      const isValid = verifyLocalGetUrlSignature(
        'my-bucket',
        'files/123/file.mp4',
        signature,
        String(expires),
      )
      expect(isValid).toBe(false)
    })

    it('rejects tampered bucket or key', () => {
      const { signature, expires } = signLocalGetUrl('my-bucket', 'files/123/file.mp4')
      expect(
        verifyLocalGetUrlSignature(
          'other-bucket',
          'files/123/file.mp4',
          signature,
          String(expires),
        ),
      ).toBe(false)

      expect(
        verifyLocalGetUrlSignature('my-bucket', 'files/999/other.mp4', signature, String(expires)),
      ).toBe(false)
    })

    it('rejects tampered or malformed signature or expires', () => {
      expect(
        verifyLocalGetUrlSignature('my-bucket', 'files/123/file.mp4', 'badsig', '1234567890'),
      ).toBe(false)
      expect(
        verifyLocalGetUrlSignature('my-bucket', 'files/123/file.mp4', undefined, '1234567890'),
      ).toBe(false)
      expect(
        verifyLocalGetUrlSignature('my-bucket', 'files/123/file.mp4', 'badsig', undefined),
      ).toBe(false)
      expect(
        verifyLocalGetUrlSignature('my-bucket', 'files/123/file.mp4', 'badsig', 'not-a-number'),
      ).toBe(false)
    })
  })

  describe('getPresignedUrlExpirySeconds', () => {
    it('supports float hours and falls back to 12 hours for invalid values', () => {
      expect(getPresignedUrlExpirySeconds('GET')).toBe(12 * 3600)
      expect(getPresignedUrlExpirySeconds('PUT')).toBe(12 * 3600)

      process.env.PRESIGNED_URL_EXPIRES_IN = '0.1'
      expect(getPresignedUrlExpirySeconds('GET')).toBe(360)
      expect(getPresignedUrlExpirySeconds('PUT')).toBe(360)

      process.env.PRESIGNED_URL_EXPIRES_IN = '0.0001'
      expect(getPresignedUrlExpirySeconds('GET')).toBe(1)

      for (const invalid of ['0', '-1', 'abc', 'Infinity', 'NaN', '   ']) {
        process.env.PRESIGNED_URL_EXPIRES_IN = invalid
        expect(getPresignedUrlExpirySeconds('GET')).toBe(12 * 3600)
        expect(getPresignedUrlExpirySeconds('PUT')).toBe(12 * 3600)
      }

      expect(getPresignedUrlExpirySeconds('GET', 120)).toBe(120)
      expect(getPresignedUrlExpirySeconds('PUT', -10)).toBe(-10)
    })
  })

  describe('signLocalUrl and verifyLocalUrlSignature', () => {
    it('signs and verifies valid local PUT url', () => {
      const signed = signLocalUrl('my-bucket', 'files/123/file.mp4')
      const parsed = new URL(`http://localhost:3000${signed}`)
      const signature = parsed.searchParams.get('Signature')
      const expires = parsed.searchParams.get('Expires')

      expect(signature).toBeTruthy()
      expect(Number(expires)).toBeGreaterThan(Math.floor(Date.now() / 1000))
      expect(verifyLocalUrlSignature('my-bucket', 'files/123/file.mp4', signature, expires)).toBe(
        true,
      )
    })

    it('rejects expired local PUT url signature', () => {
      const signed = signLocalUrl('my-bucket', 'files/123/file.mp4', -10)
      const parsed = new URL(`http://localhost:3000${signed}`)
      expect(
        verifyLocalUrlSignature(
          'my-bucket',
          'files/123/file.mp4',
          parsed.searchParams.get('Signature'),
          parsed.searchParams.get('Expires'),
        ),
      ).toBe(false)
    })

    it('rejects tampered bucket, key, or malformed params', () => {
      const signed = signLocalUrl('my-bucket', 'files/123/file.mp4')
      const parsed = new URL(`http://localhost:3000${signed}`)
      const signature = parsed.searchParams.get('Signature')
      const expires = parsed.searchParams.get('Expires')

      expect(
        verifyLocalUrlSignature('other-bucket', 'files/123/file.mp4', signature, expires),
      ).toBe(false)
      expect(verifyLocalUrlSignature('my-bucket', 'files/999/other.mp4', signature, expires)).toBe(
        false,
      )
      expect(
        verifyLocalUrlSignature(
          'my-bucket',
          'files/123/file.mp4',
          signature,
          String(Number(expires) + 60),
        ),
      ).toBe(false)
      expect(verifyLocalUrlSignature('my-bucket', 'files/123/file.mp4', undefined, expires)).toBe(
        false,
      )
      expect(verifyLocalUrlSignature('my-bucket', 'files/123/file.mp4', signature, undefined)).toBe(
        false,
      )
      expect(
        verifyLocalUrlSignature('my-bucket', 'files/123/file.mp4', signature, `${expires}abc`),
      ).toBe(false)
    })

    it('rejects reusing a GET signature for PUT and vice versa', () => {
      const { signature: getSig, expires: getExp } = signLocalGetUrl(
        'my-bucket',
        'files/123/file.mp4',
      )
      expect(
        verifyLocalUrlSignature('my-bucket', 'files/123/file.mp4', getSig, String(getExp)),
      ).toBe(false)

      const signedPut = signLocalUrl('my-bucket', 'files/123/file.mp4')
      const parsedPut = new URL(`http://localhost:3000${signedPut}`)
      expect(
        verifyLocalGetUrlSignature(
          'my-bucket',
          'files/123/file.mp4',
          parsedPut.searchParams.get('Signature'),
          parsedPut.searchParams.get('Expires'),
        ),
      ).toBe(false)
    })
  })
})
