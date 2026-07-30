import { ObjectInfo } from '@shumai/dtos'
import { S3Client } from 'bun'
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
  presign: (bucket: string, key: string, method: string, download?: boolean) => Promise<string>
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
      accessKeyId,
      secretAccessKey,
      bucket,
    })
    this.bucket = bucket
  }

  async getObjectSize(bucket: string, key: string): Promise<number> {
    return await this.client.size(key, { bucket })
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array | ArrayBuffer | string | ReadableStream,
    _size: number,
    contentType?: string,
  ): Promise<void> {
    const payload =
      body && typeof body === 'object' && 'getReader' in body
        ? new Response(body as ReadableStream)
        : body
    await this.client.write(key, payload as string | Buffer | ArrayBuffer | Uint8Array | Response, {
      bucket,
      type: contentType,
    })
  }

  async getObject(bucket: string, key: string): Promise<S3Object> {
    const file = this.client.file(key, { bucket })
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let contentType = file.type
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
    const sourceFile = this.client.file(sourceKey, { bucket: sourceBucket })
    await this.client.write(destKey, sourceFile, { bucket: destBucket })
  }

  async downloadToFile(bucket: string, key: string, filePath: string): Promise<void> {
    const file = this.client.file(key, { bucket })
    await Bun.write(filePath, file)
  }

  async deleteObject(bucket: string, key: string): Promise<number> {
    try {
      const exists = await this.client.exists(key, { bucket })
      if (!exists) return 0
      await this.client.delete(key, { bucket })
      return 1
    } catch {
      return 0
    }
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    const keys = await this.listObjects(bucket, prefix)
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => this.deleteObject(bucket, key)))
    }
    return keys.length
  }

  async headObject(bucket: string, key: string): Promise<ObjectInfo> {
    const file = this.client.file(key, { bucket })
    const exists = await file.exists()
    if (!exists) {
      throw new Error(`NoSuchKey: The specified key does not exist.`)
    }

    // Bun.S3File doesn't expose lastModified or eTag directly in a way that matches ObjectInfo easily
    // but we can try to get them if available. For now, using defaults for fields not provided.
    return {
      key,
      size: await file.size,
      lastModified: new Date(), // Bun doesn't expose this yet via S3File
      contentType: file.type || 'application/octet-stream',
      eTag: '',
    }
  }

  async listObjects(bucket: string, prefix: string): Promise<string[]> {
    const keys: string[] = []
    let isTruncated = true
    let continuationToken: string | undefined = undefined

    while (isTruncated) {
      const response = await this.client.list({
        prefix,
        continuationToken,
      })

      if (response.contents) {
        for (const item of response.contents) {
          if (item.key) {
            keys.push(item.key)
          }
        }
      }

      isTruncated = response.isTruncated || false
      continuationToken = response.nextContinuationToken
    }

    return keys
  }

  async uploadFile(filePath: string, contentType: string): Promise<string> {
    const key = ulid() + path.extname(filePath)
    await this.uploadFileToKey(filePath, key, contentType)
    return key
  }

  async uploadFileToKey(filePath: string, key: string, contentType: string): Promise<void> {
    await this.client.write(key, Bun.file(filePath), {
      bucket: this.bucket,
      type: contentType,
    })
  }

  async presign(bucket: string, key: string, method: string, download?: boolean): Promise<string> {
    const expireHours = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '5', 10)
    const expiresInSeconds = expireHours * 3600
    // Cache time is 2/3 of expire time, rounded to minute
    const cacheMinutes = Math.round((expireHours * 60 * 2) / 3)
    const cacheTtlMs = cacheMinutes * 60 * 1000

    const cacheKey = `${bucket}:${key}`

    if (method === 'GET' && !download) {
      const cached = this.presignCache.get(cacheKey)
      if (cached) return cached
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      bucket,
      expiresIn: expiresInSeconds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: method as any,
    }

    if (download) {
      options.contentDisposition = 'attachment'
    }

    const url = this.client.presign(key, options)

    if (method === 'GET' && !download) {
      this.presignCache.set(cacheKey, url, cacheTtlMs)
    }

    return url
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

  async presign(bucket: string, key: string, method: string, download?: boolean): Promise<string> {
    if (method !== 'GET' && method !== 'PUT') {
      throw new Error(`Invalid method: ${method}`)
    }
    if (method === 'PUT') {
      return `${this.endpoint}${signLocalUrl(bucket, key)}`
    }
    let url = `${this.endpoint}/files/${bucket}/${key}`
    if (download) {
      url += '?download=1'
    }
    return url
  }
}

const storageBackend = process.env.STORAGE_BACKEND || 'local'
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
