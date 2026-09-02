import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent, type TextContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { resolveAnnotationsById } from './annotation-resolver'

export const readAssetSchema = Type.Object(
  {
    assetId: Type.String({
      description: 'The asset ID of the workspace asset to inspect. Required.',
    }),
    annotationId: Type.Union([
      Type.String({
        description:
          'The ID of the comment or message entry from <annotation id="..." /> whose visual markup should be overlaid, or null.',
      }),
      Type.Null(),
    ]),
    imageConfig: Type.Union([
      Type.Object(
        {},
        {
          additionalProperties: false,
          description: 'Optional configuration for image assets, or null.',
        },
      ),
      Type.Null(),
    ]),
    videoConfig: Type.Union([
      Type.Object(
        {
          start: Type.Number({ description: 'Start time in seconds.' }),
          end: Type.Number({ description: 'End time in seconds.' }),
          count: Type.Number({ description: 'Number of frames to extract (e.g. 1 to 10).' }),
        },
        {
          additionalProperties: false,
          description:
            'Configuration for video assets. Required when inspecting videos, or null for other asset types.',
        },
      ),
      Type.Null(),
    ]),
    docConfig: Type.Union([
      Type.Object(
        {
          mode: Type.Union([
            Type.Literal('pages', {
              description:
                'Render specific page range as images for visual layout, charts, or visual annotations (required for binary PDFs).',
            }),
            Type.Literal('text', {
              description:
                'Read raw text content directly (ideal for .md, .txt, .csv, code files).',
            }),
          ]),
          startPage: Type.Union([
            Type.Number({
              description:
                'Start page number (1-based index, required when mode="pages"), or null when mode="text".',
            }),
            Type.Null(),
          ]),
          endPage: Type.Union([
            Type.Number({
              description:
                'End page number (1-based index, max 20 pages per call, required when mode="pages"), or null when mode="text".',
            }),
            Type.Null(),
          ]),
        },
        {
          additionalProperties: false,
          description:
            'Configuration for document/PDF/text assets, or null if inspecting another asset type.',
        },
      ),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
)

export function isPlainTextAsset(mediaType: string, filename: string): boolean {
  if (
    mediaType.startsWith('text/') ||
    mediaType === 'application/json' ||
    mediaType === 'application/javascript' ||
    mediaType === 'application/typescript' ||
    mediaType === 'application/xml' ||
    mediaType === 'application/x-yaml'
  ) {
    return true
  }
  const textExtensions = [
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
  return textExtensions.some((ext) => filename.endsWith(ext))
}

const MAX_TEXT_BYTES = 50 * 1024
const MAX_TEXT_LINES = 1000

export function createReadAssetTool(userId: string): AgentTool<typeof readAssetSchema> {
  return {
    name: 'read_asset',
    label: 'Read Asset',
    description:
      'Inspects and reads the content of an asset in the workspace. ' +
      'Supports visual analysis for images, video frame extraction, PDF page rendering, and direct text reading for text/markdown files. ' +
      'Pass assetId, and provide the specific config (imageConfig, videoConfig, or docConfig) while setting unused configs to null. ' +
      'Optionally provide annotationId to view visual markups drawn on the asset.',
    parameters: readAssetSchema,
    execute: async (_toolCallId, params) => {
      const { assetId, annotationId, videoConfig, docConfig } = params

      if (!userId) {
        throw new Error('User ID is required for authorization.')
      }

      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })

      let asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { storageKey: true },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found.`)
      }

      if (asset.type === 'version_stack') {
        const latestVersion = await prisma.asset.findFirst({
          where: { parentId: asset.id, isDeleted: false },
          orderBy: { sortIndex: 'asc' },
          include: { storageKey: true },
        })
        if (latestVersion) {
          asset = latestVersion
        }
      }

      const mediaInfo = asset.media as unknown as PrismaJson.MediaInfo | null
      const proxyType = mediaInfo?.proxyType
      const mediaType = asset.mediaType?.toLowerCase() || ''
      const filename = asset.name?.toLowerCase() || ''
      const bucket = process.env.S3_BUCKET || 'shumai'

      // ----------------------------------------------------------------------
      // Branch 1: Image Assets
      // ----------------------------------------------------------------------
      if (proxyType === 'image' || mediaType.startsWith('image/') || filename.endsWith('.psd')) {
        let mediaKey = asset.storageKey?.key
        if (mediaInfo?.imageTranscodes && mediaInfo.imageTranscodes.length > 0) {
          mediaKey = mediaInfo.imageTranscodes[0].key || mediaKey
        }

        if (!mediaKey) {
          throw new Error('No media content found for this asset.')
        }

        const { annotations } = await resolveAnnotationsById(asset.id, annotationId)
        let keyToUse = mediaKey

        if (annotations) {
          const task = await prisma.workflowTask.create({
            data: {
              assetId: asset.id,
              projectId: asset.projectId || 'none',
              type: WorkflowTaskType.transcode_image_annotation,
              status: WorkflowTaskStatus.pending,
              payload: {
                projectId: asset.projectId || 'none',
                imageAnnotation: {
                  annotations,
                },
              },
            },
          })

          const completedTask = await workflowService.executeWait(task)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transcode image annotation task output
          const output = completedTask.output as any
          if (output?.key) {
            keyToUse = output.key
          } else {
            throw new Error('Image annotation transcode workflow failed to output S3 key.')
          }
        }

        const { buffer, contentType } = await s3Service.getObject(bucket, keyToUse)
        const mimeType =
          contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'
        const downloadUrl = await s3Service.presign(
          bucket,
          keyToUse,
          'GET',
          true,
          asset.name || undefined,
        )

        const content: Array<TextContent | ImageContent> = [
          {
            type: 'text',
            text: `Image asset "${asset.name}" (ID: ${asset.id}):\n- S3 Key: "${keyToUse}"`,
          },
          {
            type: 'image',
            data: buffer.toString('base64'),
            mimeType,
          },
        ]

        return {
          content,
          details: {
            assetId: asset.id,
            name: asset.name,
            mediaType: asset.mediaType,
            key: keyToUse,
            downloadUrl,
            sourceKeys: [keyToUse],
          },
        }
      }

      // ----------------------------------------------------------------------
      // Branch 2: Video Assets
      // ----------------------------------------------------------------------
      if (proxyType === 'video' || mediaType.startsWith('video/')) {
        if (!videoConfig) {
          throw new Error(
            'videoConfig with start, end, and count is required when inspecting video assets.',
          )
        }

        const { start, end, count } = videoConfig

        if (start < 0 || end < 0) {
          throw new Error('Invalid video time range: start and end must be non-negative numbers.')
        }

        if (start > end) {
          throw new Error(
            `Invalid video time range: start (${start}) must be less than or equal to end (${end}).`,
          )
        }

        if (count < 1) {
          throw new Error(`Invalid frame count: count (${count}) must be at least 1.`)
        }

        const { annotations, timestamp: commentTimestamp } = await resolveAnnotationsById(
          asset.id,
          annotationId,
        )

        const task = await prisma.workflowTask.create({
          data: {
            assetId: asset.id,
            projectId: asset.projectId || 'none',
            type: WorkflowTaskType.transcode_screenshot,
            status: WorkflowTaskStatus.pending,
            payload: {
              projectId: asset.projectId || 'none',
              screenshot: {
                start,
                end,
                count,
                commentTimestamp,
                annotations,
              },
            },
          },
        })

        const completedTask = await workflowService.executeWait(task)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transcode screenshot output
        const output = completedTask.output as any
        const screenshots = output?.screenshots as
          | Array<{ key: string; timestamp: number }>
          | undefined

        if (!screenshots || screenshots.length === 0) {
          throw new Error('No screenshots were generated.')
        }

        const content: Array<TextContent | ImageContent> = []
        const sourceKeys: string[] = []
        const results: Array<{ key: string; timestamp: number; downloadUrl: string }> = []
        const textLines: string[] = [
          `Extracted ${screenshots.length} frame(s) from "${asset.name}" (${start}s - ${end}s):`,
        ]

        for (const shot of screenshots) {
          const { buffer, contentType } = await s3Service.getObject(bucket, shot.key)
          const mimeType =
            contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'
          const downloadUrl = await s3Service.presign(
            bucket,
            shot.key,
            'GET',
            true,
            asset.name || undefined,
          )

          textLines.push(`- Frame at ${shot.timestamp}s: S3 Key: "${shot.key}"`)
          content.push({
            type: 'image',
            data: buffer.toString('base64'),
            mimeType,
          })
          sourceKeys.push(shot.key)
          results.push({
            key: shot.key,
            timestamp: shot.timestamp,
            downloadUrl,
          })
        }

        content.unshift({
          type: 'text',
          text: textLines.join('\n'),
        })

        return {
          content,
          details: {
            assetId: asset.id,
            name: asset.name,
            mediaType: asset.mediaType,
            keys: sourceKeys,
            results,
            sourceKeys,
          },
        }
      }

      // ----------------------------------------------------------------------
      // Branch 3: Documents & PDF Assets
      // ----------------------------------------------------------------------
      if (
        proxyType === 'pdf' ||
        mediaType === 'application/pdf' ||
        isPlainTextAsset(mediaType, filename)
      ) {
        if (!docConfig) {
          throw new Error(
            'docConfig with mode ("pages" or "text") is required when inspecting document/PDF assets.',
          )
        }

        if (docConfig.mode === 'text') {
          if (annotationId !== null) {
            throw new Error(
              'annotationId cannot be used with docConfig mode "text" because visual markups can only be rendered on visual pages. Use docConfig: { mode: "pages", startPage: ..., endPage: ... } instead.',
            )
          }

          if (docConfig.startPage !== null || docConfig.endPage !== null) {
            throw new Error(
              'startPage and endPage must be null when docConfig mode is "text". To inspect specific page numbers, use mode: "pages".',
            )
          }

          if (!isPlainTextAsset(mediaType, filename)) {
            throw new Error(
              `Asset "${asset.name}" is a binary PDF/document and cannot be read as raw text. Please call read_asset with docConfig: { mode: "pages", startPage: 1, endPage: ... } to view its visual pages.`,
            )
          }

          const mediaKey = asset.storageKey?.key
          if (!mediaKey) {
            throw new Error(`No media content found for asset ${asset.id}.`)
          }

          const { buffer } = await s3Service.getObject(bucket, mediaKey)
          const rawText = buffer.toString('utf-8')
          let text = rawText
          let isTruncated = false

          const lines = text.split('\n')
          if (lines.length > MAX_TEXT_LINES) {
            text = lines.slice(0, MAX_TEXT_LINES).join('\n')
            isTruncated = true
          }

          if (Buffer.byteLength(text, 'utf-8') > MAX_TEXT_BYTES) {
            text = Buffer.from(text, 'utf-8').subarray(0, MAX_TEXT_BYTES).toString('utf-8')
            isTruncated = true
          }

          if (isTruncated) {
            text += `\n\n[Content truncated to ${MAX_TEXT_LINES} lines / ${MAX_TEXT_BYTES / 1024}KB limit. Use download_asset to process the full file.]`
          }

          const downloadUrl = await s3Service.presign(
            bucket,
            mediaKey,
            'GET',
            true,
            asset.name || undefined,
          )

          return {
            content: [
              {
                type: 'text',
                text: `Document "${asset.name}" (ID: ${asset.id}, S3 Key: "${mediaKey}"):\n\n${text}`,
              },
            ],
            details: {
              assetId: asset.id,
              name: asset.name,
              mediaType: asset.mediaType,
              key: mediaKey,
              downloadUrl,
              sourceKeys: [mediaKey],
              size: buffer.length,
              isTruncated,
            },
          }
        }

        // docConfig.mode === 'pages'
        if (docConfig.startPage === null || docConfig.endPage === null) {
          throw new Error('startPage and endPage are required when docConfig mode is "pages".')
        }

        const start = docConfig.startPage
        const end = docConfig.endPage

        if (start < 1) {
          throw new Error(`Invalid page range: start page (${start}) must be at least 1.`)
        }

        if (start > end) {
          throw new Error(
            `Invalid page range: start page (${start}) must be less than or equal to end page (${end}).`,
          )
        }

        const MAX_PAGE_RANGE = 20
        const requestedPages = end - start + 1
        if (requestedPages > MAX_PAGE_RANGE) {
          throw new Error(
            `Page range (${requestedPages} pages requested) exceeds the maximum limit of ${MAX_PAGE_RANGE} pages per request.`,
          )
        }

        const { annotations, timestamp: commentTimestamp } = await resolveAnnotationsById(
          asset.id,
          annotationId,
        )

        const task = await prisma.workflowTask.create({
          data: {
            assetId: asset.id,
            projectId: asset.projectId || 'none',
            type: WorkflowTaskType.transcode_pdf_pages,
            status: WorkflowTaskStatus.pending,
            payload: {
              projectId: asset.projectId || 'none',
              pdfPages: {
                start,
                end,
                commentTimestamp,
                annotations,
              },
            },
          },
        })

        const completedTask = await workflowService.executeWait(task)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transcode pdf pages output
        const output = completedTask.output as any
        const pages = output?.pages as Array<{ key: string; page: number }> | undefined

        if (!pages || pages.length === 0) {
          throw new Error('No PDF page images were generated.')
        }

        const content: Array<TextContent | ImageContent> = []
        const sourceKeys: string[] = []
        const results: Array<{ key: string; page: number; downloadUrl: string }> = []
        const textLines: string[] = [
          `Rendered ${pages.length} page(s) of "${asset.name}" (Pages ${start} to ${end}):`,
        ]

        for (const pageItem of pages) {
          const { buffer, contentType } = await s3Service.getObject(bucket, pageItem.key)
          const mimeType =
            contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'
          const downloadUrl = await s3Service.presign(
            bucket,
            pageItem.key,
            'GET',
            true,
            asset.name || undefined,
          )

          textLines.push(`- Page ${pageItem.page}: S3 Key: "${pageItem.key}"`)
          content.push({
            type: 'image',
            data: buffer.toString('base64'),
            mimeType,
          })
          sourceKeys.push(pageItem.key)
          results.push({
            key: pageItem.key,
            page: pageItem.page,
            downloadUrl,
          })
        }

        content.unshift({
          type: 'text',
          text: textLines.join('\n'),
        })

        return {
          content,
          details: {
            assetId: asset.id,
            name: asset.name,
            mediaType: asset.mediaType,
            keys: sourceKeys,
            results,
            sourceKeys,
          },
        }
      }

      throw new Error(
        `Unsupported asset type for read_asset. Asset ${asset.id} has media type "${mediaType || 'unknown'}". Use download_asset to download this file to disk.`,
      )
    },
  }
}
