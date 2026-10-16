import { ObjectInfo, S3SignRequest } from '@shumai/dtos'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { ulid } from 'ulid'
import { LruTtlCache } from '../cache/lru-ttl-cache'
import { detectSupportedMimeType } from '../utils/mime'

/** Multipart operations bind the HTTP method, upload id and part number into the signature. */
export interface LocalMultipartParams {
  method: string
  uploadId?: string
  partNumber?: number
}

/** Lifetime of a signed local URL; follows the same setting S3 presigned URLs use (hours, default 5). */
export function localUrlLifetimeSeconds(): number {
  const hours = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '5', 10)
  return (Number.isFinite(hours) && hours > 0 ? hours : 5) * 3600
}

function localSecret(): string {
  return process.env.BETTER_AUTH_SECRET || 'shumai-local-storage-secret'
}

/**
 * The signed fields as a JSON array, so no field value can be shifted into a neighbour (a plain
 * string join is ambiguous when keys or ids contain the separator).
 */
function localSignaturePayload(
  bucket: string,
  key: string,
  mp: LocalMultipartParams | undefined,
  exp: number | undefined,
): string {
  return JSON.stringify([
    bucket,
    key,
    mp?.method ?? 'PUT',
    mp?.uploadId ?? null,
    mp?.partNumber ?? null,
    exp ?? null,
  ])
}

function hmacHex(payload: string): string {
  return crypto.createHmac('sha256', localSecret()).update(payload).digest('hex')
}

function signaturesMatch(signature: string, expected: string): boolean {
  try {
    const given = Buffer.from(signature, 'hex')
    const want = Buffer.from(expected, 'hex')
    return given.length === want.length && crypto.timingSafeEqual(given, want)
  } catch {
    return false
  }
}

