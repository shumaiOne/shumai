import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as crypto from 'crypto'
import * as os from 'os'
import { Readable } from 'stream'
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
  checkLocalUrl,
  localUrlLifetimeSeconds,
  maxLocalPartSize,
  LocalStorageService,
  S3StorageService,
  signLocalUrl,
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
        expect.objectContaining({ expiresIn: 18000 }),
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

    it('should respect PRESIGNED_URL_EXPIRES_IN env', async () => {
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
      expect(presignSpy).toHaveBeenCalledWith('test-bucket', 'video.mp4', 'GET')
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

    it('should generate a local presign URL with download param', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true)
      expect(url).toBe('http://localhost:3000/files/my-bucket/dir/file.txt?download=1')
    })

    it('should include an encoded filename in the local download URL', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true, 'foo bar.png')
      expect(url).toBe(
        'http://localhost:3000/files/my-bucket/dir/file.txt?download=1&filename=foo%20bar.png',
      )
    })

    it('should not append a filename param when none is provided', async () => {
      const url = await localS3.presign('my-bucket', 'dir/file.txt', 'GET', true)
      expect(url).not.toContain('filename=')
    })

    it('should throw an error for unsupported presign methods', async () => {
      await expect(localS3.presign('b', 'k', 'POST')).rejects.toThrow()
    })

    it('should resolveInput to local file path if file exists on disk', async () => {
      await localS3.putObject('my-bucket', 'video.mp4', 'dummy content', 13)
      const input = await localS3.resolveInput('my-bucket', 'video.mp4')
      expect(input).toBe(path.join(TEST_BASE_PATH, 'my-bucket', 'video.mp4'))
    })

    it('should resolveInput to presigned URL if file does not exist on disk', async () => {
      const input = await localS3.resolveInput('my-bucket', 'nonexistent.mp4')
      expect(input).toBe('http://localhost:3000/files/my-bucket/nonexistent.mp4')
    })
  })

  describe('LocalStorageService multipart', () => {
    let base: string
    let local: LocalStorageService
    const readFinal = (key: string) => fs.readFileSync(path.join(base, 'bkt', key))
    const partFiles = () => {
      const root = path.join(base, '.multipart')
      return fs.existsSync(root) ? fs.readdirSync(root, { recursive: true }) : []
    }

    beforeEach(() => {
      base = fs.mkdtempSync(path.join(os.tmpdir(), 'shumai-mp-'))
      local = new LocalStorageService('http://localhost:3000', base)
    })
    afterEach(() => {
      fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    })

    it('assembles parts uploaded out of order into the object in part order', async () => {
      const id = await local.createMultipartUpload('bkt', 'dir/file.bin')
      await local.uploadPart('bkt', 'dir/file.bin', id, 3, Buffer.from('CCC'))
      await local.uploadPart('bkt', 'dir/file.bin', id, 1, Buffer.from('AAAA'))
      const p2 = await local.uploadPart('bkt', 'dir/file.bin', id, 2, Buffer.from('BB'))
      expect(p2.size).toBe(2)

      const listed = await local.listParts('bkt', 'dir/file.bin', id)
      expect(listed.map((p) => p.partNumber)).toEqual([1, 2, 3])

      const done = await local.completeMultipartUpload(
        'bkt',
        'dir/file.bin',
        id,
        listed.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
      )
      expect(done.size).toBe(9)
      expect(readFinal('dir/file.bin').toString()).toBe('AAAABBCCC')
      expect(await local.getObjectSize('bkt', 'dir/file.bin')).toBe(9)
      // Only the small completion marker (for idempotent retries) outlives the parts.
      expect(partFiles().filter((f) => /part-|.tmp$|.lock$/.test(String(f)))).toEqual([])
    })

    it('accepts streamed part bodies and replaces a retried part', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      await local.uploadPart('bkt', 'k', id, 1, Buffer.from('old'))
      await local.uploadPart(
        'bkt',
        'k',
        id,
        1,
        Readable.from([Buffer.from('ne'), Buffer.from('w')]),
      )
      await local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }])
      expect(readFinal('k').toString()).toBe('new')
    })

    it('rejects completing with a missing part, wrong etag, or unordered parts', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      await local.uploadPart('bkt', 'k', id, 1, Buffer.from('a'))
      await local.uploadPart('bkt', 'k', id, 2, Buffer.from('b'))
      await expect(
        local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }, { partNumber: 3 }]),
      ).rejects.toThrow(/Part 3/)
      await expect(
        local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1, etag: '"nope"' }]),
      ).rejects.toThrow(/Part 1/)
      await expect(
        local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 2 }, { partNumber: 1 }]),
      ).rejects.toThrow(/ascending/)
      await expect(local.completeMultipartUpload('bkt', 'k', id, [])).rejects.toThrow()
      expect(fs.existsSync(path.join(base, 'bkt', 'k'))).toBe(false)
    })

    it('abort removes only the staged parts and never the final object', async () => {
      await local.putObject('bkt', 'k', Buffer.from('existing object'), 15)
      const id = await local.createMultipartUpload('bkt', 'k')
      await local.uploadPart('bkt', 'k', id, 1, Buffer.from('a'))
      expect(partFiles().length).toBeGreaterThan(0)
      await local.abortMultipartUpload('bkt', 'k', id)
      expect(partFiles()).toEqual([])
      await expect(local.listParts('bkt', 'k', id)).rejects.toThrow(/does not exist/)
      expect(readFinal('k').toString()).toBe('existing object')
    })

    it('rejects a part larger than the cap, for buffers and streams, leaving nothing behind', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      await expect(
        local.uploadPart('bkt', 'k', id, 1, Buffer.from('0123456789'), 5),
      ).rejects.toMatchObject({ code: 'EntityTooLarge' })
      await expect(
        local.uploadPart(
          'bkt',
          'k',
          id,
          2,
          Readable.from([Buffer.from('012'), Buffer.from('345')]),
          5,
        ),
      ).rejects.toMatchObject({ code: 'EntityTooLarge' })
      expect(await local.listParts('bkt', 'k', id)).toEqual([])
      const entries = fs.readdirSync(path.join(base, '.multipart'), { recursive: true })
      expect(entries.filter((e) => String(e).endsWith('.tmp'))).toEqual([])
      const ok = await local.uploadPart('bkt', 'k', id, 3, Buffer.from('12345'), 5)
      expect(ok.size).toBe(5)
    })

    it('caps parts at the lower of 5 GiB and MAX_REQUEST_BODY_SIZE', () => {
      const saved = process.env.MAX_REQUEST_BODY_SIZE
      try {
        delete process.env.MAX_REQUEST_BODY_SIZE
        expect(maxLocalPartSize()).toBe(5 * 1024 ** 3)
        process.env.MAX_REQUEST_BODY_SIZE = '1000'
        expect(maxLocalPartSize()).toBe(1000)
        process.env.MAX_REQUEST_BODY_SIZE = String(20 * 1024 ** 3)
        expect(maxLocalPartSize()).toBe(5 * 1024 ** 3)
      } finally {
        if (saved === undefined) delete process.env.MAX_REQUEST_BODY_SIZE
        else process.env.MAX_REQUEST_BODY_SIZE = saved
      }
    })

    it('completes idempotently: a retried or concurrent complete returns the same result', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      await local.uploadPart('bkt', 'k', id, 1, Buffer.from('hello '))
      await local.uploadPart('bkt', 'k', id, 2, Buffer.from('world'))
      const parts = [{ partNumber: 1 }, { partNumber: 2 }]
      const [a, b] = await Promise.all([
        local.completeMultipartUpload('bkt', 'k', id, parts),
        local.completeMultipartUpload('bkt', 'k', id, parts),
      ])
      expect(b).toEqual(a)
      expect(a.etag).toMatch(/^"[0-9a-f]{32}-2"$/)
      const retry = await local.completeMultipartUpload('bkt', 'k', id, parts)
      expect(retry).toEqual(a)
      expect(readFinal('k').toString()).toBe('hello world')
    })

    it('does not treat a retried complete as success when the object changed or parts differ', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      await local.uploadPart('bkt', 'k', id, 1, Buffer.from('abc'))
      await local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }])
      await expect(
        local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }, { partNumber: 2 }]),
      ).rejects.toMatchObject({ code: 'NoSuchUpload' })
      await local.putObject('bkt', 'k', Buffer.from('replaced with other size'), 24)
      await expect(
        local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }]),
      ).rejects.toMatchObject({ code: 'NoSuchUpload' })
    })

    it('fails a complete that cannot get the lock in time, and steals a stale lock', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      await local.uploadPart('bkt', 'k', id, 1, Buffer.from('abc'))
      const scope = fs.readdirSync(path.join(base, '.multipart'))[0]
      const lock = path.join(base, '.multipart', scope, `${id}.lock`)
      fs.writeFileSync(lock, '')
      await expect(
        local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }], 120),
      ).rejects.toMatchObject({ code: 'OperationAborted' })
      const old = new Date(Date.now() - 2 * 3600 * 1000)
      fs.utimesSync(lock, old, old)
      const done = await local.completeMultipartUpload('bkt', 'k', id, [{ partNumber: 1 }])
      expect(done.size).toBe(3)
    })

    it('sweeps only stale staged uploads and leaves final objects alone', async () => {
      await local.putObject('bkt', 'final.bin', Buffer.from('keep me'), 7)
      const staleId = await local.createMultipartUpload('bkt', 'stale.bin')
      await local.uploadPart('bkt', 'stale.bin', staleId, 1, Buffer.from('x'))
      const freshId = await local.createMultipartUpload('bkt', 'fresh.bin')
      await local.uploadPart('bkt', 'fresh.bin', freshId, 1, Buffer.from('y'))
      const old = new Date(Date.now() - 48 * 3600 * 1000)
      const staleDir = fs
        .readdirSync(path.join(base, '.multipart'), { recursive: true })
        .map(String)
        .find((e) => e.endsWith(staleId))!
      const staleAbs = path.join(base, '.multipart', staleDir)
      for (const f of fs.readdirSync(staleAbs)) fs.utimesSync(path.join(staleAbs, f), old, old)
      fs.utimesSync(staleAbs, old, old)

      expect(await local.sweepStaleMultipartUploads()).toBe(1)
      await expect(local.listParts('bkt', 'stale.bin', staleId)).rejects.toThrow(/does not exist/)
      expect((await local.listParts('bkt', 'fresh.bin', freshId)).length).toBe(1)
      expect(readFinal('final.bin').toString()).toBe('keep me')
      expect(await local.sweepStaleMultipartUploads()).toBe(0)
    })

    it('rejects a key that escapes into a sibling directory sharing the base path prefix', async () => {
      const sibling = `../${path.basename(base)}-evil`
      await expect(local.putObject(sibling, 'k', Buffer.from('x'), 1)).rejects.toThrow(/traversal/)
      expect(fs.existsSync(`${base}-evil`)).toBe(false)
    })

    it('rejects invalid part numbers', async () => {
      const id = await local.createMultipartUpload('bkt', 'k')
      for (const bad of [0, -1, 1.5, 10001, Number.NaN]) {
        await expect(local.uploadPart('bkt', 'k', id, bad, Buffer.from('x'))).rejects.toThrow(
          /Part number/,
        )
        await expect(
          local.presignMultipart('bkt', 'k', {
            key: 'k',
            method: 'PUT',
            uploadId: id,
            partNumber: bad,
            fileId: 'f',
          }),
        ).rejects.toThrow(/Part number/)
      }
    })

    it('rejects path traversal in upload ids and keys', async () => {
      await expect(local.uploadPart('bkt', 'k', '../evil', 1, Buffer.from('x'))).rejects.toThrow(
        /Invalid upload id/,
      )
      await expect(local.listParts('bkt', 'k', '..\\evil')).rejects.toThrow(/Invalid upload id/)
      await expect(local.createMultipartUpload('bkt', '../../escape')).rejects.toThrow(/traversal/)
      const id = await local.createMultipartUpload('bkt', 'k')
      await expect(
        local.completeMultipartUpload('bkt', '../../escape', id, [{ partNumber: 1 }]),
      ).rejects.toThrow(/traversal/)
      expect(fs.existsSync(path.join(base, '..', 'escape'))).toBe(false)
    })

    it('does not let an upload id be used against a different key', async () => {
      const id = await local.createMultipartUpload('bkt', 'a')
      await expect(local.uploadPart('bkt', 'b', id, 1, Buffer.from('x'))).rejects.toThrow(
        /does not exist/,
      )
    })

    it('presigns a distinct, operation-bound URL per part', async () => {
      const req = { key: 'k', uploadId: 'up1', fileId: 'f' }
      const url = async (method: 'PUT' | 'POST' | 'GET' | 'DELETE', partNumber?: number) =>
        (await local.presignMultipart('bkt', 'k', { ...req, method, partNumber })).url
      const p1 = await url('PUT', 1)
      const p2 = await url('PUT', 2)
      expect(p1).not.toBe(p2)
      expect(p1).toContain('uploadId=up1')
      expect(p1).toContain('partNumber=1')
      const sigs = new Set([p1, p2, await url('POST'), await url('GET'), await url('DELETE')])
      expect(sigs.size).toBe(5)
      // Creating an upload needs no id; other operations do.
      const create = await local.presignMultipart('bkt', 'k', {
        key: 'k',
        method: 'POST',
        fileId: 'f',
      })
      expect(create.url).not.toContain('uploadId')
      await expect(
        local.presignMultipart('bkt', 'k', { key: 'k', method: 'DELETE', fileId: 'f' }),
      ).rejects.toThrow(/upload id/)
    })

    const paramsOf = (u: string) => {
      const q = new URL(u, 'http://x').searchParams
      return { sig: q.get('Signature')!, exp: Number(q.get('exp')) }
    }

    it('binds part URL signatures to method, upload id and part number', () => {
      const mp = { method: 'PUT', uploadId: 'up1', partNumber: 1 }
      const { sig, exp } = paramsOf(signLocalUrl('bkt', 'k', mp))
      const verify = (m?: typeof mp, e: number | undefined = exp, s = sig) =>
        verifyLocalUrlSignature('bkt', 'k', s, m, e)
      expect(verify(mp)).toBe(true)
      expect(verify({ ...mp, partNumber: 2 })).toBe(false)
      expect(verify({ ...mp, method: 'DELETE' })).toBe(false)
      expect(verify({ ...mp, uploadId: 'up2' })).toBe(false)
      // A whole-object URL signature cannot be replayed as a part upload, nor the reverse.
      expect(verify(undefined)).toBe(false)
      const whole = paramsOf(signLocalUrl('bkt', 'k'))
      expect(verifyLocalUrlSignature('bkt', 'k', whole.sig, mp, whole.exp)).toBe(false)
      expect(verifyLocalUrlSignature('bkt', 'k', whole.sig, undefined, whole.exp)).toBe(true)
    })

    it('expires signed URLs and signs the expiry', () => {
      const mp = { method: 'PUT', uploadId: 'up1', partNumber: 1 }
      const now = Date.now()
      const { sig, exp } = paramsOf(signLocalUrl('bkt', 'k', mp, 60, now))
      expect(exp).toBe(Math.floor(now / 1000) + 60)
      expect(checkLocalUrl('bkt', 'k', sig, mp, exp, now + 30_000)).toBe('ok')
      expect(checkLocalUrl('bkt', 'k', sig, mp, exp, now + 61_000)).toBe('expired')
      // Moving the expiry forward invalidates the signature rather than extending the URL.
      expect(checkLocalUrl('bkt', 'k', sig, mp, exp + 3600, now + 61_000)).toBe('invalid')
      // Multipart URLs without an expiry are never valid.
      expect(checkLocalUrl('bkt', 'k', sig, mp, undefined, now)).toBe('invalid')
    })

    it('uses PRESIGNED_URL_EXPIRES_IN hours as the default lifetime', () => {
      const saved = process.env.PRESIGNED_URL_EXPIRES_IN
      try {
        delete process.env.PRESIGNED_URL_EXPIRES_IN
        expect(localUrlLifetimeSeconds()).toBe(5 * 3600)
        process.env.PRESIGNED_URL_EXPIRES_IN = '2'
        expect(localUrlLifetimeSeconds()).toBe(2 * 3600)
      } finally {
        if (saved === undefined) delete process.env.PRESIGNED_URL_EXPIRES_IN
        else process.env.PRESIGNED_URL_EXPIRES_IN = saved
      }
    })

    it('does not let field boundaries shift between bucket and key', () => {
      const { sig, exp } = paramsOf(signLocalUrl('a', 'b/c'))
      expect(verifyLocalUrlSignature('a', 'b/c', sig, undefined, exp)).toBe(true)
      expect(verifyLocalUrlSignature('a/b', 'c', sig, undefined, exp)).toBe(false)
    })

    it('still accepts a legacy non-expiring whole-object PUT signature, but not for multipart', () => {
      const secret = process.env.BETTER_AUTH_SECRET || 'shumai-local-storage-secret'
      const legacy = crypto.createHmac('sha256', secret).update('bkt/k').digest('hex')
      expect(verifyLocalUrlSignature('bkt', 'k', legacy)).toBe(true)
      expect(verifyLocalUrlSignature('bkt', 'other', legacy)).toBe(false)
      expect(verifyLocalUrlSignature('bkt', 'k', legacy, { method: 'DELETE', uploadId: 'u' })).toBe(
        false,
      )
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
})
