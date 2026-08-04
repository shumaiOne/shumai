import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'
import * as fs from 'fs'
import * as path from 'path'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType, readFileMimeType } from '@shumai/core/src/utils/file-mime'
import { ulid } from 'ulid'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'

const createFileSchema = Type.Object({
  parent: Type.String({
    description: 'The parent folder ID under which to create the file. This parameter is required.',
  }),
  path: Type.Optional(
    Type.String({
      description:
        'The absolute or relative local path to an existing file on disk. Provide either this or "data", but not both.',
    }),
  ),
  data: Type.Optional(
    Type.Object({
      name: Type.String({
        minLength: 1,
        description:
          'The desired name for the new file, including its extension (e.g. "notes.md").',
      }),
      content: Type.String({
        description: 'The full content of the file as a plain string.',
      }),
    }),
  ),
})

function assertExactlyOneSource(params: {
  path?: string
  data?: { name: string; content: string }
}) {
  const hasPath = params.path !== undefined
  const hasData = params.data !== undefined
  if (hasPath === hasData) {
    throw new Error('Provide exactly one of "path" (a local file) or "data" (name and content).')
  }
  return hasPath ? params.path! : params.data!
}

export function createCreateFileTool(userId: string): AgentTool<typeof createFileSchema> {
  return {
    name: 'create_file',
    label: 'Create File',
    description:
      'Create a new file in a specified parent folder, either from a local file path or directly from name and content.',
    parameters: createFileSchema,
    execute: async (_toolCallId, params) => {
      const source = assertExactlyOneSource(params)

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

      const result = await executeAgentToolWorkflow({
        toolName: 'create_file',
        args: {
          parent: params.parent,
          s3Key,
          name,
          size,
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
