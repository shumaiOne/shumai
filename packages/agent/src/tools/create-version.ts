import { Type, type TSchema } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'
import * as fs from 'fs'
import * as path from 'path'
import { s3Service } from '@shumai/core/src/s3/s3'
import { readFileMimeType } from '@shumai/core/src/utils/file-mime'
import { ulid } from 'ulid'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'

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

      // Generate compliant S3 key matching normal file upload format
      const s3Key = `files/${ulid()}/${sanitizeFilename(path.basename(absolutePath))}`
      await s3Service.uploadFileToKey(absolutePath, s3Key, mimeType)

      const result = await executeAgentToolWorkflow({
        toolName: 'create_version',
        args: {
          parent: p.parent,
          s3Key,
          name: path.basename(absolutePath),
          size: fileSize,
          contentType: mimeType,
          ...(p.metadata ? { metadata: p.metadata } : {}),
        },
        userId,
        assetId: p.parent,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
    },
  }
  return tool
}
