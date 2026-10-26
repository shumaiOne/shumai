import { z } from 'zod'
import { type AgentTool, type AgentToolResult } from '@earendil-works/pi-agent-core'
import { type ImageContent, type TextContent } from '@earendil-works/pi-ai'
import { readAsset, type AssetReadOutput } from '@shumai/operations'
import { assetReadService, toAssetReadOutput } from '@shumai/core/src/asset-read'
import { getOperation, READ_WAIT_BUDGET_MS } from '@shumai/core/src/operations'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { MAX_TEXT_BYTES, MAX_TEXT_LINES } from '@shumai/core/src/asset-read'
import {
  registerAgentToolExtension,
  splitAgentParams,
  toToolParameters,
  type AgentToolExtension,
} from '../operation-tools'

const extraParameters = z.object({
  s3KeyOnly: z
    .boolean()
    .optional()
    .describe(
      'When true, returns only the storage S3 key(s) and MIME types of the asset/frames without attaching base64 image or text content to the agent context. Use this to obtain S3 keys for generate_image or generate_video references without consuming context tokens.',
    ),
})

/** Details kept compatible with the previous tool; `sourceKeys` drives session image storage. */
interface ReadAssetDetails {
  assetId: string
  name: string
  mediaType: string | null
  key?: string
  keys: string[]
  downloadUrl?: string
  results: Array<{ key: string; label: string; downloadUrl?: string }>
  sourceKeys: string[]
  size?: number
  isTruncated?: boolean
}

/** Render a read_asset / get_asset_render output as agent content (text plus image blocks). */
export async function presentReadOutput(
  output: AssetReadOutput,
  opts: { s3KeyOnly: boolean },
): Promise<AgentToolResult<ReadAssetDetails | { taskId?: string; status: 'pending' }>> {
  if (output.status === 'pending') {
    const retry = output.retryAfterSeconds ?? 5
    return {
      content: [
        {
          type: 'text',
          text: `${output.summary} Call get_asset_render with taskId "${output.taskId}" in about ${retry} seconds to get the result.`,
        },
      ],
      details: { taskId: output.taskId, status: 'pending' },
    }
  }

  const bucket = process.env.S3_BUCKET || 'shumai'
  const imageBlocks: ImageContent[] = []
  const imageLines: string[] = []
  for (const image of output.images) {
    const key = image.key ?? ''
    let mimeType = image.mimeType
    if (!opts.s3KeyOnly && key) {
      const { buffer, contentType } = await s3Service.getObject(bucket, key)
      mimeType =
        contentType && contentType !== 'application/octet-stream'
          ? contentType
          : getFileMimeType(buffer, key, image.mimeType)
      imageBlocks.push({ type: 'image', data: buffer.toString('base64'), mimeType })
    }
    imageLines.push(`- ${image.label} (S3 Key: "${key}", MIME: ${mimeType})`)
  }

  const lines = [output.summary, ...output.details, ...imageLines]
  if (output.text) {
    lines.push(`- Source file (S3 Key: "${output.text.key ?? ''}", MIME: ${output.text.mimeType})`)
  }
  let text = lines.join('\n')
  if (output.text && !opts.s3KeyOnly) {
    text += `\n\n${output.text.content}`
    if (output.text.truncated) {
      text += `\n\n[Content truncated to ${MAX_TEXT_LINES} lines / ${MAX_TEXT_BYTES / 1024}KB limit. Use download_asset to process the full file.]`
    }
  }

  const imageKeys = output.images.map((i) => i.key ?? '')
  const content: Array<TextContent | ImageContent> = [{ type: 'text', text }, ...imageBlocks]
  return {
    content,
    details: {
      assetId: output.asset.id,
      name: output.asset.name,
      mediaType: output.asset.mediaType,
      key: imageKeys[0] ?? output.text?.key,
      keys: imageKeys,
      downloadUrl: output.images[0]?.url ?? output.text?.url,
      results: output.images.map((i) => ({ key: i.key ?? '', label: i.label, downloadUrl: i.url })),
      sourceKeys: output.text?.key && imageKeys.length === 0 ? [output.text.key] : imageKeys,
      ...(output.text ? { size: output.text.size, isTruncated: output.text.truncated } : {}),
    },
  }
}

const readAssetExtension: AgentToolExtension = {
  extraParameters,
  // s3KeyOnly also means "don't read text content", as before.
  toInput: (input, extra) => (extra.s3KeyOnly ? { ...input, includeContent: false } : input),
  present: (output, extra) =>
    presentReadOutput(output as AssetReadOutput, { s3KeyOnly: extra.s3KeyOnly === true }),
}

const getAssetRenderExtension: AgentToolExtension = {
  present: (output) => presentReadOutput(output as AssetReadOutput, { s3KeyOnly: false }),
}

registerAgentToolExtension('read_asset', readAssetExtension)
registerAgentToolExtension('get_asset_render', getAssetRenderExtension)

/** Longer than the chat budget: autofill can't poll get_asset_render (it has no user). */
const AUTOFILL_WAIT_BUDGET_MS = 2 * READ_WAIT_BUDGET_MS.agent

/**
 * `read_asset` for the autofill system agent, which runs without a user. It uses the same
 * pipeline and presentation, but access is confined to the agent's team and target asset.
 */
export function createAutofillReadAssetTool(access: {
  teamId?: string
  targetAssetId?: string
}): AgentTool {
  const op = getOperation(readAsset.name)!
  return {
    name: readAsset.name,
    label: readAsset.title,
    description: readAsset.description,
    parameters: toToolParameters(op, readAssetExtension),
    execute: async (_toolCallId, params) => {
      const { input, extra } = splitAgentParams(op, readAssetExtension, params)
      const parsed = readAsset.input.safeParse(input)
      if (!parsed.success) {
        throw new Error(`Invalid input for read_asset: ${z.prettifyError(parsed.error)}`)
      }
      const { maxWaitSeconds, ...request } = parsed.data
      const budget =
        maxWaitSeconds === undefined
          ? AUTOFILL_WAIT_BUDGET_MS
          : Math.min(AUTOFILL_WAIT_BUDGET_MS, maxWaitSeconds * 1000)
      const outcome = await assetReadService.read({ kind: 'autofill', ...access }, request, {
        waitBudgetMs: budget,
      })
      const output = await toAssetReadOutput(outcome, { includeKeys: true })
      return presentReadOutput(output, { s3KeyOnly: extra.s3KeyOnly === true })
    },
  }
}
