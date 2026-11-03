import { ObjectInfo } from '@shumai/dtos'
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCopyCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  RestoreObjectCommand,
  StorageClass,
  Tier,
} from '@aws-sdk/client-s3'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import {
  bodyToWebReadableStream,
  isS3NotFoundError,
  S3StreamObject,
  uploadStreamToS3Client,
  writeStreamToLocalFile,
} from './s3'

export type ArchiveStorageBackend = 'local' | 's3'
export type ArchiveRestoreObjectMode = 'auto' | 'true' | 'false'

export interface ArchiveObjectInfo extends ObjectInfo {
  storageClass?: string
  restoreHeader?: string
}

export interface ArchiveStorageConfigDisabled {
  enabled: false
}

export interface ArchiveStorageConfigLocal {
  enabled: true
  backend: 'local'
  localRoot: string
  isSameS3Target: false
}

export interface ArchiveStorageConfigS3 {
  enabled: true
  backend: 's3'
  bucket: string
  endpoint?: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  storageClass?: string
  useRestoreObject: ArchiveRestoreObjectMode
  restoreDays: number
  restoreTier?: string
  isSameS3Target: boolean
}

export type ArchiveStorageConfig =
  ArchiveStorageConfigDisabled | ArchiveStorageConfigLocal | ArchiveStorageConfigS3

export interface ArchiveStorageService {
  readonly backend: ArchiveStorageBackend
  readonly isSameS3Target: boolean
  readonly storageClass?: string
  uploadStream: (
    key: string,
    stream: ReadableStream<Uint8Array>,
    size: number,
    contentType?: string,
  ) => Promise<void>
  getObjectStream: (key: string) => Promise<S3StreamObject>
  headObject: (key: string) => Promise<ArchiveObjectInfo>
  deleteObject: (key: string) => Promise<number>
  checkOrInitiateObjectRestore: (key: string) => Promise<{ status: 'ready' | 'restoring' }>
  initiateObjectRestoreExplicitly: (key: string) => Promise<{ status: 'ready' | 'restoring' }>
  rewriteObjectStorageClassInPlace: (
    key: string,
    targetStorageClass: string,
    expectedSize: number,
    contentType?: string,
  ) => Promise<void>
}

/**
 * Storage classes across AWS S3 and S3-compatible providers that require asynchronous
 * `RestoreObject` + `HeadObject` (`x-amz-restore`) polling before `GetObject` / `CopyObject`.
 * Explicitly excludes `GLACIER_IR` (Glacier Instant Retrieval), which is synchronously readable.
 */
export const KNOWN_ASYNC_RESTORE_STORAGE_CLASSES = new Set([
  'GLACIER',
  'DEEP_ARCHIVE',
  'ARCHIVE',
  'COLDARCHIVE',
  'COLD_ARCHIVE',
  'DEEPCOLDARCHIVE',
  'DEEP_COLD_ARCHIVE',
  'COLD',
])

const SINGLE_COPY_MAX_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB
const MULTIPART_COPY_PART_BYTES = 512 * 1024 * 1024 // 512 MB

function normalizeEndpointForComparison(endpoint?: string): string {
  const trimmed = (endpoint || '').trim().toLowerCase().replace(/\/+$/, '')
  return trimmed || 'https://s3.amazonaws.com'
}

