import { type AgentTool } from '@earendil-works/pi-agent-core'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType, readFileMimeType } from '@shumai/core/src/utils/file-mime'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { type User } from '@shumai/db'
import { AuditAction } from '@shumai/dtos'
import { Type, type TSchema } from 'typebox'
import * as fs from 'fs'
import * as path from 'path'
import { ulid } from 'ulid'

interface CreateFileToolParams {
  parent: string
  path: string | null
  data: { name: string; content: string } | null
  metadata?: Record<string, unknown> | null
}

function assertExactlyOneSource(params: CreateFileToolParams) {
  const hasPath = params.path !== null
  const hasData = params.data !== null
  if (hasPath === hasData) {
    throw new Error('Provide exactly one of "path" (a local file) or "data" (name and content).')
  }
  return hasPath ? params.path! : params.data!
}

export function createCreateFileTool(
  userId: string,
  metadataSchema?: TSchema,
  agentContext?: { teamId?: string; agentId?: string },
): AgentTool {
  const createFileSchema = Type.Object(
    {
      parent: Type.String({
        description:
          'The parent folder ID under which to create the file. This parameter is required.',
      }),
      path: Type.Union([
        Type.String({
          description:
            'The absolute or relative local path to an existing file on disk. Provide a value here OR in "data", but not both. Use null if you are providing "data".',
        }),
        Type.Null(),
      ]),
      data: Type.Union([
        Type.Object(
          {
            name: Type.String({
              minLength: 1,
              description:
                'The desired name for the new file, including its extension (e.g. "notes.md").',
            }),
            content: Type.String({
              description: 'The full content of the file as a plain string.',
            }),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
      ...(metadataSchema ? { metadata: Type.Union([metadataSchema, Type.Null()]) } : {}),
    },
    { additionalProperties: false },
  )

  const tool: AgentTool = {
    name: 'create_file',
    label: 'Create File',
    description:
      'Create a new file under a folder. You MUST choose exactly ONE creation method: ' +
      '(1) provide "path" to upload an existing local file, OR ' +
      '(2) provide "data" with name and content to create a new text file. ' +
      'Set the unused parameter to null. ' +
      'The optional "metadata" parameter accepts only the CREATION_CONTEXT fields declared in its schema; never invent field keys, and use null for fields you do not know.',
    parameters: createFileSchema,
    execute: async (_toolCallId, params) => {
      // The harness validates tool args against `createFileSchema` before calling
      // execute, so `params` is guaranteed to match this shape.
      const p = params as CreateFileToolParams
      const source = assertExactlyOneSource(p)

      let name: string
      let size: number
      let mimeType: string
      let s3Key: string

      if (typeof source === 'string') {
        // Branch A: upload an existing local file
        const absolutePath = path.resolve(process.cwd(), source)
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`Local file not found at path: ${source}`)
        }

        name = path.basename(absolutePath)
        size = fs.statSync(absolutePath).size
        mimeType = readFileMimeType(absolutePath)

        // Generate compliant S3 key matching normal file upload format
        s3Key = `files/${ulid()}/${sanitizeFilename(name)}`
        await s3Service.uploadFileToKey(absolutePath, s3Key, mimeType)
      } else {
        // Branch B: create the file directly from provided name and content
        name = sanitizeFilename(source.name)
        const content = Buffer.from(source.content, 'utf-8')
        size = content.byteLength
        mimeType = getFileMimeType(null, source.name, 'text/plain')

        s3Key = `files/${ulid()}/${name}`
        await s3Service.putObject(process.env.S3_BUCKET || 'shumai', s3Key, content, size, mimeType)
      }

      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: p.parent,
      })

      const asset = await assetService.createFile({
        parentId: p.parent,
        name,
        key: s3Key,
        sizeByte: size,
        contentType: mimeType,
        creatorId: userId,
        agentId: agentContext?.agentId,
        metadata: p.metadata ?? undefined,
      })

      if (agentContext?.teamId) {
        await auditLogService.logAction({
          action: AuditAction.file_create,
          teamId: agentContext.teamId,
          userId,
          agentId: agentContext.agentId,
          projectId: asset.projectId ?? undefined,
          itemId: asset.id,
        })
      }

      const result = {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        size: Number(asset.sizeByte),
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: {},
      }
    },
  }
  return tool
}
