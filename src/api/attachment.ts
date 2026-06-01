import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { postAttachmentRequestSchema } from '@shumai/dtos'
import { assetService } from '@/services/asset/asset'
import { s3Service } from '@/services/s3/s3'
import { AssetType } from '@/generated/prisma/client'
import { ulid } from 'ulid'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'
import type { Prisma } from '@/generated/prisma/client'

type User = Prisma.UserGetPayload<Record<string, never>>

const route = new Hono<{ Variables: { user: User } }>().post(
  '/projects/:projectId/attachments',
  zValidator('json', postAttachmentRequestSchema),
  async (c) => {
    const projectId = c.req.param('projectId')
    const user = c.get('user')
    const req = c.req.valid('json')

    await authzService.hasPermission({
      user,
      permission: Permission.Edit,
      type: ResourceType.Project,
      id: projectId,
    })

    const key = `attachments/${ulid()}/${req.fileName}`

    const assetInfo = await assetService.createAsset({
      name: req.fileName,
      type: AssetType.attachment,
      projectId: projectId,
      key: key,
      sizeByte: req.size,
      contentType: req.contentType,
      creatorId: user.id,
    })

    const uploadUrl = await s3Service.presign(process.env.S3_BUCKET || 'shumai', key, 'PUT')

    return c.json({
      id: assetInfo.id,
      uploadUrl: uploadUrl,
    })
  },
)

export default route
