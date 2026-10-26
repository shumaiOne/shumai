import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import type { AgentToolResult } from '@earendil-works/pi-agent-core'
import { downloadAsset, MAX_DOWNLOAD_ASSETS, type DownloadAssetOutput } from '@shumai/operations'
import type { User } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { storageBucket } from '@shumai/core/src/asset-read'
import { s3Service } from '@shumai/core/src/s3/s3'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { readFileMimeType } from '@shumai/core/src/utils/file-mime'
import { resolveAssetIdFromKey } from '../tools/download-asset'
import { registerAgentToolExtension, type AgentToolExtension } from '../operation-tools'

const CLEANUP_REMINDER = 'Remember to delete these temporary files when finished.'

/** The agent's sandbox, where downloaded files are saved for local scripts and bash. */
function sandboxDir(): string {
  const dir = path.join(process.cwd(), '.pi')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Saves a storage object into the sandbox; returns the paths and detected content type. */
async function saveToSandbox(key: string, filename: string) {
  const dir = sandboxDir()
  const absolutePath = path.join(dir, filename)
  const bucket = storageBucket()
  const info = await s3Service.headObject(bucket, key).catch(() => null)
  await s3Service.downloadToFile(bucket, key, absolutePath)
  const size = await fs.promises
    .stat(absolutePath)
    .then((s) => s.size)
    .catch(() => info?.size ?? 0)
  const contentType =
    info?.contentType && info.contentType !== 'application/octet-stream'
      ? info.contentType
      : readFileMimeType(absolutePath)
  return { absolutePath, filePath: path.join('.pi', filename), size, contentType }
}

/** Downloads one storage key (e.g. a frame from read_asset) after checking Read on its asset. */
async function downloadKey(key: string, userId: string): Promise<AgentToolResult<unknown>> {
  const owningAssetId = await resolveAssetIdFromKey(key)
  await authzService.hasPermission({
    user: { id: userId } as User,
    permission: Permission.Read,
    type: ResourceType.Asset,
    id: owningAssetId,
  })
  const filename = sanitizeFilename(path.basename(key)) || 'downloaded_file'
  const saved = await saveToSandbox(key, filename)
  return {
    content: [
      {
        type: 'text',
        text: `Downloaded storage key "${key}" to "${saved.filePath}". Remember to delete this temporary file when finished.`,
      },
    ],
    details: { key, assetId: owningAssetId, ...saved },
  }
}

/** Saves each file of a download_asset result into the sandbox. */
export async function presentDownloadOutput(
  output: DownloadAssetOutput,
): Promise<AgentToolResult<unknown>> {
  const lines: string[] = []
  const files = []
  for (const file of output.files) {
    if (!file.key) throw new Error(`download_asset returned no storage key for ${file.assetId}`)
    const saved = await saveToSandbox(
      file.key,
      `${file.assetId}_${sanitizeFilename(file.name) || 'file'}`,
    )
    lines.push(
      `Downloaded "${file.name}" (ID: ${file.assetId}, ${file.kind}, ${saved.contentType}, ${formatSize(saved.size)}) to "${saved.filePath}".`,
    )
    files.push({ assetId: file.assetId, name: file.name, kind: file.kind, ...saved })
  }
  lines.push(CLEANUP_REMINDER)
  return { content: [{ type: 'text', text: lines.join('\n') }], details: { files } }
}

const downloadAssetExtension: AgentToolExtension = {
  description:
    `Downloads up to ${MAX_DOWNLOAD_ASSETS} workspace files into the local .pi directory, for processing with local scripts or bash commands. ` +
    'By default it saves the web preview version (proxy) when there is one, e.g. the transcoded video or the web image; set proxy to false for the original uploaded file. ' +
    'A version stack downloads its latest version; folders are not supported. ' +
    'To download a specific artifact from read_asset (e.g. a frame or page), pass its storage key as "key" instead of assetIds. ' +
    'Remember to delete the downloaded files when finished.',
  parameterOverrides: z.object({
    assetIds: downloadAsset.input.shape.assetIds
      .optional()
      .describe(
        `IDs of the files or version stacks to download (1 to ${MAX_DOWNLOAD_ASSETS}). Omit when passing "key".`,
      ),
  }),
  extraParameters: z.object({
    key: z
      .string()
      .optional()
      .describe(
        'Storage S3 key of a specific media artifact to download instead of assetIds, e.g. a screenshot or page key from read_asset.',
      ),
  }),
  async intercept(input, extra, ctx) {
    if (typeof extra.key !== 'string') return undefined
    if (Array.isArray(input.assetIds) && input.assetIds.length > 0) {
      throw new Error('Provide either "assetIds" or "key", not both.')
    }
    if (!ctx.userId) throw new Error('User ID is required for authorization.')
    return downloadKey(extra.key, ctx.userId)
  },
  present: (output) => presentDownloadOutput(output as DownloadAssetOutput),
}

registerAgentToolExtension('download_asset', downloadAssetExtension)
