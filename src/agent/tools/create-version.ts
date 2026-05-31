import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { executeAgentToolWorkflow } from './utils'
import * as fs from 'fs'
import * as path from 'path'
import { s3Service } from '@/services/s3/s3'
import { detectSupportedMimeType } from '@/utils/mime'
import { ulid } from 'ulid'

function getMimeType(filePath: string): string {
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(4100)
      const bytesRead = fs.readSync(fd, buffer, 0, 4100, 0)
      const detected = detectSupportedMimeType(new Uint8Array(buffer.subarray(0, bytesRead)))
      if (detected) return detected
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    /* Ignore detection errors and fallback to extension mapping */
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

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
      try {
        const absolutePath = path.resolve(process.cwd(), params.path)
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`Local file not found at path: ${params.path}`)
        }

        const fileSize = fs.statSync(absolutePath).size
        const mimeType = getMimeType(absolutePath)

        // Generate compliant S3 key matching normal file upload format
        const s3Key = `file/${ulid()}/raw`
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
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating file version: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: {},
        }
      }
    },
  }
}
