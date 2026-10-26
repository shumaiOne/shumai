import { z } from 'zod'
import type { CallToolResult, ImageContent } from '@modelcontextprotocol/server'
import type { AssetReadOutput } from '@shumai/operations'
import { storageBucket } from '@shumai/core/src/asset-read'
import { logger } from '@shumai/core/src/logger'
import { s3Service } from '@shumai/core/src/s3/s3'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import type { McpToolExtension } from './types'

/** Most images attached inline to one result; the rest are links only. */
export const MAX_INLINE_IMAGES = 8
/** Largest image attached inline; bigger ones are links only. */
export const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024

const extraInput = z.object({
  inlineImages: z
    .boolean()
    .optional()
    .describe(
      `Attach images to the result so you can see them (default true, at most ${MAX_INLINE_IMAGES} images of up to 2 MB). Set to false to only get links.`,
    ),
})

/**
 * Removes storage keys and the source file link: the Operation returns keys to server-side
 * presenters so they can attach image bytes, but MCP clients only get image links.
 */
export function toClientOutput(output: AssetReadOutput): AssetReadOutput {
  const images = output.images.map(({ label, mimeType, url }) => ({ label, mimeType, url }))
  if (!output.text) return { ...output, images }
  const { content, truncated, size, mimeType } = output.text
  return { ...output, images, text: { content, truncated, size, mimeType } }
}

async function loadImage(key: string, fallbackMime: string): Promise<ImageContent | 'too_large'> {
  const bucket = storageBucket()
  const size = await s3Service.getObjectSize(bucket, key)
  if (size > MAX_INLINE_IMAGE_BYTES) return 'too_large'
  const { buffer, contentType } = await s3Service.getObject(bucket, key)
  const mimeType =
    contentType && contentType !== 'application/octet-stream'
      ? contentType
      : getFileMimeType(buffer, key, fallbackMime)
  return { type: 'image', data: buffer.toString('base64'), mimeType }
}

/** Renders a `read_asset` / `get_asset_render` output as MCP content: text, then images. */
export async function presentReadForMcp(
  raw: unknown,
  extra: Record<string, unknown>,
): Promise<CallToolResult> {
  const output = raw as AssetReadOutput
  const client = toClientOutput(output)
  const structuredContent = client as unknown as Record<string, unknown>

  if (output.status === 'pending') {
    const retry = output.retryAfterSeconds ?? 5
    return {
      content: [
        {
          type: 'text',
          text: `${output.summary} Call get_asset_render with taskId "${output.taskId}" in about ${retry} seconds to get the result.`,
        },
      ],
      structuredContent,
    }
  }

  const inline = extra.inlineImages !== false
  const images: ImageContent[] = []
  const lines = [output.summary, ...output.details]
  for (const [index, image] of output.images.entries()) {
    let note = ''
    if (inline) {
      if (index >= MAX_INLINE_IMAGES) {
        note = ` (not attached: only the first ${MAX_INLINE_IMAGES} images are attached)`
      } else if (image.key) {
        try {
          const loaded = await loadImage(image.key, image.mimeType)
          if (loaded === 'too_large') {
            note = ' (not attached: larger than 2 MB)'
          } else {
            images.push(loaded)
            note = ` (attached as image ${images.length})`
          }
        } catch (err) {
          logger.warn({ err, key: image.key }, 'Failed to attach image to MCP read result')
          note = ' (not attached: could not load the image)'
        }
      }
    }
    lines.push(`- ${image.label}${note}: ${image.url ?? ''}`)
  }
  if (output.images.length > 0) {
    lines.push('Image links expire in about an hour.')
  }

  let text = lines.join('\n')
  if (output.text) {
    text += `\n\n${output.text.content}`
    if (output.text.truncated) {
      text += `\n\n[Content truncated: showing the first part of a ${output.text.size}-byte file. Use download_asset to get the whole file.]`
    }
  }
  return { content: [{ type: 'text', text }, ...images], structuredContent }
}

export const readAssetMcpExtension: McpToolExtension = {
  extraInput,
  present: presentReadForMcp,
}

export const getAssetRenderMcpExtension: McpToolExtension = {
  extraInput,
  present: presentReadForMcp,
}
