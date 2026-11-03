import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  UploadPartCopyCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  RestoreObjectCommand,
} from '@aws-sdk/client-s3'
import {
  getArchiveStorageConfig,
  isArchiveStorageEnabled,
  isColdStorageRestoreError,
  LocalArchiveStorageService,
  parseRestoreHeaderStatus,
  resetArchiveStorageServiceForTests,
  S3ArchiveStorageService,
} from './archive-storage'
import { uploadStreamToS3Client } from './s3'

const s3ClientConstructorSpy = vi.fn()
const s3SendSpy = vi.fn()

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

function makeWebStream(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
      }
      controller.close()
    },
  })
}

async function readAllBytes(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) parts.push(value)
  }
  return Buffer.concat(parts)
}

describe('Archive Storage', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
    resetArchiveStorageServiceForTests()
    delete process.env.ARCHIVE_STORAGE_BACKEND
    delete process.env.ARCHIVE_LOCAL_ROOT
    delete process.env.ARCHIVE_S3_BUCKET
    delete process.env.ARCHIVE_AWS_ENDPOINT_URL_S3
    delete process.env.ARCHIVE_S3_REGION
    delete process.env.ARCHIVE_S3_ACCESS_KEY_ID
    delete process.env.ARCHIVE_S3_SECRET_ACCESS_KEY
    delete process.env.ARCHIVE_S3_FORCE_PATH_STYLE
    delete process.env.ARCHIVE_S3_STORAGE_CLASS
    delete process.env.ARCHIVE_S3_USE_RESTORE_OBJECT
    delete process.env.ARCHIVE_S3_RESTORE_DAYS
    delete process.env.ARCHIVE_S3_RESTORE_TIER
  })

  afterEach(() => {
    process.env = originalEnv
    resetArchiveStorageServiceForTests()
  })

  describe('Environment configuration & validation', () => {
    it('is disabled when ARCHIVE_STORAGE_BACKEND is unset or empty', () => {
      expect(isArchiveStorageEnabled()).toBe(false)
      expect(getArchiveStorageConfig()).toEqual({ enabled: false })

      process.env.ARCHIVE_STORAGE_BACKEND = '   '
      expect(isArchiveStorageEnabled()).toBe(false)
      expect(getArchiveStorageConfig()).toEqual({ enabled: false })
    })

    it('rejects unsupported ARCHIVE_STORAGE_BACKEND values', () => {
      process.env.ARCHIVE_STORAGE_BACKEND = 'ftp'
      expect(() => getArchiveStorageConfig()).toThrow(/Invalid ARCHIVE_STORAGE_BACKEND/)
    })

    it('requires ARCHIVE_LOCAL_ROOT for local archive backend and rejects overlap with main local storage', () => {
      process.env.STORAGE_BACKEND = 'local'
      process.env.S3_BUCKET = 'shumai'
      process.env.ARCHIVE_STORAGE_BACKEND = 'local'

      expect(() => getArchiveStorageConfig()).toThrow(/ARCHIVE_LOCAL_ROOT is required/)

      process.env.ARCHIVE_LOCAL_ROOT = 'data/shumai'
      expect(() => getArchiveStorageConfig()).toThrow(/must not overlap/)

      process.env.ARCHIVE_LOCAL_ROOT = 'data/shumai/subdir'
      expect(() => getArchiveStorageConfig()).toThrow(/must not overlap/)

      process.env.ARCHIVE_LOCAL_ROOT = 'data'
      expect(() => getArchiveStorageConfig()).toThrow(/must not overlap/)

      process.env.ARCHIVE_LOCAL_ROOT = 'data-archive'
      const cfg = getArchiveStorageConfig()
      expect(cfg).toEqual({
        enabled: true,
        backend: 'local',
        localRoot: path.resolve('data-archive'),
        isSameS3Target: false,
      })
    })

    it('never falls back to main S3_* environment variables when ARCHIVE_STORAGE_BACKEND is s3', () => {
      process.env.STORAGE_BACKEND = 's3'
      process.env.S3_BUCKET = 'main-bucket'
      process.env.S3_ACCESS_KEY_ID = 'main-key'
      process.env.S3_SECRET_ACCESS_KEY = 'main-secret'
      process.env.AWS_ENDPOINT_URL_S3 = 'http://main-s3:9000'

      process.env.ARCHIVE_STORAGE_BACKEND = 's3'
      expect(() => getArchiveStorageConfig()).toThrow(/ARCHIVE_S3_BUCKET is required/)

      process.env.ARCHIVE_S3_BUCKET = 'archive-bucket'
      expect(() => getArchiveStorageConfig()).toThrow(/ARCHIVE_S3_ACCESS_KEY_ID is required/)

      process.env.ARCHIVE_S3_ACCESS_KEY_ID = 'archive-key'
      expect(() => getArchiveStorageConfig()).toThrow(/ARCHIVE_S3_SECRET_ACCESS_KEY is required/)

      process.env.ARCHIVE_S3_SECRET_ACCESS_KEY = 'archive-secret'
      const cfg = getArchiveStorageConfig()
      expect(cfg).toMatchObject({
        enabled: true,
        backend: 's3',
        bucket: 'archive-bucket',
        endpoint: undefined,
        accessKeyId: 'archive-key',
        secretAccessKey: 'archive-secret',
        isSameS3Target: false,
      })
    })

    it('detects same-bucket S3 configuration and requires a non-STANDARD ARCHIVE_S3_STORAGE_CLASS', () => {
      process.env.STORAGE_BACKEND = 's3'
      process.env.S3_BUCKET = 'shared-bucket'
      process.env.AWS_ENDPOINT_URL_S3 = 'https://s3.example.com/'

      process.env.ARCHIVE_STORAGE_BACKEND = 's3'
      process.env.ARCHIVE_S3_BUCKET = 'shared-bucket'
      process.env.ARCHIVE_AWS_ENDPOINT_URL_S3 = 'https://s3.example.com'
      process.env.ARCHIVE_S3_ACCESS_KEY_ID = 'ak'
      process.env.ARCHIVE_S3_SECRET_ACCESS_KEY = 'sk'

      expect(() => getArchiveStorageConfig()).toThrow(/ARCHIVE_S3_STORAGE_CLASS must be set/)

      process.env.ARCHIVE_S3_STORAGE_CLASS = 'standard'
      expect(() => getArchiveStorageConfig()).toThrow(/ARCHIVE_S3_STORAGE_CLASS must be set/)

      process.env.ARCHIVE_S3_STORAGE_CLASS = 'GLACIER_IR'
      const cfg = getArchiveStorageConfig()
      expect(cfg).toMatchObject({
        enabled: true,
        backend: 's3',
        bucket: 'shared-bucket',
        storageClass: 'GLACIER_IR',
        isSameS3Target: true,
      })
    })
  })

  describe('LocalArchiveStorageService', () => {
    const testRoot = path.join(process.cwd(), 'data-test-archive-local')

    beforeEach(() => {
      if (fs.existsSync(testRoot)) {
        fs.rmSync(testRoot, { recursive: true, force: true })
      }
    })

    afterEach(() => {
      if (fs.existsSync(testRoot)) {
        fs.rmSync(testRoot, { recursive: true, force: true })
      }
    })

    it('stores files directly under <ARCHIVE_LOCAL_ROOT>/<key> without a bucket subfolder and cleans up empty parent folders on delete', async () => {
      const localArchive = new LocalArchiveStorageService(testRoot)
      const key = 'files/01M5P70NR77MCJRHDZK989S3H2/sample.mp4'
      const payload = 'raw video bytes content'

      await localArchive.uploadStream(key, makeWebStream([payload]), payload.length, 'video/mp4')

      const expectedDiskPath = path.join(
        testRoot,
        'files',
        '01M5P70NR77MCJRHDZK989S3H2',
        'sample.mp4',
      )
      expect(fs.existsSync(expectedDiskPath)).toBe(true)

      const head = await localArchive.headObject(key)
      expect(head.size).toBe(payload.length)
      expect(head.key).toBe(key)

      const { stream, contentLength } = await localArchive.getObjectStream(key)
      expect(contentLength).toBe(payload.length)
      const readBack = await readAllBytes(stream)
      expect(readBack.toString('utf8')).toBe(payload)

      const restoreStatus = await localArchive.checkOrInitiateObjectRestore(key)
      expect(restoreStatus).toEqual({ status: 'ready' })

      const deleted = await localArchive.deleteObject(key)
      expect(deleted).toBe(1)
      expect(fs.existsSync(expectedDiskPath)).toBe(false)
      // Empty <root>/files/<ulid> directory should also be cleaned up
      expect(fs.existsSync(path.dirname(expectedDiskPath))).toBe(false)
    })

    it('prevents path traversal outside ARCHIVE_LOCAL_ROOT', async () => {
      const localArchive = new LocalArchiveStorageService(testRoot)
      await expect(
        localArchive.uploadStream('../escape.txt', makeWebStream(['bad']), 3),
      ).rejects.toThrow(/path traversal/)
    })
  })

  describe('S3ArchiveStorageService', () => {
    const baseS3Config = {
      enabled: true as const,
      backend: 's3' as const,
      bucket: 'archive-bucket',
      endpoint: 'http://archive-s3:9000',
      region: 'us-east-1',
      accessKeyId: 'archive-ak',
      secretAccessKey: 'archive-sk',
      forcePathStyle: true,
      storageClass: 'GLACIER_IR',
      useRestoreObject: 'auto' as const,
      restoreDays: 3,
      restoreTier: undefined,
      isSameS3Target: false,
    }

    it('uploads small streams via PutObjectCommand with configured arbitrary StorageClass', async () => {
      s3SendSpy.mockResolvedValueOnce({})
      const service = new S3ArchiveStorageService({
        ...baseS3Config,
        storageClass: 'ColdArchive',
      })

      await service.uploadStream(
        'files/01ABC/video.mp4',
        makeWebStream(['hello archive']),
        13,
        'video/mp4',
      )

      expect(s3SendSpy).toHaveBeenCalledTimes(1)
      const cmd = s3SendSpy.mock.calls[0][0]
      expect(cmd).toBeInstanceOf(PutObjectCommand)
      expect(cmd.input).toMatchObject({
        Bucket: 'archive-bucket',
        Key: 'files/01ABC/video.mp4',
        ContentLength: 13,
        ContentType: 'video/mp4',
        StorageClass: 'ColdArchive',
      })
    })

    it('streams large uploads via multipart upload and aborts on part failure', async () => {
      // Test multipart helper with custom thresholds (singlePutMaxBytes = 10, partSizeBytes = 5)
      const fakeClient = { send: s3SendSpy } as unknown as import('@aws-sdk/client-s3').S3Client
      s3SendSpy
        .mockResolvedValueOnce({ UploadId: 'mp-1' }) // CreateMultipartUpload
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ ETag: '"etag-1"' }) // Part 1
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ ETag: '"etag-2"' }) // Part 2
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ ETag: '"etag-3"' }) // Part 3
        .mockResolvedValueOnce({}) // CompleteMultipartUpload

      await uploadStreamToS3Client(
        fakeClient,
        {
          bucket: 'archive-bucket',
          key: 'files/01ABC/large.bin',
          stream: makeWebStream(['01234', '56789', 'ab']),
          contentLength: 12,
          contentType: 'application/octet-stream',
          storageClass: 'DEEP_ARCHIVE',
        },
        5,
        10,
      )

      expect(s3SendSpy).toHaveBeenCalledTimes(5)
      expect(s3SendSpy.mock.calls[0][0]).toBeInstanceOf(CreateMultipartUploadCommand)
      expect(s3SendSpy.mock.calls[0][0].input).toMatchObject({
        Bucket: 'archive-bucket',
        Key: 'files/01ABC/large.bin',
        StorageClass: 'DEEP_ARCHIVE',
      })
      expect(s3SendSpy.mock.calls[1][0]).toBeInstanceOf(UploadPartCommand)
      expect(s3SendSpy.mock.calls[2][0]).toBeInstanceOf(UploadPartCommand)
      expect(s3SendSpy.mock.calls[3][0]).toBeInstanceOf(UploadPartCommand)
      expect(s3SendSpy.mock.calls[4][0]).toBeInstanceOf(CompleteMultipartUploadCommand)
      expect(s3SendSpy.mock.calls[4][0].input.MultipartUpload.Parts).toEqual([
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { ETag: '"etag-1"', PartNumber: 1 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { ETag: '"etag-2"', PartNumber: 2 },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { ETag: '"etag-3"', PartNumber: 3 },
      ])

      // Verify abort on failure
      s3SendSpy.mockReset()
      s3SendSpy
        .mockResolvedValueOnce({ UploadId: 'mp-fail' })
        .mockRejectedValueOnce(new Error('Part upload failed'))
        .mockResolvedValueOnce({}) // AbortMultipartUpload

      await expect(
        uploadStreamToS3Client(
          fakeClient,
          {
            bucket: 'archive-bucket',
            key: 'files/01ABC/large.bin',
            stream: makeWebStream(['0123456789ab']),
            contentLength: 12,
          },
          5,
          10,
        ),
      ).rejects.toThrow('Part upload failed')

      expect(s3SendSpy.mock.calls[2][0]).toBeInstanceOf(AbortMultipartUploadCommand)
      expect(s3SendSpy.mock.calls[2][0].input).toMatchObject({
        Bucket: 'archive-bucket',
        Key: 'files/01ABC/large.bin',
        UploadId: 'mp-fail',
      })
    })

    it('handles checkOrInitiateObjectRestore in auto mode for synchronous vs asynchronous cold storage classes', async () => {
      // 1. GLACIER_IR is immediately readable -> ready without calling RestoreObjectCommand
      s3SendSpy.mockResolvedValueOnce({
        ContentLength: 100,
        StorageClass: 'GLACIER_IR',
      })
      const glacierIrService = new S3ArchiveStorageService({
        ...baseS3Config,
        storageClass: 'GLACIER_IR',
      })
      expect(await glacierIrService.checkOrInitiateObjectRestore('files/1/a.mp4')).toEqual({
        status: 'ready',
      })
      expect(s3SendSpy).toHaveBeenCalledTimes(1)
      expect(s3SendSpy.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand)

      // 2. GLACIER with no Restore header -> sends RestoreObjectCommand without GlacierJobParameters by default
      s3SendSpy.mockReset()
      s3SendSpy
        .mockResolvedValueOnce({
          ContentLength: 100,
          StorageClass: 'GLACIER',
        })
        .mockResolvedValueOnce({})
      const glacierService = new S3ArchiveStorageService({
        ...baseS3Config,
        storageClass: 'GLACIER',
      })
      expect(await glacierService.checkOrInitiateObjectRestore('files/1/a.mp4')).toEqual({
        status: 'restoring',
      })
      expect(s3SendSpy).toHaveBeenCalledTimes(2)
      expect(s3SendSpy.mock.calls[1][0]).toBeInstanceOf(RestoreObjectCommand)
      expect(s3SendSpy.mock.calls[1][0].input).toEqual({
        Bucket: 'archive-bucket',
        Key: 'files/1/a.mp4',
        RestoreRequest: {
          Days: 3,
        },
      })

      // 3. When ARCHIVE_S3_RESTORE_TIER is explicitly set, includes GlacierJobParameters
      s3SendSpy.mockReset()
      s3SendSpy
        .mockResolvedValueOnce({
          ContentLength: 100,
          StorageClass: 'DEEP_ARCHIVE',
        })
        .mockResolvedValueOnce({})
      const tieredService = new S3ArchiveStorageService({
        ...baseS3Config,
        storageClass: 'DEEP_ARCHIVE',
        restoreTier: 'Standard',
      })
      expect(await tieredService.checkOrInitiateObjectRestore('files/1/a.mp4')).toEqual({
        status: 'restoring',
      })
      expect(s3SendSpy.mock.calls[1][0].input).toEqual({
        Bucket: 'archive-bucket',
        Key: 'files/1/a.mp4',
        RestoreRequest: {
          Days: 3,
          GlacierJobParameters: { Tier: 'Standard' },
        },
      })

      // 4. Ongoing restore header -> returns 'restoring' without re-sending RestoreObject
      s3SendSpy.mockReset()
      s3SendSpy.mockResolvedValueOnce({
        ContentLength: 100,
        StorageClass: 'GLACIER',
        Restore: 'ongoing-request="true"',
      })
      expect(await glacierService.checkOrInitiateObjectRestore('files/1/a.mp4')).toEqual({
        status: 'restoring',
      })
      expect(s3SendSpy).toHaveBeenCalledTimes(1)

      // 5. Completed restore header -> returns 'ready'
      s3SendSpy.mockReset()
      s3SendSpy.mockResolvedValueOnce({
        ContentLength: 100,
        StorageClass: 'GLACIER',
        Restore: 'ongoing-request="false", expiry-date="Wed, 04 Nov 2026 00:00:00 GMT"',
      })
      expect(await glacierService.checkOrInitiateObjectRestore('files/1/a.mp4')).toEqual({
        status: 'ready',
      })

      // 6. RestoreAlreadyInProgress (409) is treated as idempotent success
      s3SendSpy.mockReset()
      const conflictErr = Object.assign(new Error('RestoreAlreadyInProgress'), {
        name: 'RestoreAlreadyInProgress',
        $metadata: { httpStatusCode: 409 },
      })
      s3SendSpy
        .mockResolvedValueOnce({
          ContentLength: 100,
          StorageClass: 'GLACIER',
        })
        .mockRejectedValueOnce(conflictErr)
      expect(await glacierService.checkOrInitiateObjectRestore('files/1/a.mp4')).toEqual({
        status: 'restoring',
      })
    })

    it('rewrites StorageClass in-place via single CopyObject or multipart UploadPartCopy', async () => {
      const service = new S3ArchiveStorageService(
        {
          ...baseS3Config,
          isSameS3Target: true,
        },
        { singleCopyMaxBytes: 100, multipartCopyPartBytes: 60 },
      )

      // Single CopyObject (<= 100 bytes)
      s3SendSpy.mockResolvedValueOnce({})
      await service.rewriteObjectStorageClassInPlace(
        'files/01ABC/my video #1.mp4',
        'GLACIER_IR',
        80,
        'video/mp4',
      )
      expect(s3SendSpy).toHaveBeenCalledTimes(1)
      expect(s3SendSpy.mock.calls[0][0]).toBeInstanceOf(CopyObjectCommand)
      expect(s3SendSpy.mock.calls[0][0].input).toEqual({
        Bucket: 'archive-bucket',
        Key: 'files/01ABC/my video #1.mp4',
        CopySource: 'archive-bucket/files/01ABC/my%20video%20%231.mp4',
        StorageClass: 'GLACIER_IR',
        MetadataDirective: 'COPY',
        ContentType: 'video/mp4',
      })

      // Multipart UploadPartCopy (> 100 bytes: 130 bytes across 60-byte parts -> 0-59, 60-119, 120-129)
      s3SendSpy.mockReset()
      s3SendSpy
        .mockResolvedValueOnce({ UploadId: 'copy-mp-1' })
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ CopyPartResult: { ETag: '"p1"' } })
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ CopyPartResult: { ETag: '"p2"' } })
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ CopyPartResult: { ETag: '"p3"' } })
        .mockResolvedValueOnce({})

      await service.rewriteObjectStorageClassInPlace(
        'files/01ABC/large.mp4',
        'STANDARD',
        130,
        'video/mp4',
      )

      expect(s3SendSpy).toHaveBeenCalledTimes(5)
      expect(s3SendSpy.mock.calls[0][0]).toBeInstanceOf(CreateMultipartUploadCommand)
      expect(s3SendSpy.mock.calls[1][0]).toBeInstanceOf(UploadPartCopyCommand)
      expect(s3SendSpy.mock.calls[1][0].input.CopySourceRange).toBe('bytes=0-59')
      expect(s3SendSpy.mock.calls[2][0].input.CopySourceRange).toBe('bytes=60-119')
      expect(s3SendSpy.mock.calls[3][0].input.CopySourceRange).toBe('bytes=120-129')
      expect(s3SendSpy.mock.calls[4][0]).toBeInstanceOf(CompleteMultipartUploadCommand)
    })

    it('detects cold storage restore errors and parses x-amz-restore headers accurately', () => {
      expect(parseRestoreHeaderStatus(undefined)).toBe('none')
      expect(parseRestoreHeaderStatus('ongoing-request="true"')).toBe('ongoing')
      expect(
        parseRestoreHeaderStatus(
          'ongoing-request="false", expiry-date="Fri, 21 Dec 2026 00:00:00 GMT"',
        ),
      ).toBe('restored')

      expect(isColdStorageRestoreError({ name: 'InvalidObjectState' })).toBe(true)
      expect(isColdStorageRestoreError({ Code: 'RestoreAlreadyInProgress' })).toBe(true)
      expect(
        isColdStorageRestoreError(
          new Error("The operation is not valid for the object's storage class"),
        ),
      ).toBe(true)
      expect(isColdStorageRestoreError(new Error('NetworkingError'))).toBe(false)
    })

    it('headObject maps 404/NotFound to NoSuchKey, but rethrows 500 and other transient errors', async () => {
      const service = new S3ArchiveStorageService(baseS3Config)

      s3SendSpy.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } })
      await expect(service.headObject('missing.mp4')).rejects.toThrow('NoSuchKey')

      const internalErr = new Error('Internal S3 500')
      s3SendSpy.mockRejectedValueOnce(internalErr)
      await expect(service.headObject('error.mp4')).rejects.toThrow('Internal S3 500')
    })

    it('deleteObject returns 0 on 404/NotFound, but rethrows non-404 errors', async () => {
      const service = new S3ArchiveStorageService(baseS3Config)

      s3SendSpy.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } })
      const res404 = await service.deleteObject('missing.mp4')
      expect(res404).toBe(0)

      const permErr = new Error('AccessDenied')
      s3SendSpy.mockRejectedValueOnce(permErr)
      await expect(service.deleteObject('forbidden.mp4')).rejects.toThrow('AccessDenied')
    })
  })
})
