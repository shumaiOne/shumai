import type { ToolExecutionResult as AgentToolResult } from '@earendil-works/pi-durable'
import { storageBucket } from '@shumai/core/src/asset-read'
import { completeUploadOp, runOperation } from '@shumai/core/src/operations'
import { runnerService } from '@shumai/core/src/runner'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { createFile, type StartedUploadOutput } from '@shumai/operations'
import * as path from 'path'
import { Type } from 'typebox'
import { z } from 'zod'
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

function resolveGeneratedStorageKey(rawPath: string): string | null {
  const cleaned = rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
  if (cleaned.includes('..')) return null
  if (cleaned.startsWith('.pi/generated/')) {
    const rest = cleaned.slice('.pi/generated/'.length)
    return rest ? `temp/generated/${rest}` : null
  }
  if (cleaned.startsWith('temp/generated/')) {
    const rest = cleaned.slice('temp/generated/'.length)
    return rest ? cleaned : null
  }
  return null
}

function normalizeRunnerPath(rawPath: string): string | null {
  const cleaned = rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!cleaned || cleaned.startsWith('/') || cleaned.includes('..')) {
    return null
  }
  const normalized = path.posix.normalize(cleaned)
  if (normalized.startsWith('..') || normalized.startsWith('/')) {
    return null
  }
  if (normalized === '.pi' || normalized.startsWith('.pi/')) {
    return normalized
  }
  return `.pi/${normalized}`
}

async function resolveTargetRunnerId(ctx?: AgentOperationContext): Promise<string> {
  if (ctx?.runnerId && !ctx.teamId) {
    if (!runnerService.isRunnerConnected(ctx.runnerId)) {
      throw new Error(
        'Runner is currently offline. Please start your runner with "shumai runner start" and try again.',
      )
    }
    return ctx.runnerId
  }
  const runner = await runnerService.requireOnlineRunner(ctx?.teamId || '', ctx?.runnerId)
  return runner.id
}

async function resolvePathSource(
  localPath: string,
  ctx?: AgentOperationContext,
): Promise<
  | { kind: 'generated'; storageKey: string; name: string; contentType: string }
  | { kind: 'runner'; runnerId: string; runnerPath: string; name: string; contentType: string }
> {
  const generatedKey = resolveGeneratedStorageKey(localPath)
  if (generatedKey) {
    const head = await s3Service.headObject(storageBucket(), generatedKey).catch(() => null)
    if (!head) {
      throw new Error(`Local file not found at path: ${localPath}`)
    }
    const name = path.posix.basename(generatedKey)
    const contentType =
      head.contentType && head.contentType !== 'application/octet-stream'
        ? head.contentType
        : getFileMimeType(null, name)
    return { kind: 'generated', storageKey: generatedKey, name, contentType }
  }

  const runnerPath = normalizeRunnerPath(localPath)
  if (!runnerPath) {
    throw new Error(`Local file not found at path: ${localPath}`)
  }

  const runnerId = await resolveTargetRunnerId(ctx)
  const stat = await runnerService.statOnRunner(runnerId, runnerPath)
  if (!stat.ok || !stat.exists || stat.isFile === false) {
    throw new Error(`Local file not found at path: ${localPath}`)
  }
  const name = path.posix.basename(runnerPath)
  const contentType =
    stat.mimeType && stat.mimeType !== 'application/octet-stream'
      ? stat.mimeType
      : getFileMimeType(null, name)
  return { kind: 'runner', runnerId, runnerPath, name, contentType }
}

/**
 * Transfers the file from either temporary generated storage or the remote runner workspace
 * into the upload's storage key, then completes the upload as the agent.
 */
async function uploadAndComplete(
  raw: unknown,
  extra: Record<string, unknown>,
  ctx: AgentOperationContext,
): Promise<AgentToolResult> {
  const started = raw as StartedUploadOutput
  if (!started.key) throw new Error('The upload did not return a storage key')

  if (typeof extra.path === 'string') {
    const source =
      (extra.__resolvedSource as Awaited<ReturnType<typeof resolvePathSource>> | undefined) ??
      (await resolvePathSource(extra.path, ctx))

    if (source.kind === 'generated') {
      const obj = await s3Service.getObject(storageBucket(), source.storageKey)
      await s3Service.putObject(
        storageBucket(),
        started.key,
        obj.buffer,
        obj.buffer.length,
        source.contentType,
      )
    } else {
      const uploadRes = await runnerService.uploadFromRunner(source.runnerId, {
        srcPath: source.runnerPath,
        url: started.uploadUrl,
        contentType: source.contentType,
      })
      if (!uploadRes.ok) {
        throw new Error(uploadRes.error || `Failed to upload file "${extra.path}" from runner`)
      }
    }
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
  return { output: [{ type: 'text', text: JSON.stringify(asset, null, 2) }], details: {} }
}

const createFileExtension: AgentToolExtension = {
  description:
    'Create a new file in a folder. Choose exactly ONE source: ' +
    '(1) "path" to upload a file from .pi (e.g. a generated file in .pi/generated/... or a file created in .pi on the runner), OR ' +
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
      .describe(
        'Path of a file in .pi (e.g. ".pi/generated/..." or ".pi/output.mp4") to upload. Omit when using "content".',
      ),
    content: z
      .string()
      .optional()
      .describe('Full text content of a new text file. Requires "name"; omit when using "path".'),
  }),
  hiddenParameters: ['contentType'],
  adjustParameters: setCreationMetadata,
  async toInput(input, extra, ctx) {
    const hasPath = typeof extra.path === 'string'
    const hasContent = typeof extra.content === 'string'
    if (hasPath === hasContent) {
      throw new Error('Provide exactly one of "path" (a local file) or "content" (with "name").')
    }
    if (hasPath) {
      const source = await resolvePathSource(extra.path as string, ctx)
      extra.__resolvedSource = source
      return {
        ...input,
        name: input.name ?? source.name,
        contentType: source.contentType,
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
    'Create a new version of an existing file (or version stack) from a file path in .pi. ' +
    'The new version becomes the current one. ' +
    METADATA_HINT,
  extraParameters: z.object({
    path: z
      .string()
      .min(1)
      .describe(
        'Path of the file in .pi (e.g. ".pi/generated/..." or ".pi/output.mp4") to upload as the new version.',
      ),
  }),
  hiddenParameters: ['name', 'contentType'],
  adjustParameters: setCreationMetadata,
  async toInput(input, extra, ctx) {
    const source = await resolvePathSource(extra.path as string, ctx)
    extra.__resolvedSource = source
    return {
      ...input,
      name: source.name,
      contentType: source.contentType,
    }
  },
  present: uploadAndComplete,
}

registerAgentToolExtension('create_file', createFileExtension)
registerAgentToolExtension('create_version', createVersionExtension)