/** Builds a signed, expiring local upload URL. `exp` (unix seconds) is part of the signed payload. */
export function signLocalUrl(
  bucket: string,
  key: string,
  mp?: LocalMultipartParams,
  expiresInSeconds: number = localUrlLifetimeSeconds(),
  nowMs: number = Date.now(),
): string {
  const exp = Math.floor(nowMs / 1000) + expiresInSeconds
  const signature = hmacHex(localSignaturePayload(bucket, key, mp, exp))
  let url = `/api/upload/local?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
  if (mp?.uploadId) url += `&uploadId=${encodeURIComponent(mp.uploadId)}`
  if (mp?.partNumber != null) url += `&partNumber=${mp.partNumber}`
  return `${url}&exp=${exp}&Signature=${signature}`
}

export type LocalUrlCheck = 'ok' | 'invalid' | 'expired'

/**
 * Checks a signed local URL. A URL without `exp` is only accepted for the legacy whole-object PUT
 * (signature over `bucket/key`), which older servers handed out; this compatibility path can be
 * dropped one release after expiring URLs ship. Multipart URLs must always carry an expiry.
 */
export function checkLocalUrl(
  bucket: string,
  key: string,
  signature: string,
  mp?: LocalMultipartParams,
  exp?: number,
  nowMs: number = Date.now(),
): LocalUrlCheck {
  if (exp === undefined) {
    if (mp) return 'invalid'
    return signaturesMatch(signature, hmacHex(`${bucket}/${key}`)) ? 'ok' : 'invalid'
  }
  if (!Number.isSafeInteger(exp)) return 'invalid'
  if (!signaturesMatch(signature, hmacHex(localSignaturePayload(bucket, key, mp, exp)))) {
    return 'invalid'
  }
  return exp * 1000 < nowMs ? 'expired' : 'ok'
}

export function verifyLocalUrlSignature(
  bucket: string,
  key: string,
  signature: string,
  mp?: LocalMultipartParams,
  exp?: number,
  nowMs: number = Date.now(),
): boolean {
  return checkLocalUrl(bucket, key, signature, mp, exp, nowMs) === 'ok'
}

/**
 * Build a Content-Disposition header value for downloads.
 * - Falls back to plain `attachment` when no filename is provided.
 * - Strips control characters (CR/LF header injection), quotes, and backslashes.
 * - Header values must be ASCII (RFC 7230): non-ASCII names are conveyed only
 *   via the percent-encoded RFC 5987 `filename*` parameter; the quoted
 *   `filename="..."` fallback is included only when the name is pure ASCII.
 */
export function buildContentDisposition(filename?: string | null): string {
  if (!filename) return 'attachment'
  // Strip C0 control characters (incl. CR/LF header injection) and DEL, then
  // quotes/backslashes which would break the quoted-string form.
  const sanitized = [...filename]
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code > 0x1f && code !== 0x7f && ch !== '"' && ch !== '\\'
    })
    .join('')
    .trim()
  if (!sanitized) return 'attachment'
  // RFC 5987 attr-char excludes ' ( ) * — percent-encode them explicitly
  const encoded = encodeURIComponent(sanitized).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  const isAscii = [...sanitized].every((ch) => ch.charCodeAt(0) <= 0x7f)
  if (!isAscii) {
    return `attachment; filename*=UTF-8''${encoded}`
  }
  return `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`
}

/** Error with an S3-style code, thrown by the local multipart implementation. */
export class LocalMultipartError extends Error {
  constructor(
    public readonly code:
      'InvalidArgument' | 'NoSuchUpload' | 'InvalidPart' | 'EntityTooLarge' | 'OperationAborted',
    message: string,
  ) {
    super(message)
    this.name = 'LocalMultipartError'
  }
}

const LOCAL_MULTIPART_DIR = '.multipart'
const MAX_PART_NUMBER = 10000
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const S3_MAX_PART_SIZE = 5 * 1024 * 1024 * 1024
/** Orphaned multipart uploads (no activity for this long) are swept. */
const MULTIPART_STALE_MS = 24 * 3600 * 1000
const MULTIPART_SWEEP_INTERVAL_MS = 3600 * 1000
/** A complete lock older than this is assumed to belong to a crashed process. */
const COMPLETE_LOCK_STALE_MS = 3600 * 1000

/** Largest accepted part: S3's 5 GiB limit, or MAX_REQUEST_BODY_SIZE when that is lower. */
export function maxLocalPartSize(): number {
  const configured = parseInt(process.env.MAX_REQUEST_BODY_SIZE || '', 10)
  return Number.isFinite(configured) && configured > 0
    ? Math.min(S3_MAX_PART_SIZE, configured)
    : S3_MAX_PART_SIZE
}

function assertValidUploadId(uploadId: string): void {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new LocalMultipartError('InvalidArgument', 'Invalid upload id')
  }
}

function assertValidPartNumber(partNumber: number): void {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PART_NUMBER) {
    throw new LocalMultipartError(
      'InvalidArgument',
      `Part number must be an integer between 1 and ${MAX_PART_NUMBER}`,
    )
  }
}

export interface LocalPartInfo {
  partNumber: number
  size: number
  etag: string
  lastModified: Date
}

export interface S3Object {
  buffer: Buffer
  contentType: string
}

export interface S3Service {
  getObjectSize: (bucket: string, key: string) => Promise<number>
  putObject: (
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream | NodeJS.ReadableStream,
    size: number,
    contentType?: string,
  ) => Promise<void>
  getObject: (bucket: string, key: string) => Promise<S3Object>
  copyObject: (
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ) => Promise<void>
  downloadToFile: (bucket: string, key: string, filePath: string) => Promise<void>
  deleteObject: (bucket: string, key: string) => Promise<number>
  deletePrefix: (bucket: string, prefix: string) => Promise<number>
  headObject: (bucket: string, key: string) => Promise<ObjectInfo>
  listObjects: (bucket: string, prefix: string) => Promise<string[]>
  uploadFile: (filePath: string, contentType: string) => Promise<string>
  uploadFileToKey: (filePath: string, key: string, contentType: string) => Promise<void>
  presign: (
    bucket: string,
    key: string,
    method: string,
    download?: boolean,
    filename?: string,
  ) => Promise<string>
  presignMultipart: (
    bucket: string,
    key: string,
    request: S3SignRequest,
  ) => Promise<{ url: string }>
  abortMultipartUpload: (bucket: string, key: string, uploadId: string) => Promise<void>
  resolveInput: (bucket: string, key: string) => Promise<string>
}

export class S3StorageService implements S3Service {
  private client: S3Client
  private bucket: string
  private presignCache = new LruTtlCache<string, string>(50000)

  constructor(
    endpoint: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string,
    region: string = 'auto',
  ) {
    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
    this.bucket = bucket
  }

  async getObjectSize(bucket: string, key: string): Promise<number> {
    const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return res.ContentLength ?? 0
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream | NodeJS.ReadableStream,
    size: number,
    contentType?: string,
  ): Promise<void> {
    let payload: string | Uint8Array | Buffer | NodeJS.ReadableStream = ''
    if (body && typeof body === 'object' && 'getReader' in body) {
      // Convert web ReadableStream to Node stream without buffering into memory
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload = Readable.fromWeb(body as any)
    } else if (body && typeof body === 'object' && 'pipe' in body) {
      payload = body as NodeJS.ReadableStream
    } else if (body instanceof ArrayBuffer) {
      payload = Buffer.from(body)
    } else if (typeof body === 'string' || body instanceof Uint8Array || Buffer.isBuffer(body)) {
      payload = body
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        // AWS SDK v3 PutObjectCommandInput types differ slightly between Node and Web streams
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Body: payload as any,
        ContentLength: size > 0 ? size : undefined,
        ContentType: contentType,
      }),
    )
  }

  async getObject(bucket: string, key: string): Promise<S3Object> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const bytes = await res.Body?.transformToByteArray()
    const buffer = bytes ? Buffer.from(bytes) : Buffer.alloc(0)
    let contentType = res.ContentType
    if (!contentType || contentType === 'application/octet-stream') {
      const detected = detectSupportedMimeType(buffer)
      if (detected) {
        contentType = detected
      } else {
        const fileType = Bun.file(key).type
        if (fileType && fileType !== 'application/octet-stream') {
          contentType = fileType
        }
      }
    }
    return {
      buffer,
      contentType: contentType || 'application/octet-stream',
    }
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        CopySource: `${sourceBucket}/${sourceKey}`,
        Bucket: destBucket,
        Key: destKey,
      }),
    )
  }

  async downloadToFile(bucket: string, key: string, filePath: string): Promise<void> {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!res.Body) {
      return
    }

    const writeStream = fs.createWriteStream(filePath)
    try {
      await pipeline(res.Body as unknown as NodeJS.ReadableStream, writeStream)
    } catch (err) {
      if (!writeStream.closed) {
        await new Promise((resolve) => writeStream.once('close', resolve))
      }
      await fs.promises.unlink(filePath).catch(() => {})
      throw err
    }
  }

  async deleteObject(bucket: string, key: string): Promise<number> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      return 1
    } catch {
      return 0
    }
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    const keys = await this.listObjects(bucket, prefix)
    if (keys.length === 0) return 0
    const chunkSize = 1000
    for (let i = 0; i < keys.length; i += chunkSize) {
      const batch = keys.slice(i, i + chunkSize)
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((k) => ({ Key: k })),
            Quiet: true,
          },
        }),
      )
    }
    return keys.length
  }

  async headObject(bucket: string, key: string): Promise<ObjectInfo> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return {
        key,
        size: res.ContentLength ?? 0,
        lastModified: res.LastModified ?? new Date(),
        contentType: res.ContentType || 'application/octet-stream',
        eTag: res.ETag || '',
      }
    } catch (err: unknown) {
      throw new Error(`NoSuchKey: The specified key does not exist.`, { cause: err })
    }
  }

  async listObjects(bucket: string, prefix: string): Promise<string[]> {
    const keys: string[] = []
    let isTruncated = true
    let continuationToken: string | undefined = undefined

    while (isTruncated) {
      const response: ListObjectsV2CommandOutput = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )

      if (response.Contents) {
        for (const item of response.Contents) {
          if (item.Key) {
            keys.push(item.Key)
          }
        }
      }

      isTruncated = response.IsTruncated || false
      continuationToken = response.NextContinuationToken
    }

    return keys
  }

  async uploadFile(filePath: string, contentType: string): Promise<string> {
    const key = ulid() + path.extname(filePath)
    await this.uploadFileToKey(filePath, key, contentType)
    return key
  }

  async uploadFileToKey(filePath: string, key: string, contentType: string): Promise<void> {
    const file = Bun.file(filePath)
    const stream = fs.createReadStream(filePath)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentLength: file.size,
        ContentType: contentType,
      }),
    )
  }

  async presign(
    bucket: string,
    key: string,
    method: string,
    download?: boolean,
    filename?: string,
  ): Promise<string> {
    const expireHours = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '5', 10)
    const expiresInSeconds = expireHours * 3600
    const cacheTtlMs = expiresInSeconds * 1000

    const cacheKey = `${bucket}/${key}?download=${download || false}&filename=${filename || ''}`
    if (method === 'GET' && !download) {
      const cached = this.presignCache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    let url: string

    if (method === 'GET') {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: download ? buildContentDisposition(filename) : undefined,
      })
      url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } else if (method === 'PUT') {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
      })
      url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } else if (method === 'DELETE') {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
      url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } else {
      throw new Error(`Unsupported method for presign: ${method}`)
    }

    if (method === 'GET' && !download) {
      this.presignCache.set(cacheKey, url, cacheTtlMs)
    }

    return url
  }

  async presignMultipart(
    bucket: string,
    key: string,
    request: S3SignRequest,
  ): Promise<{ url: string }> {
    const expireHours = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '5', 10)
    const expiresInSeconds = expireHours * 3600

    let url: string

    if (request.method === 'PUT') {
      if (request.uploadId && request.partNumber != null) {
        const command = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: request.uploadId,
          PartNumber: request.partNumber,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      } else {
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      }
    } else if (request.method === 'POST') {
      if (request.uploadId) {
        const command = new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: request.uploadId,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      } else {
        const command = new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      }
    } else if (request.method === 'GET') {
      if (!request.uploadId) {
        throw new Error('List parts requires uploadId')
      }
      const command = new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: request.uploadId,
      })
      url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } else if (request.method === 'DELETE') {
      if (!request.uploadId) {
        throw new Error('Abort multipart upload requires uploadId')
      }
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: request.uploadId,
      })
      url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
    } else {
      throw new Error(`Unsupported method for presignMultipart: ${request.method}`)
    }

    return { url }
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }),
    )
  }

  async resolveInput(bucket: string, key: string): Promise<string> {
    return this.presign(bucket, key, 'GET')
  }
}

export class LocalStorageService implements S3Service {
  private basePath: string
  private endpoint: string

  constructor(endpoint: string, basePath: string = 'data') {
    this.endpoint = endpoint.replace(/\/$/, '')
    this.basePath = path.resolve(basePath)
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true })
    }
  }

  private getFilePath(bucket: string, key: string): string {
    const filePath = path.join(this.basePath, bucket, key)
    const rel = path.relative(this.basePath, filePath)
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      throw new Error(`Invalid path: potential path traversal detected`)
    }
    return filePath
  }

  async getObjectSize(bucket: string, key: string): Promise<number> {
    const filePath = this.getFilePath(bucket, key)
    try {
      const stats = await fs.promises.stat(filePath)
      return stats.size
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`NoSuchKey: The specified key does not exist.`, { cause: e })
      }
      throw e
    }
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream | NodeJS.ReadableStream,
    _size: number, // eslint-disable-line @typescript-eslint/no-unused-vars
    _contentType?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    const filePath = this.getFilePath(bucket, key)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    await this.writeBody(filePath, body)
  }

  /** Writes a body to disk. With `maxBytes`, a body that grows past the cap is aborted and removed. */
  private async writeBody(
    filePath: string,
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream | NodeJS.ReadableStream,
    maxBytes?: number,
  ): Promise<void> {
    const tooLarge = () =>
      new LocalMultipartError(
        'EntityTooLarge',
        `Part exceeds the maximum size of ${maxBytes} bytes`,
      )
    if (
      body &&
      typeof body === 'object' &&
      ('pipe' in body || 'getReader' in body || Symbol.asyncIterator in body)
    ) {
      try {
        const source = body as unknown as NodeJS.ReadableStream
        if (maxBytes === undefined) {
          await pipeline(source, fs.createWriteStream(filePath))
        } else {
          let received = 0
          await pipeline(
            source,
            async function* (chunks: AsyncIterable<Uint8Array>) {
              for await (const chunk of chunks) {
                received += chunk.byteLength
                if (received > maxBytes) throw tooLarge()
                yield chunk
              }
            },
            fs.createWriteStream(filePath),
          )
        }
      } catch (err) {
        await fs.promises.unlink(filePath).catch(() => {})
        throw err
      }
    } else {
      if (maxBytes !== undefined) {
        const size =
          typeof body === 'string' ? Buffer.byteLength(body) : (body as Uint8Array).byteLength
        if (size > maxBytes) throw tooLarge()
      }
      await Bun.write(filePath, body)
    }
  }

  async getObject(bucket: string, key: string): Promise<S3Object> {
    const filePath = this.getFilePath(bucket, key)
    try {
      const buffer = await fs.promises.readFile(filePath)
      return {
        buffer,
        contentType: Bun.file(filePath).type || 'application/octet-stream',
      }
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`NoSuchKey: The specified key does not exist.`, { cause: e })
      }
      throw e
    }
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    const srcPath = this.getFilePath(sourceBucket, sourceKey)
    const destPath = this.getFilePath(destBucket, destKey)
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    await fs.promises.copyFile(srcPath, destPath)
  }

  async downloadToFile(bucket: string, key: string, filePath: string): Promise<void> {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const srcPath = this.getFilePath(bucket, key)
    await fs.promises.copyFile(srcPath, filePath)
  }

  async deleteObject(bucket: string, key: string): Promise<number> {
    const filePath = this.getFilePath(bucket, key)
    try {
      await fs.promises.unlink(filePath)
      return 1
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        // Ignore if file doesn't exist
        return 0
      }
      throw e
    }
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    // Get count of files before deleting
    const keys = await this.listObjects(bucket, prefix)
    if (keys.length === 0) return 0

    const dirPath = this.getFilePath(bucket, prefix)
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true })
      return keys.length
    } catch (e: unknown) {
      if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        return 0
      }
      throw e
    }
  }

  async headObject(bucket: string, key: string): Promise<ObjectInfo> {
    const filePath = this.getFilePath(bucket, key)
    try {
      const stats = await fs.promises.stat(filePath)

      // Simple hash to simulate ETag
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
        throw new Error(`NoSuchKey: The specified key does not exist.`, { cause: e })
      }
      throw e
    }
  }

  async listObjects(bucket: string, prefix: string): Promise<string[]> {
    const bucketDir = path.join(this.basePath, bucket)
    const keys: string[] = []

    if (!fs.existsSync(bucketDir)) {
      return keys
    }

    const walkDir = async (currentDir: string) => {
      const files = await fs.promises.readdir(currentDir)
      for (const file of files) {
        const fullPath = path.join(currentDir, file)
        const stat = await fs.promises.stat(fullPath)

        if (stat.isDirectory()) {
          await walkDir(fullPath)
        } else {
          // Get relative path from bucket dir
          const relPath = path.relative(bucketDir, fullPath)
          // Normalise separators
          const key = relPath.split(path.sep).join('/')
          if (key.startsWith(prefix)) {
            keys.push(key)
          }
        }
      }
    }

    await walkDir(bucketDir)
    return keys
  }

  async uploadFile(filePath: string, contentType: string): Promise<string> {
    const key = ulid() + path.extname(filePath)
    await this.uploadFileToKey(filePath, key, contentType)
    return key
  }

  async uploadFileToKey(
    filePath: string,
    key: string,
    _contentType: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    // using a default bucket for direct upload, or the user has to supply it
    // S3StorageService uses this.bucket
    const bucket = process.env.S3_BUCKET || 'shumai'
    const destPath = this.getFilePath(bucket, key)
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    await fs.promises.copyFile(filePath, destPath)
  }

  async presign(
    bucket: string,
    key: string,
    method: string,
    download?: boolean,
    filename?: string,
  ): Promise<string> {
    if (method !== 'GET' && method !== 'PUT') {
      throw new Error(`Invalid method: ${method}`)
    }
    if (method === 'PUT') {
      return `${this.endpoint}${signLocalUrl(bucket, key)}`
    }
    let url = `${this.endpoint}/files/${bucket}/${key}`
    if (download) {
      url += '?download=1'
      if (filename) {
        url += `&filename=${encodeURIComponent(filename)}`
      }
    }
    return url
  }

  async presignMultipart(
    bucket: string,
    key: string,
    request: S3SignRequest,
  ): Promise<{ url: string }> {
    const { method, uploadId, partNumber } = request
    if (method === 'PUT' && !(uploadId && partNumber != null)) {
      return { url: `${this.endpoint}${signLocalUrl(bucket, key)}` }
    }
    if (!['PUT', 'POST', 'GET', 'DELETE'].includes(method)) {
      throw new Error(`Unsupported method for presignMultipart: ${method}`)
    }
    // Part uploads, complete (POST with id), list (GET) and abort (DELETE) need an upload id;
    // POST without one creates the upload. Each URL is signed for exactly this operation.
    if (uploadId) assertValidUploadId(uploadId)
    else if (method !== 'POST')
      throw new LocalMultipartError('InvalidArgument', 'Missing upload id')
    if (partNumber != null) assertValidPartNumber(partNumber)
    this.getFilePath(bucket, key)
    return {
      url: `${this.endpoint}${signLocalUrl(bucket, key, { method, uploadId, partNumber })}`,
    }
  }

  /** Parts live outside the bucket tree, scoped to the object key so an id cannot cross objects. */
  private getUploadDir(bucket: string, key: string, uploadId: string): string {
    assertValidUploadId(uploadId)
    this.getFilePath(bucket, key)
    const scope = crypto.createHash('sha256').update(`${bucket}/${key}`).digest('hex').slice(0, 32)
    return path.join(this.basePath, LOCAL_MULTIPART_DIR, scope, uploadId)
  }

  private async getPartInfo(partPath: string, partNumber: number): Promise<LocalPartInfo> {
    const stats = await fs.promises.stat(partPath)
    const etag = `"${crypto.createHash('md5').update(`${partNumber}:${stats.size}:${stats.mtimeMs}`).digest('hex')}"`
    return { partNumber, size: stats.size, etag, lastModified: stats.mtime }
  }

  async createMultipartUpload(bucket: string, key: string): Promise<string> {
    const uploadId = ulid()
    await fs.promises.mkdir(this.getUploadDir(bucket, key, uploadId), { recursive: true })
    return uploadId
  }

  /** Stores one part as its own file (via temp + rename, so a retried part replaces it atomically). */
  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    body: Parameters<S3Service['putObject']>[2],
    maxBytes: number = maxLocalPartSize(),
  ): Promise<LocalPartInfo> {
    assertValidPartNumber(partNumber)
    const dir = this.getUploadDir(bucket, key, uploadId)
    if (!fs.existsSync(dir)) {
      throw new LocalMultipartError('NoSuchUpload', 'The specified upload does not exist')
    }
    const partPath = path.join(dir, `part-${partNumber}`)
    const tmpPath = `${partPath}.${ulid()}.tmp`
    try {
      await this.writeBody(tmpPath, body, maxBytes)
      await fs.promises.rename(tmpPath, partPath)
    } catch (err) {
      await fs.promises.unlink(tmpPath).catch(() => {})
      throw err
    }
    return this.getPartInfo(partPath, partNumber)
  }

  async listParts(bucket: string, key: string, uploadId: string): Promise<LocalPartInfo[]> {
    const dir = this.getUploadDir(bucket, key, uploadId)
    let names: string[]
    try {
      names = await fs.promises.readdir(dir)
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new LocalMultipartError('NoSuchUpload', 'The specified upload does not exist')
      }
      throw e
    }
    const parts: LocalPartInfo[] = []
    for (const name of names) {
      const match = /^part-(\d+)$/.exec(name)
      if (match) parts.push(await this.getPartInfo(path.join(dir, name), Number(match[1])))
    }
    return parts.sort((a, b) => a.partNumber - b.partNumber)
  }

  /**
   * Concatenates the listed parts, in the given (ascending) order, into the final object. The
   * result is built in a temp file and renamed into place, so readers never see a partial object.
   *
   * Completion is serialized per upload with a lock file and is idempotent: once finished, a
   * retried or concurrent complete returns the original result as long as the final object is still
   * the size recorded in the completion marker.
   */
  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag?: string }[],
    lockWaitMs: number = 5 * 60 * 1000,
  ): Promise<{ etag: string; size: number }> {
    if (parts.length === 0) {
      throw new LocalMultipartError('InvalidPart', 'At least one part is required')
    }
    const dir = this.getUploadDir(bucket, key, uploadId)
    const release = await this.acquireCompleteLock(`${dir}.lock`, lockWaitMs)
    try {
      return await this.completeLocked(bucket, key, uploadId, parts, dir)
    } finally {
      await release()
    }
  }

  private async acquireCompleteLock(
    lockPath: string,
    waitMs: number,
  ): Promise<() => Promise<void>> {
    const deadline = Date.now() + waitMs
    for (;;) {
      try {
        await (await fs.promises.open(lockPath, 'wx')).close()
        return async () => {
          await fs.promises.rm(lockPath, { force: true })
        }
      } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException).code
        if (code === 'ENOENT') {
          throw new LocalMultipartError('NoSuchUpload', 'The specified upload does not exist')
        }
        if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EBUSY') throw e
      }
      const stats = await fs.promises.stat(lockPath).catch(() => null)
      if (stats && Date.now() - stats.mtimeMs > COMPLETE_LOCK_STALE_MS) {
        await fs.promises.rm(lockPath, { force: true }) // left behind by a crashed process
        continue
      }
      if (Date.now() >= deadline) {
        throw new LocalMultipartError(
          'OperationAborted',
          'Another complete request for this upload is still running',
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  /** The recorded result of a finished upload, if its final object is still intact. */
  private async readCompletion(
    donePath: string,
    finalPath: string,
    parts: { partNumber: number; etag?: string }[],
  ): Promise<{ etag: string; size: number } | null> {
    try {
      const marker = JSON.parse(await fs.promises.readFile(donePath, 'utf8')) as {
        etag: string
        size: number
        parts: { partNumber: number; etag: string }[]
      }
      const unquote = (etag: string) => etag.replace(/^"|"$/g, '')
      const sameParts =
        marker.parts.length === parts.length &&
        marker.parts.every((m, i) => {
          const asked = parts[i]
          return (
            asked.partNumber === m.partNumber &&
            (!asked.etag || unquote(asked.etag) === unquote(m.etag))
          )
        })
      if (!sameParts) return null
      const { size } = await fs.promises.stat(finalPath)
      return size === marker.size ? { etag: marker.etag, size: marker.size } : null
    } catch {
      return null
    }
  }

  private async completeLocked(
    bucket: string,
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag?: string }[],
    dir: string,
  ): Promise<{ etag: string; size: number }> {
    const finalPath = this.getFilePath(bucket, key)
    let listed: LocalPartInfo[]
    try {
      listed = await this.listParts(bucket, key, uploadId)
    } catch (e) {
      if (e instanceof LocalMultipartError && e.code === 'NoSuchUpload') {
        const done = await this.readCompletion(`${dir}.done`, finalPath, parts)
        if (done) return done
      }
      throw e
    }
    const stored = new Map(listed.map((p) => [p.partNumber, p]))
    const unquote = (etag: string) => etag.replace(/^"|"$/g, '')
    let previous = 0
    let expectedSize = 0
    for (const part of parts) {
      assertValidPartNumber(part.partNumber)
      if (part.partNumber <= previous) {
        throw new LocalMultipartError('InvalidPart', 'Parts must be in ascending order')
      }
      previous = part.partNumber
      const info = stored.get(part.partNumber)
      if (!info || (part.etag && unquote(part.etag) !== unquote(info.etag))) {
        throw new LocalMultipartError(
          'InvalidPart',
          `Part ${part.partNumber} is missing or changed`,
        )
      }
      expectedSize += info.size
    }

    await fs.promises.mkdir(path.dirname(finalPath), { recursive: true })
    const assembledPath = path.join(dir, `assembled.${ulid()}.tmp`)
    const handle = await fs.promises.open(assembledPath, 'w')
    try {
      for (const part of parts) {
        for await (const chunk of fs.createReadStream(path.join(dir, `part-${part.partNumber}`))) {
          await handle.write(chunk as Buffer)
        }
      }
      const { size } = await handle.stat()
      if (size !== expectedSize) {
        throw new Error(`Assembled size ${size} does not match expected ${expectedSize}`)
      }
      await handle.close()
      await fs.promises.rename(assembledPath, finalPath)
    } catch (err) {
      await handle.close().catch(() => {})
      await fs.promises.unlink(assembledPath).catch(() => {})
      throw err
    }
    const etag = `"${crypto
      .createHash('md5')
      .update(parts.map((p) => stored.get(p.partNumber)!.etag).join(''))
      .digest('hex')}-${parts.length}"`
    // Recorded before the parts go away so a retried complete can still answer.
    const marker = {
      etag,
      size: expectedSize,
      parts: parts.map((p) => ({ partNumber: p.partNumber, etag: stored.get(p.partNumber)!.etag })),
    }
    await fs.promises.writeFile(`${dir}.done`, JSON.stringify(marker)).catch(() => {})
    await this.removeUploadDir(dir)
    return { etag, size: expectedSize }
  }

  private async removeUploadDir(dir: string): Promise<void> {
    // Best effort: on Windows a just-read file can still be briefly locked (EBUSY).
    await fs.promises
      .rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
      .catch(() => {})
    await fs.promises.rmdir(path.dirname(dir)).catch(() => {}) // drop the key scope dir once empty
  }

  /** Discards the upload's staged parts. The final object, if it exists, is never touched. */
  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    if (UPLOAD_ID_PATTERN.test(uploadId)) {
      await this.removeUploadDir(this.getUploadDir(bucket, key, uploadId))
    }
  }

  /**
   * Removes staged uploads (and completion markers / stale locks) under `.multipart` whose newest
   * file is older than `maxAgeMs`. Only the staging tree is touched, never a stored object.
   */
  async sweepStaleMultipartUploads(
    maxAgeMs: number = MULTIPART_STALE_MS,
    nowMs: number = Date.now(),
  ): Promise<number> {
    const root = path.join(this.basePath, LOCAL_MULTIPART_DIR)
    const newestMtime = async (entry: string): Promise<number | null> => {
      try {
        const stats = await fs.promises.stat(entry)
        let newest = stats.mtimeMs
        if (stats.isDirectory()) {
          for (const name of await fs.promises.readdir(entry)) {
            const child = await fs.promises.stat(path.join(entry, name)).catch(() => null)
            if (child) newest = Math.max(newest, child.mtimeMs)
          }
        }
        return newest
      } catch {
        return null
      }
    }
    let scopes: string[]
    try {
      scopes = await fs.promises.readdir(root)
    } catch {
      return 0
    }
    let removed = 0
    for (const scope of scopes) {
      if (!/^[0-9a-f]{32}$/.test(scope)) continue
      const scopeDir = path.join(root, scope)
      const entries = await fs.promises.readdir(scopeDir).catch(() => [] as string[])
      for (const name of entries) {
        const entry = path.join(scopeDir, name)
        const newest = await newestMtime(entry)
        if (newest === null || nowMs - newest < maxAgeMs) continue
        await fs.promises.rm(entry, { recursive: true, force: true }).catch(() => {})
        removed++
      }
      await fs.promises.rmdir(scopeDir).catch(() => {})
    }
    return removed
  }

  /** Starts the low-frequency orphan sweep; returns a function that stops it. */
  startMultipartSweep(
    intervalMs: number = MULTIPART_SWEEP_INTERVAL_MS,
    maxAgeMs: number = MULTIPART_STALE_MS,
  ): () => void {
    const run = () =>
      this.sweepStaleMultipartUploads(maxAgeMs).catch((err) => {
        console.warn('Local multipart sweep failed:', err)
      })
    void run()
    const timer = setInterval(run, intervalMs)
    timer.unref?.()
    return () => clearInterval(timer)
  }

  async resolveInput(bucket: string, key: string): Promise<string> {
    const filePath = this.getFilePath(bucket, key)
    if (fs.existsSync(filePath)) {
      return filePath
    }
    return this.presign(bucket, key, 'GET')
  }
}

export function getStorageBackend(): 's3' | 'local' {
  return (process.env.STORAGE_BACKEND as 's3' | 'local') || 'local'
}

const storageBackend = getStorageBackend()
const port = process.env.SHUMAI_SERVER_PORT || '3000'
const s3Endpoint = process.env.AWS_ENDPOINT_URL_S3 || `http://localhost:${port}`

export const s3Service: S3Service =
  storageBackend === 's3'
    ? new S3StorageService(
        s3Endpoint,
        process.env.S3_ACCESS_KEY_ID || 'minioadmin',
        process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
        process.env.S3_BUCKET || 'shumai',
        process.env.S3_REGION || 'auto',
      )
    : new LocalStorageService(s3Endpoint)
