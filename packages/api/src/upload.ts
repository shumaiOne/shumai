import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { uploadService } from '@shumai/core/src/upload/upload'
import {
  abortUploadRequestSchema,
  confirmFileUploadRequestSchema,
  createUploadTaskRequestSchema,
  localUploadQuerySchema,
  s3SignRequestSchema,
} from '@shumai/dtos'
import { paginationParamsSchema, AuditAction } from '@shumai/dtos'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { notificationService } from '@shumai/core/src/notification/notification'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { assetService } from '@shumai/core/src/asset/asset'
import { NotificationType } from '@shumai/db'
import {
  LocalMultipartError,
  LocalStorageService,
  checkLocalUrl,
  maxLocalPartSize,
  s3Service,
} from '@shumai/core/src/s3/s3'
import type { Prisma } from '@shumai/db'

type User = Prisma.UserGetPayload<Record<string, never>>

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const xmlUnescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

/** Extracts the part list from an S3 CompleteMultipartUpload request body. */
export function parseCompleteMultipartBody(xml: string) {
  const parts: { partNumber: number; etag?: string }[] = []
  for (const match of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
    const number = /<PartNumber>\s*(\d+)\s*<\/PartNumber>/.exec(match[1])
    const etag = /<ETag>([\s\S]*?)<\/ETag>/.exec(match[1])
    if (!number) throw new LocalMultipartError('InvalidArgument', 'Part is missing PartNumber')
    parts.push({
      partNumber: Number(number[1]),
      etag: etag ? xmlUnescape(etag[1].trim()) : undefined,
    })
  }
  return parts
}

const xmlResponse = (c: Context, inner: string) =>
  c.body(`<?xml version="1.0" encoding="UTF-8"?>${inner}`, 200, {
    'Content-Type': 'application/xml',
  })

function localMultipartStatus(err: LocalMultipartError): 400 | 404 | 409 | 413 {
  switch (err.code) {
    case 'NoSuchUpload':
      return 404
    case 'EntityTooLarge':
      return 413
    case 'OperationAborted':
      return 409
    default:
      return 400
  }
}

/** S3-compatible multipart operations for the local storage backend (create/part/list/complete/abort). */
async function handleLocalMultipart(
  c: Context,
  bucket: string,
  key: string,
  uploadId: string | undefined,
  partNumber: number | undefined,
) {
  if (!(s3Service instanceof LocalStorageService)) return c.text('Not found', 404)
  const method = c.req.method
  try {
    if (method === 'POST' && !uploadId) {
      const id = await s3Service.createMultipartUpload(bucket, key)
      return xmlResponse(
        c,
        `<InitiateMultipartUploadResult><Bucket>${xmlEscape(bucket)}</Bucket><Key>${xmlEscape(key)}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`,
      )
    }
    if (!uploadId) return c.text('Missing uploadId', 400)
    if (method === 'PUT') {
      if (partNumber == null) return c.text('Missing partNumber', 400)
      const declared = c.req.header('Content-Length')
      if (declared !== undefined && Number(declared) > maxLocalPartSize()) {
        return c.text('EntityTooLarge: Part exceeds the maximum part size', 413)
      }
      const body = c.req.raw.body ?? (await c.req.arrayBuffer())
      const part = await s3Service.uploadPart(bucket, key, uploadId, partNumber, body)
      c.header('ETag', part.etag)
      return c.body(null, 200)
    }
    if (method === 'POST') {
      const parts = parseCompleteMultipartBody(await c.req.text())
      const done = await s3Service.completeMultipartUpload(bucket, key, uploadId, parts)
      return xmlResponse(
        c,
        `<CompleteMultipartUploadResult><Bucket>${xmlEscape(bucket)}</Bucket><Key>${xmlEscape(key)}</Key><ETag>${xmlEscape(done.etag)}</ETag></CompleteMultipartUploadResult>`,
      )
    }
    if (method === 'GET') {
      const parts = await s3Service.listParts(bucket, key, uploadId)
      const items = parts
        .map(
          (p) =>
            `<Part><PartNumber>${p.partNumber}</PartNumber><LastModified>${p.lastModified.toISOString()}</LastModified><ETag>${xmlEscape(p.etag)}</ETag><Size>${p.size}</Size></Part>`,
        )
        .join('')
      return xmlResponse(
        c,
        `<ListPartsResult><Bucket>${xmlEscape(bucket)}</Bucket><Key>${xmlEscape(key)}</Key><UploadId>${xmlEscape(uploadId)}</UploadId><IsTruncated>false</IsTruncated>${items}</ListPartsResult>`,
      )
    }
    await s3Service.abortMultipartUpload(bucket, key, uploadId)
    return c.body(null, 204)
  } catch (err) {
    if (err instanceof LocalMultipartError) {
      return c.text(`${err.code}: ${err.message}`, localMultipartStatus(err))
    }
    throw err
  }
}