function isSubPathOrEqual(candidatePath: string, targetPath: string): boolean {
  const rel = path.relative(targetPath, candidatePath)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function encodeCopySourceKey(bucket: string, key: string): string {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${bucket}/${encodedKey}`
}

export function parseRestoreHeaderStatus(restoreHeader?: string): 'ongoing' | 'restored' | 'none' {
  if (!restoreHeader) return 'none'
  if (/ongoing-request\s*=\s*"true"/i.test(restoreHeader)) {
    return 'ongoing'
  }
  if (/ongoing-request\s*=\s*"false"/i.test(restoreHeader)) {
    return 'restored'
  }
  return 'none'
}

export function isColdStorageRestoreError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  const code =
    (typeof e.name === 'string' && e.name) ||
    (typeof e.Code === 'string' && e.Code) ||
    (typeof e.code === 'string' && e.code) ||
    ''
  if (code === 'InvalidObjectState' || code === 'RestoreAlreadyInProgress') {
    return true
  }
  const msg = typeof e.message === 'string' ? e.message : ''
  return (
    msg.includes('InvalidObjectState') ||
    msg.includes('RestoreAlreadyInProgress') ||
    msg.includes("operation is not valid for the object's storage class")
  )
}

function isRestoreAlreadyInProgressError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  const metadata = e.$metadata as { httpStatusCode?: number } | undefined
  const code =
    (typeof e.name === 'string' && e.name) ||
    (typeof e.Code === 'string' && e.Code) ||
    (typeof e.code === 'string' && e.code) ||
    ''
  if (code === 'RestoreAlreadyInProgress' || metadata?.httpStatusCode === 409) {
    return true
  }
  return typeof e.message === 'string' && e.message.includes('RestoreAlreadyInProgress')
}

export function getArchiveStorageConfig(): ArchiveStorageConfig {
  const rawBackend = (process.env.ARCHIVE_STORAGE_BACKEND || '').trim()
  if (!rawBackend) {
    return { enabled: false }
  }

  if (rawBackend !== 'local' && rawBackend !== 's3') {
    throw new Error(
      `Invalid ARCHIVE_STORAGE_BACKEND "${rawBackend}". Expected "local", "s3", or empty.`,
    )
  }

  if (rawBackend === 'local') {
    const rawLocalRoot = (process.env.ARCHIVE_LOCAL_ROOT || '').trim()
    if (!rawLocalRoot) {
      throw new Error(
        'ARCHIVE_LOCAL_ROOT is required when ARCHIVE_STORAGE_BACKEND is set to "local".',
      )
    }
    const resolvedArchiveRoot = path.resolve(rawLocalRoot)
    const mainBackend = (process.env.STORAGE_BACKEND || 'local').trim()
    if (mainBackend !== 's3') {
      const mainBaseDir = path.resolve('data')
      const mainBucketDir = path.resolve('data', process.env.S3_BUCKET || 'shumai')
      if (
        resolvedArchiveRoot === mainBaseDir ||
        isSubPathOrEqual(resolvedArchiveRoot, mainBucketDir) ||
        isSubPathOrEqual(mainBucketDir, resolvedArchiveRoot)
      ) {
        throw new Error(
          `ARCHIVE_LOCAL_ROOT (${resolvedArchiveRoot}) must not overlap with main local storage (${mainBucketDir}).`,
        )
      }
    }

    return {
      enabled: true,
      backend: 'local',
      localRoot: resolvedArchiveRoot,
      isSameS3Target: false,
    }
  }

  // S3 backend — never fall back to main S3_* environment variables
  const bucket = (process.env.ARCHIVE_S3_BUCKET || '').trim()
  if (!bucket) {
    throw new Error('ARCHIVE_S3_BUCKET is required when ARCHIVE_STORAGE_BACKEND is set to "s3".')
  }

  const accessKeyId = (process.env.ARCHIVE_S3_ACCESS_KEY_ID || '').trim()
  if (!accessKeyId) {
    throw new Error(
      'ARCHIVE_S3_ACCESS_KEY_ID is required when ARCHIVE_STORAGE_BACKEND is set to "s3".',
    )
  }

  const secretAccessKey = (process.env.ARCHIVE_S3_SECRET_ACCESS_KEY || '').trim()
  if (!secretAccessKey) {
    throw new Error(
      'ARCHIVE_S3_SECRET_ACCESS_KEY is required when ARCHIVE_STORAGE_BACKEND is set to "s3".',
    )
  }

  const endpoint = (process.env.ARCHIVE_AWS_ENDPOINT_URL_S3 || '').trim() || undefined
  const region = (process.env.ARCHIVE_S3_REGION || '').trim() || 'auto'
  const forcePathStyleRaw = (process.env.ARCHIVE_S3_FORCE_PATH_STYLE || 'true').trim().toLowerCase()
  const forcePathStyle = forcePathStyleRaw !== 'false' && forcePathStyleRaw !== '0'
  const storageClass = (process.env.ARCHIVE_S3_STORAGE_CLASS || '').trim() || undefined

  const useRestoreObjectRaw = (process.env.ARCHIVE_S3_USE_RESTORE_OBJECT || 'auto')
    .trim()
    .toLowerCase()
  if (
    useRestoreObjectRaw !== 'auto' &&
    useRestoreObjectRaw !== 'true' &&
    useRestoreObjectRaw !== 'false'
  ) {
    throw new Error(
      `Invalid ARCHIVE_S3_USE_RESTORE_OBJECT "${useRestoreObjectRaw}". Expected "auto", "true", or "false".`,
    )
  }

  const restoreDaysRaw = (process.env.ARCHIVE_S3_RESTORE_DAYS || '1').trim()
  const restoreDays = Number.parseInt(restoreDaysRaw, 10)
  if (!Number.isFinite(restoreDays) || restoreDays < 1) {
    throw new Error(
      `Invalid ARCHIVE_S3_RESTORE_DAYS "${restoreDaysRaw}". Expected a positive integer.`,
    )
  }

  const restoreTier = (process.env.ARCHIVE_S3_RESTORE_TIER || '').trim() || undefined

  const mainBackend = (process.env.STORAGE_BACKEND || 'local').trim()
  const mainBucket = (process.env.S3_BUCKET || 'shumai').trim()
  const mainEndpoint = (process.env.AWS_ENDPOINT_URL_S3 || '').trim() || undefined

  const isSameS3Target =
    mainBackend === 's3' &&
    mainBucket === bucket &&
    normalizeEndpointForComparison(mainEndpoint) === normalizeEndpointForComparison(endpoint)

  if (isSameS3Target) {
    if (!storageClass || storageClass.toUpperCase() === 'STANDARD') {
      throw new Error(
        'When ARCHIVE_S3_BUCKET and endpoint match main S3 storage, ARCHIVE_S3_STORAGE_CLASS must be set to a non-STANDARD storage class.',
      )
    }
  }

  return {
    enabled: true,
    backend: 's3',
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    storageClass,
    useRestoreObject: useRestoreObjectRaw,
    restoreDays,
    restoreTier,
    isSameS3Target,
  }
}

export function isArchiveStorageEnabled(): boolean {
  const rawBackend = (process.env.ARCHIVE_STORAGE_BACKEND || '').trim()
  return rawBackend === 'local' || rawBackend === 's3'
}

export function validateArchiveStorageConfig(): ArchiveStorageConfig {
  return getArchiveStorageConfig()
}

export class LocalArchiveStorageService implements ArchiveStorageService {
  readonly backend = 'local' as const
  readonly isSameS3Target = false
  readonly storageClass = undefined
  private readonly rootPath: string

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath)
    if (!fs.existsSync(this.rootPath)) {
      fs.mkdirSync(this.rootPath, { recursive: true })
    }
  }

  private getFilePath(key: string): string {
    const normalizedKey = key.replace(/^\/+/, '')
    if (!normalizedKey) {
      throw new Error('Invalid archive key: key cannot be empty')
    }
    const filePath = path.resolve(this.rootPath, normalizedKey)
    if (!isSubPathOrEqual(filePath, this.rootPath) || filePath === this.rootPath) {
      throw new Error('Invalid archive path: potential path traversal detected')
    }
    return filePath
  }

  async uploadStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _size: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _contentType?: string,
  ): Promise<void> {
    const filePath = this.getFilePath(key)
    await writeStreamToLocalFile(filePath, stream)
  }

  async getObjectStream(key: string): Promise<S3StreamObject> {
    const filePath = this.getFilePath(key)
    try {
      const stats = await fs.promises.stat(filePath)
      const nodeStream = fs.createReadStream(filePath)
      return {
        stream: Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>,
        contentLength: stats.size,
        contentType: Bun.file(filePath).type || 'application/octet-stream',
      }
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('NoSuchKey: The specified key does not exist.', { cause: e })
      }
      throw e
    }
  }

  async headObject(key: string): Promise<ArchiveObjectInfo> {
    const filePath = this.getFilePath(key)
    try {
      const stats = await fs.promises.stat(filePath)
      const hash = crypto
        .createHash('md5')
        .update(filePath + stats.mtimeMs)
        .digest('hex')
      return {
        key,
        size: stats.size,
        lastModified: stats.mtime,
        contentType: Bun.file(key).type || 'application/octet-stream',
        eTag: `"${hash}"`,
      }
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('NoSuchKey: The specified key does not exist.', { cause: e })
      }
      throw e
    }
  }

  async deleteObject(key: string): Promise<number> {
    const filePath = this.getFilePath(key)
    try {
      await fs.promises.unlink(filePath)
      // Best-effort cleanup of empty parent folder (e.g. `<root>/files/<ulid>`)
      const parentDir = path.dirname(filePath)
      if (parentDir !== this.rootPath && isSubPathOrEqual(parentDir, this.rootPath)) {
        const remaining = await fs.promises.readdir(parentDir).catch(() => ['non-empty'])
        if (remaining.length === 0) {
          await fs.promises.rmdir(parentDir).catch(() => {})
        }
      }
      return 1
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        return 0
      }
      throw e
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkOrInitiateObjectRestore(_key: string): Promise<{ status: 'ready' | 'restoring' }> {
    return { status: 'ready' }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initiateObjectRestoreExplicitly(_key: string): Promise<{ status: 'ready' | 'restoring' }> {
    return { status: 'ready' }
  }

  async rewriteObjectStorageClassInPlace(): Promise<void> {
    throw new Error('rewriteObjectStorageClassInPlace is only supported for S3 archive storage.')
  }
}

export class S3ArchiveStorageService implements ArchiveStorageService {
  readonly backend = 's3' as const
  readonly isSameS3Target: boolean
  readonly storageClass?: string
  private readonly client: S3Client
  private readonly bucket: string
  private readonly useRestoreObject: ArchiveRestoreObjectMode
  private readonly restoreDays: number
  private readonly restoreTier?: string
  private readonly singleCopyMaxBytes: number
  private readonly multipartCopyPartBytes: number

  constructor(
    config: ArchiveStorageConfigS3,
    options?: { singleCopyMaxBytes?: number; multipartCopyPartBytes?: number },
  ) {
    this.bucket = config.bucket
    this.isSameS3Target = config.isSameS3Target
    this.storageClass = config.storageClass
    this.useRestoreObject = config.useRestoreObject
    this.restoreDays = config.restoreDays
    this.restoreTier = config.restoreTier
    this.singleCopyMaxBytes = options?.singleCopyMaxBytes ?? SINGLE_COPY_MAX_BYTES
    this.multipartCopyPartBytes = options?.multipartCopyPartBytes ?? MULTIPART_COPY_PART_BYTES

    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  async uploadStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    size: number,
    contentType?: string,
  ): Promise<void> {
    await uploadStreamToS3Client(this.client, {
      bucket: this.bucket,
      key,
      stream,
      contentLength: size,
      contentType,
      storageClass: this.storageClass,
    })
  }

  async getObjectStream(key: string): Promise<S3StreamObject> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    return {
      stream: bodyToWebReadableStream(res.Body),
      contentLength: res.ContentLength,
      contentType: res.ContentType || Bun.file(key).type || 'application/octet-stream',
    }
  }

  async headObject(key: string): Promise<ArchiveObjectInfo> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return {
        key,
        size: res.ContentLength ?? 0,
        lastModified: res.LastModified ?? new Date(),
        contentType: res.ContentType || 'application/octet-stream',
        eTag: res.ETag || '',
        storageClass: res.StorageClass,
        restoreHeader: res.Restore,
      }
    } catch (err: unknown) {
      if (isS3NotFoundError(err)) {
        throw new Error('NoSuchKey: The specified key does not exist.', { cause: err })
      }
      throw err
    }
  }

  async deleteObject(key: string): Promise<number> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      return 1
    } catch (err: unknown) {
      if (isS3NotFoundError(err)) {
        return 0
      }
      throw err
    }
  }

  private async sendRestoreObjectRequest(key: string): Promise<void> {
    try {
      await this.client.send(
        new RestoreObjectCommand({
          Bucket: this.bucket,
          Key: key,
          /* eslint-disable @typescript-eslint/naming-convention */
          RestoreRequest: {
            Days: this.restoreDays,
            ...(this.restoreTier
              ? { GlacierJobParameters: { Tier: this.restoreTier as Tier } }
              : {}),
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        }),
      )
    } catch (err: unknown) {
      if (isRestoreAlreadyInProgressError(err)) {
        return
      }
      throw err
    }
  }

  async checkOrInitiateObjectRestore(key: string): Promise<{ status: 'ready' | 'restoring' }> {
    if (this.useRestoreObject === 'false') {
      return { status: 'ready' }
    }

    const head = await this.headObject(key)
    const restoreState = parseRestoreHeaderStatus(head.restoreHeader)
    if (restoreState === 'restored') {
      return { status: 'ready' }
    }
    if (restoreState === 'ongoing') {
      return { status: 'restoring' }
    }

    const effectiveStorageClass = (head.storageClass || this.storageClass || '').toUpperCase()
    const requiresRestore =
      this.useRestoreObject === 'true' ||
      (this.useRestoreObject === 'auto' &&
        KNOWN_ASYNC_RESTORE_STORAGE_CLASSES.has(effectiveStorageClass))

    if (!requiresRestore) {
      return { status: 'ready' }
    }

    await this.sendRestoreObjectRequest(key)
    return { status: 'restoring' }
  }

  async initiateObjectRestoreExplicitly(key: string): Promise<{ status: 'ready' | 'restoring' }> {
    if (this.useRestoreObject === 'false') {
      throw new Error(
        'Object is in a cold storage class requiring RestoreObject, but ARCHIVE_S3_USE_RESTORE_OBJECT is set to "false".',
      )
    }
    const head = await this.headObject(key)
    const restoreState = parseRestoreHeaderStatus(head.restoreHeader)
    if (restoreState === 'restored') {
      return { status: 'ready' }
    }
    if (restoreState === 'ongoing') {
      return { status: 'restoring' }
    }
    await this.sendRestoreObjectRequest(key)
    return { status: 'restoring' }
  }

  async rewriteObjectStorageClassInPlace(
    key: string,
    targetStorageClass: string,
    expectedSize: number,
    contentType?: string,
  ): Promise<void> {
    const copySource = encodeCopySourceKey(this.bucket, key)
    const s3StorageClass = targetStorageClass as StorageClass

    if (expectedSize <= this.singleCopyMaxBytes) {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: key,
          CopySource: copySource,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          StorageClass: s3StorageClass,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          MetadataDirective: 'COPY',
          ...(contentType ? { ContentType: contentType } : {}),
        }),
      )
      return
    }

    const createRes = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        StorageClass: s3StorageClass,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    )
    const uploadId = createRes.UploadId
    if (!uploadId) {
      throw new Error(`Failed to initiate multipart copy for ${this.bucket}/${key}`)
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const completedParts: Array<{ ETag?: string; PartNumber: number }> = []
    let partNumber = 1
    let offset = 0

    try {
      while (offset < expectedSize) {
        const end = Math.min(offset + this.multipartCopyPartBytes - 1, expectedSize - 1)
        const currentPartNumber = partNumber++
        const copyPartRes = await this.client.send(
          new UploadPartCopyCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: currentPartNumber,
            CopySource: copySource,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            CopySourceRange: `bytes=${offset}-${end}`,
          }),
        )
        completedParts.push({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          ETag: copyPartRes.CopyPartResult?.ETag,
          PartNumber: currentPartNumber,
        })
        offset = end + 1
      }

      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          /* eslint-disable @typescript-eslint/naming-convention */
          MultipartUpload: {
            Parts: completedParts,
          },
          /* eslint-enable @typescript-eslint/naming-convention */
        }),
      )
    } catch (err) {
      await this.client
        .send(
          new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
          }),
        )
        .catch(() => {})
      throw err
    }
  }
}

let cachedService: ArchiveStorageService | null = null
let cachedConfigSignature: string | null = null

function getEnvSignature(): string {
  return JSON.stringify({
    b: process.env.ARCHIVE_STORAGE_BACKEND,
    lr: process.env.ARCHIVE_LOCAL_ROOT,
    sb: process.env.ARCHIVE_S3_BUCKET,
    se: process.env.ARCHIVE_AWS_ENDPOINT_URL_S3,
    sr: process.env.ARCHIVE_S3_REGION,
    ak: process.env.ARCHIVE_S3_ACCESS_KEY_ID,
    sk: process.env.ARCHIVE_S3_SECRET_ACCESS_KEY,
    fp: process.env.ARCHIVE_S3_FORCE_PATH_STYLE,
    sc: process.env.ARCHIVE_S3_STORAGE_CLASS,
    ro: process.env.ARCHIVE_S3_USE_RESTORE_OBJECT,
    rd: process.env.ARCHIVE_S3_RESTORE_DAYS,
    rt: process.env.ARCHIVE_S3_RESTORE_TIER,
    mb: process.env.STORAGE_BACKEND,
    msb: process.env.S3_BUCKET,
    mse: process.env.AWS_ENDPOINT_URL_S3,
  })
}

export function getArchiveStorageService(): ArchiveStorageService {
  const sig = getEnvSignature()
  if (cachedService && cachedConfigSignature === sig) {
    return cachedService
  }

  const config = getArchiveStorageConfig()
  if (!config.enabled) {
    throw new Error('Archive storage is not enabled (ARCHIVE_STORAGE_BACKEND is not configured).')
  }

  cachedService =
    config.backend === 'local'
      ? new LocalArchiveStorageService(config.localRoot)
      : new S3ArchiveStorageService(config)
  cachedConfigSignature = sig
  return cachedService
}

export function resetArchiveStorageServiceForTests(): void {
  cachedService = null
  cachedConfigSignature = null
}
