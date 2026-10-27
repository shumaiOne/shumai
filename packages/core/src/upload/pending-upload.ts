import * as crypto from 'crypto'
import { HTTPException } from 'hono/http-exception'
import { ulid } from 'ulid'
import { UPLOAD_TTL_SECONDS } from '@shumai/operations'
import { s3Service } from '@shumai/core/src/s3/s3'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'

/** What an upload creates once its file is in storage: a new file, or a new version of one. */
export type PendingUploadKind = 'file' | 'version'

/** An upload that was started but not finished yet. Carried by its signed upload ID. */
export interface PendingUpload {
  kind: PendingUploadKind
  /** The user who started it; only they can finish it. */
  userId: string
  /** The folder (file uploads) or the file / version stack (version uploads). */
  parentId: string
  name: string
  /** Storage key the file is uploaded to. */
  key: string
  contentType: string
  /** Creation Context metadata to record on the new file. */
  metadata?: Record<string, unknown>
  /** Expiry, in milliseconds since the epoch. */
  expiresAt: number
}

export interface StartedUpload {
  /** Opaque, signed ID that finishes the upload. */
  uploadId: string
  /** Presigned URL to PUT the file's bytes to. */
  uploadUrl: string
  key: string
  expiresAt: Date
}

const SIGNING_CONTEXT = 'shumai-pending-upload:v1'

function signingSecret(): string {
  return process.env.BETTER_AUTH_SECRET || 'shumai-local-storage-secret'
}

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${SIGNING_CONTEXT}:${payload}`)
    .digest('base64url')
}

function invalid(): HTTPException {
  return new HTTPException(400, {
    message: 'Invalid upload ID: pass the uploadId returned by create_file or create_version.',
  })
}

/**
 * Two-step uploads for clients that send file bytes themselves (e.g. MCP clients): `start`
 * returns a presigned URL and a signed upload ID; once the bytes are uploaded, `read` checks
 * the ID so the caller can create the asset. Nothing is written to the database until then,
 * so abandoned uploads leave no half-created assets behind.
 */
export class PendingUploadService {
  /** How long the upload URL and the upload ID stay valid. */
  readonly ttlSeconds = UPLOAD_TTL_SECONDS

  async start(params: Omit<PendingUpload, 'key' | 'expiresAt'>): Promise<StartedUpload> {
    const key = `files/${ulid()}/${sanitizeFilename(params.name)}`
    const expiresAt = Date.now() + this.ttlSeconds * 1000
    const uploadUrl = await s3Service.presign(
      this.bucket(),
      key,
      'PUT',
      undefined,
      undefined,
      undefined,
      this.ttlSeconds,
    )
    const pending: PendingUpload = { ...params, key, expiresAt }
    const payload = Buffer.from(JSON.stringify(pending)).toString('base64url')
    return {
      uploadId: `${payload}.${sign(payload)}`,
      uploadUrl,
      key,
      expiresAt: new Date(expiresAt),
    }
  }

  /** Verifies an upload ID for `userId` and returns the upload it describes. */
  read(uploadId: string, userId: string): PendingUpload {
    const [payload, signature, ...rest] = uploadId.split('.')
    if (!payload || !signature || rest.length > 0) throw invalid()
    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw invalid()
    }

    let pending: PendingUpload
    try {
      pending = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PendingUpload
    } catch {
      throw invalid()
    }
    if (pending.userId !== userId) {
      throw new HTTPException(403, { message: 'This upload was started by another user.' })
    }
    if (Date.now() > pending.expiresAt) {
      throw new HTTPException(400, {
        message: 'This upload has expired. Start a new one with create_file or create_version.',
      })
    }
    return pending
  }

  /** Size of the uploaded file, or null when nothing has been uploaded to the key yet. */
  async uploadedSize(key: string): Promise<number | null> {
    try {
      const info = await s3Service.headObject(this.bucket(), key)
      return info.size
    } catch {
      return null
    }
  }

  private bucket(): string {
    return process.env.S3_BUCKET || 'shumai'
  }
}

export const pendingUploadService = new PendingUploadService()