export const localUploadRoute = new Hono().on(
  ['PUT', 'POST', 'GET', 'DELETE'],
  '/upload/local',
  zValidator('query', localUploadQuerySchema),
  async (c) => {
    const { bucket, key, Signature, uploadId, partNumber, exp } = c.req.valid('query')
    // A plain PUT without an upload id is the whole-object upload (signature over bucket/key only).
    // Every other request is a multipart operation, signed for its method, upload id and part number.
    const method = c.req.method
    const multipart = method !== 'PUT' || uploadId !== undefined
    const params = multipart ? { method, uploadId, partNumber } : undefined

    const check = checkLocalUrl(bucket, key, Signature, params, exp)
    if (check === 'expired') return c.text('URL expired', 403)
    if (check !== 'ok') return c.text('Invalid signature', 403)

    if (multipart) return handleLocalMultipart(c, bucket, key, uploadId, partNumber)

    const contentType = c.req.header('Content-Type')
    let finalContentType = contentType
    const contentLength = parseInt(c.req.header('Content-Length') || '0', 10)

    if (contentType?.includes('multipart/form-data')) {
      const body = await c.req.parseBody()
      const file = body['file'] as File
      if (!file) {
        return c.text('No file uploaded', 400)
      }
      finalContentType = file.type || 'application/octet-stream'
      const payload =
        typeof file.stream === 'function' ? file.stream() : Buffer.from(await file.arrayBuffer())
      await s3Service.putObject(bucket, key, payload, file.size, finalContentType)
    } else {
      const body = c.req.raw.body ?? (await c.req.arrayBuffer())
      await s3Service.putObject(bucket, key, body, contentLength, finalContentType)
    }

    return c.json({ success: true })
  },
)

const route = new Hono<{ Variables: { user: User } }>()
  .get('/teams/:teamId/upload/tasks', zValidator('query', paginationParamsSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const params = c.req.valid('query')

    await authzService.hasPermission({
      user,
      permission: Permission.Read,
      type: ResourceType.Team,
      id: teamId,
    })

    const tasks = await uploadService.listUploadTasks(user.id, params)
    return c.json(tasks)
  })
  .post(
    '/teams/:teamId/upload/tasks',
    zValidator('json', createUploadTaskRequestSchema),
    async (c) => {
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: req.parentId,
      })

      const resp = await uploadService.createUploadTask(user.id, req)
      return c.json(resp)
    },
  )
  .patch(
    '/teams/:teamId/upload/tasks/:taskId',
    zValidator('json', confirmFileUploadRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const taskId = c.req.param('taskId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: req.fileId,
      })

      await uploadService.confirmFileUpload(user.id, taskId, req)

      if (!req.errorMessage) {
        const context = await assetService.getAssetContext(req.fileId)

        await notificationService.create({
          type: NotificationType.successful_file_uploaded,
          teamId: teamId,
          projectId: context.projectId,
          creatorId: user.id,
          assetId: req.fileId,
          taskId: taskId,
        })

        await auditLogService.logAction({
          action: AuditAction.file_create,
          teamId: teamId,
          userId: user.id,
          projectId: context.projectId,
          itemId: req.fileId,
        })
      }

      return c.json({ success: true })
    },
  )
  .post('/teams/:teamId/upload/sign', zValidator('json', s3SignRequestSchema), async (c) => {
    const teamId = c.req.param('teamId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Asset,
      id: req.fileId,
    })

    const resp = await uploadService.signS3Upload(teamId, user.id, req)
    return c.json(resp)
  })
  .post(
    '/teams/:teamId/upload/tasks/:taskId/abort',
    zValidator('json', abortUploadRequestSchema),
    async (c) => {
      const teamId = c.req.param('teamId')
      const taskId = c.req.param('taskId')
      const user = c.get('user')
      const req = c.req.valid('json')

      await authzService.hasPermission({
        user,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: req.fileId,
      })

      const resp = await uploadService.abortUpload(teamId, user.id, taskId, req)
      return c.json(resp)
    },
  )

export default route
