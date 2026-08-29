import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { s3Service } from '@shumai/core/src/s3/s3'
import { readFileMimeType } from '@shumai/core/src/utils/file-mime'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { type User } from '@shumai/db'
import { Type, type TSchema } from 'typebox'
import * as fs from 'fs'
import * as path from 'path'
import { ulid } from 'ulid'

interface CreateVersionToolParams {
  parent: string
  path: string
  metadata?: Record<string, unknown> | null
}

export function createCreateVersionTool(userId: string, metadataSchema?: TSchema): AgentTool {
  const createVersionSchema = Type.Object(
    {
      parent: Type.String({
        description:
          'The parent file ID for which to create a new version. This parameter is required.',
      }),
      path: Type.String({
        description:
          'The absolute or relative local path to the file on disk. This parameter is required.',
      }),
      ...(metadataSchema ? { metadata: Type.Union([metadataSchema, Type.Null()]) } : {}),
    },
    { additionalProperties: false },
  )

  const tool: AgentTool = {
    name: 'create_version',
    label: 'Create Version',
    description:
      'Create a new version of an existing file from a local file path. ' +
      'The optional "metadata" parameter accepts only the CREATION_CONTEXT fields declared in its schema; never invent field keys, and use null for fields you do not know.',
    parameters: createVersionSchema,
    execute: async (_toolCallId, params) => {
      // The harness validates tool args against `createVersionSchema` before calling
      // execute, so `params` is guaranteed to match this shape.
      const p = params as CreateVersionToolParams
      const absolutePath = path.resolve(process.cwd(), p.path)
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Local file not found at path: ${p.path}`)
      }

      const fileSize = fs.statSync(absolutePath).size
      const mimeType = readFileMimeType(absolutePath)
      const name = path.basename(absolutePath)

      // Generate compliant S3 key matching normal file upload format
      const s3Key = `files/${ulid()}/${sanitizeFilename(name)}`
      await s3Service.uploadFileToKey(absolutePath, s3Key, mimeType)

      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: p.parent,
      })

      const asset = await assetService.createVersion({
        parentId: p.parent,
        name,
        key: s3Key,
        sizeByte: fileSize,
        contentType: mimeType,
        creatorId: userId,
        metadata: p.metadata ?? undefined,
      })

      const result = {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        size: Number(asset.sizeByte),
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
    },
  }
  return tool
}
