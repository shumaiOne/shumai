import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { Type } from 'typebox'
import type { AgentToolResult } from '@earendil-works/pi-agent-core'
import { createFile, type StartedUploadOutput } from '@shumai/operations'
import { storageBucket } from '@shumai/core/src/asset-read'
import { completeUploadOp, runOperation } from '@shumai/core/src/operations'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType, readFileMimeType } from '@shumai/core/src/utils/file-mime'
import {
  registerAgentToolExtension,
  type AgentOperationContext,
  type AgentToolExtension,
  type AgentToolOptions,
  type ToolParametersSchema,
} from '../operation-tools'

const METADATA_HINT =
  'The optional "metadata" parameter accepts only the CREATION_CONTEXT fields declared in its schema; never invent field keys, and use null for fields you do not know.'

/**
 * The agent gets the conversation project's Creation Context fields as a strict schema
 * (so it knows exactly what to fill in) instead of the open record MCP clients see. Without
 * such fields the parameter is left out.
 */
function setCreationMetadata(schema: ToolParametersSchema, options: AgentToolOptions): void {
  if (options.creationMetadataSchema) {
    schema.properties.metadata = Type.Union([options.creationMetadataSchema, Type.Null()])
  } else {
    delete schema.properties.metadata
  }
}

function resolveLocalFile(localPath: string): string {
  const absolutePath = path.resolve(process.cwd(), localPath)
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Local file not found at path: ${localPath}`)
  }
  return absolutePath
}

/**
 * Writes the file straight to the upload's storage key (the agent runs next to storage, so
 * it doesn't need the upload URL), then completes the upload as the agent.
 */
async function uploadAndComplete(
  raw: unknown,
  extra: Record<string, unknown>,
  ctx: AgentOperationContext,
): Promise<AgentToolResult<unknown>> {
  const started = raw as StartedUploadOutput
  if (!started.key) throw new Error('The upload did not return a storage key')

  if (typeof extra.path === 'string') {
    const absolutePath = resolveLocalFile(extra.path)
    await s3Service.putObject(
      storageBucket(),
      started.key,
      fs.createReadStream(absolutePath),
      fs.statSync(absolutePath).size,
      readFileMimeType(absolutePath),
    )
  } else {
    const content = Buffer.from(typeof extra.content === 'string' ? extra.content : '', 'utf-8')
    // The key ends with the file name, which gives the same type as the upload's.
    const contentType = getFileMimeType(null, started.key, 'text/plain')
    await s3Service.putObject(
      storageBucket(),
      started.key,
      content,
      content.byteLength,
      contentType,
    )
  }

  const asset = await runOperation(
    completeUploadOp,
    { ...ctx, via: 'agent' },
    { uploadId: started.uploadId },
  )
  return { content: [{ type: 'text', text: JSON.stringify(asset, null, 2) }], details: {} }
}

const createFileExtension: AgentToolExtension = {
  description:
    'Create a new file in a folder. Choose exactly ONE source: ' +
    '(1) "path" to upload a local file (e.g. one you made in .pi), OR ' +
    '(2) "name" and "content" to create a text file with that content. ' +
    METADATA_HINT,
  parameterOverrides: z.object({
    name: createFile.input.shape.name
      .optional()
      .describe(
        'File name including its extension (e.g. "notes.md"). Required with "content"; defaults to the local file\'s name with "path".',
      ),
  }),
  extraParameters: z.object({
    path: z
      .string()
      .min(1)
      .optional()
      .describe('Absolute or relative path of a local file to upload. Omit when using "content".'),
    content: z
      .string()
      .optional()
      .describe('Full text content of a new text file. Requires "name"; omit when using "path".'),
  }),
  hiddenParameters: ['contentType'],
  adjustParameters: setCreationMetadata,
  toInput(input, extra) {
    const hasPath = typeof extra.path === 'string'
    const hasContent = typeof extra.content === 'string'
    if (hasPath === hasContent) {
      throw new Error('Provide exactly one of "path" (a local file) or "content" (with "name").')
    }
    if (hasPath) {
      const absolutePath = resolveLocalFile(extra.path as string)
      return {
        ...input,
        name: input.name ?? path.basename(absolutePath),
        contentType: readFileMimeType(absolutePath),
      }
    }
    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw new Error('"name" is required when creating a file from "content".')
    }
    return { ...input, contentType: getFileMimeType(null, input.name, 'text/plain') }
  },
  present: uploadAndComplete,
}

const createVersionExtension: AgentToolExtension = {
  description:
    'Create a new version of an existing file (or version stack) from a local file path. ' +
    'The new version becomes the current one. ' +
    METADATA_HINT,
  extraParameters: z.object({
    path: z
      .string()
      .min(1)
      .describe('Absolute or relative path of the local file to upload as the new version.'),
  }),
  hiddenParameters: ['name', 'contentType'],
  adjustParameters: setCreationMetadata,
  toInput(input, extra) {
    const absolutePath = resolveLocalFile(extra.path as string)
    return {
      ...input,
      name: path.basename(absolutePath),
      contentType: readFileMimeType(absolutePath),
    }
  },
  present: uploadAndComplete,
}

registerAgentToolExtension('create_file', createFileExtension)
registerAgentToolExtension('create_version', createVersionExtension)
