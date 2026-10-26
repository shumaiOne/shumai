import { MAX_RENDER_ITEMS } from '@shumai/operations'
import { WorkflowTaskType } from '@shumai/db'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { s3Service } from '@shumai/core/src/s3/s3'
import { badRequest, storageBucket, type AssetReader } from '../types'

export const MAX_TEXT_BYTES = 50 * 1024
export const MAX_TEXT_LINES = 1000

const TEXT_MEDIA_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/x-yaml',
])

const TEXT_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.yaml',
  '.yml',
  '.xml',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.java',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
]

export function isPlainTextAsset(mediaType: string, filename: string): boolean {
  if (mediaType.startsWith('text/') || TEXT_MEDIA_TYPES.has(mediaType)) {
    return true
  }
  return TEXT_EXTENSIONS.some((ext) => filename.endsWith(ext))
}

/** Truncate to the line and byte limits; returns the kept text and whether anything was cut. */
export function truncateText(raw: string): { content: string; truncated: boolean } {
  let content = raw
  let truncated = false
  const lines = content.split('\n')
  if (lines.length > MAX_TEXT_LINES) {
    content = lines.slice(0, MAX_TEXT_LINES).join('\n')
    truncated = true
  }
  if (Buffer.byteLength(content, 'utf-8') > MAX_TEXT_BYTES) {
    content = Buffer.from(content, 'utf-8').subarray(0, MAX_TEXT_BYTES).toString('utf-8')
    truncated = true
  }
  return { content, truncated }
}

/** PDFs and text files: rendered page images ("pages") or raw text content ("text"). */
export const documentReader: AssetReader<'document'> = {
  kind: 'document',
  label: 'document',
  configHint: "Pass 'docConfig: { mode, startPage, endPage }'",

  matches: (asset) =>
    asset.media?.proxyType === 'pdf' ||
    asset.mediaTypeLower === 'application/pdf' ||
    isPlainTextAsset(asset.mediaTypeLower, asset.filenameLower),

  validate(asset, options, { hasAnnotation }) {
    if (!options) {
      throw badRequest(
        'docConfig with mode ("pages" or "text") is required when inspecting document/PDF assets.',
      )
    }
    const startPage = options.startPage ?? null
    const endPage = options.endPage ?? null

    if (options.mode === 'text') {
      if (hasAnnotation) {
        throw badRequest(
          'annotationId cannot be used with docConfig mode "text" because visual markups can only be rendered on visual pages. Use docConfig: { mode: "pages", startPage: ..., endPage: ... } instead.',
        )
      }
      if (startPage !== null || endPage !== null) {
        throw badRequest(
          'startPage and endPage must be left out when docConfig mode is "text". To inspect specific page numbers, use mode: "pages".',
        )
      }
      if (!isPlainTextAsset(asset.mediaTypeLower, asset.filenameLower)) {
        throw badRequest(
          `Asset "${asset.name}" is a binary PDF/document and cannot be read as raw text. Please call read_asset with docConfig: { mode: "pages", startPage: 1, endPage: ... } to view its visual pages.`,
        )
      }
      return
    }

    if (startPage === null || endPage === null) {
      throw badRequest('startPage and endPage are required when docConfig mode is "pages".')
    }
    if (startPage < 1) {
      throw badRequest(`Invalid page range: start page (${startPage}) must be at least 1.`)
    }
    if (startPage > endPage) {
      throw badRequest(
        `Invalid page range: start page (${startPage}) must be less than or equal to end page (${endPage}).`,
      )
    }
    const requested = endPage - startPage + 1
    if (requested > MAX_RENDER_ITEMS) {
      throw badRequest(
        `Page range (${requested} pages requested) exceeds the maximum limit of ${MAX_RENDER_ITEMS} pages per request.`,
      )
    }
  },

  async plan(asset, options, { annotation, includeContent }) {
    // validate() guarantees options are present and consistent
    const opts = options!
    if (opts.mode === 'text') {
      const key = asset.storageKey
      if (!key) {
        throw new Error(`No media content found for asset ${asset.id}.`)
      }
      const mimeType = asset.mediaType || getFileMimeType(null, asset.name || key, 'text/plain')
      let text = { content: '', truncated: false, size: 0, key, mimeType }
      if (includeContent) {
        const { buffer } = await s3Service.getObject(storageBucket(), key)
        text = { ...truncateText(buffer.toString('utf-8')), size: buffer.length, key, mimeType }
      }
      return {
        status: 'ready',
        result: {
          summary: `Document "${asset.name}" (ID: ${asset.id}):`,
          details: [],
          images: [],
          text,
        },
      }
    }

    return {
      status: 'render',
      task: {
        type: WorkflowTaskType.transcode_pdf_pages,
        spec: {
          pdfPages: {
            start: opts.startPage!,
            end: opts.endPage!,
            commentTimestamp: annotation?.timestamp ?? null,
            annotations: annotation?.annotations ?? null,
          },
        },
      },
    }
  },

  collect(asset, options, output) {
    const pages = output.pages as Array<{ key: string; page: number }> | undefined
    if (!pages || pages.length === 0) {
      throw new Error('No PDF page images were generated.')
    }
    return {
      summary: `Rendered ${pages.length} page(s) of "${asset.name}" (Pages ${options!.startPage} to ${options!.endPage}):`,
      details: [],
      images: pages.map((page) => ({
        key: page.key,
        label: `Page ${page.page}`,
        mimeType: getFileMimeType(null, page.key, 'image/webp'),
      })),
    }
  },
}
