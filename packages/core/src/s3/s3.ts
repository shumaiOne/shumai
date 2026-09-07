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
import { ulid } from 'ulid'
import { LruTtlCache } from '../cache/lru-ttl-cache'
import { detectSupportedMimeType } from '../utils/mime'

export function signLocalUrl(bucket: string, key: string): string {
  const secret = process.env.BETTER_AUTH_SECRET || 'shumai-local-storage-secret'
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(`${bucket}/${key}`)
  const signature = hmac.digest('hex')
  return `/api/upload/local?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&Signature=${signature}`
}

export function verifyLocalUrlSignature(bucket: string, key: string, signature: string): boolean {
  const secret = process.env.BETTER_AUTH_SECRET || 'shumai-local-storage-secret'
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(`${bucket}/${key}`)
  const expected = hmac.digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
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

export interface S3Object {
  buffer: Buffer
  contentType: string
}

export interface S3Service {
  getObjectSize: (bucket: string, key: string) => Promise<number>
  putObject: (
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream,
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
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream,
    size: number,
    contentType?: string,
  ): Promise<void> {
    let payload: string | Uint8Array | Buffer = ''
    if (body && typeof body === 'object' && 'getReader' in body) {
      const response = new Response(body as ReadableStream)
      payload = Buffer.from(await response.arrayBuffer())
    } else if (body instanceof ArrayBuffer) {
      payload = Buffer.from(body)
    } else if (typeof body === 'string' || body instanceof Uint8Array || Buffer.isBuffer(body)) {
      payload = body
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: payload,
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
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const bytes = await res.Body?.transformToByteArray()
    if (bytes) {
      await Bun.write(filePath, bytes)
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
    const buffer = Buffer.from(await file.arrayBuffer())
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
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
    const cacheMinutes = Math.round((expireHours * 60 * 2) / 3)
    const cacheTtlMs = cacheMinutes * 60 * 1000

    const cacheKey = `${bucket}:${key}`

    if (method === 'GET' && !download) {
      const cached = this.presignCache.get(cacheKey)
      if (cached) return cached
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
      if (request.uploadId) {
        const command = new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: request.uploadId,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      } else {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      }
    } else if (request.method === 'DELETE') {
      if (request.uploadId) {
        const command = new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: request.uploadId,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      } else {
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
        url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds })
      }
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
    if (!filePath.startsWith(this.basePath)) {
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
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream,
    _size: number, // eslint-disable-line @typescript-eslint/no-unused-vars
    _contentType?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    const filePath = this.getFilePath(bucket, key)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    if (body && typeof body === 'object' && 'getReader' in body) {
      const file = Bun.file(filePath)
      const writer = file.writer()
      const reader = (body as ReadableStream<Uint8Array>).getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          await writer.write(value)
        }
      }
      await writer.end()
    } else {
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
    if (request.method === 'PUT') {
      return { url: `${this.endpoint}${signLocalUrl(bucket, key)}` }
    }
    const url = await this.presign(bucket, key, request.method)
    return { url }
  }

  async abortMultipartUpload(
    bucket: string,
    key: string,
    _uploadId: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    await this.deleteObject(bucket, key)
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
