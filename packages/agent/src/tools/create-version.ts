import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'
import * as fs from 'fs'
import * as path from 'path'
import { s3Service } from '@shumai/core/src/s3/s3'
import { readFileMimeType } from '@shumai/core/src/utils/file-mime'
import { ulid } from 'ulid'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'

const createVersionSchema = Type.Object({
  parent: Type.String({
    description:
      'The parent file ID for which to create a new version. This parameter is required.',
  }),
  path: Type.String({
    description:
      'The absolute or relative local path to the file on disk. This parameter is required.',
  }),
})

export function createCreateVersionTool(userId: string): AgentTool<typeof createVersionSchema> {
  return {
    name: 'create_version',
    label: 'Create Version',
    description: 'Create a new version of an existing file from a local file path.',
    parameters: createVersionSchema,
    execute: async (_toolCallId, params) => {
      const absolutePath = path.resolve(process.cwd(), params.path)
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Local file not found at path: ${params.path}`)
      }

      const fileSize = fs.statSync(absolutePath).size
      const mimeType = readFileMimeType(absolutePath)

      // Generate compliant S3 key matching normal file upload format
      const s3Key = `files/${ulid()}/${sanitizeFilename(path.basename(absolutePath))}`
      await s3Service.uploadFileToKey(absolutePath, s3Key, mimeType)

      const result = await executeAgentToolWorkflow({
        toolName: 'create_version',
        args: {
          parent: params.parent,
          s3Key,
          name: path.basename(absolutePath),
          size: fileSize,
          contentType: mimeType,
        },
        userId,
        assetId: params.parent,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        details: result,
      }
    },
  }
}
