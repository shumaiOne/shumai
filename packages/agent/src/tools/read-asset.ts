import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent, type TextContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { resolveAnnotationsById } from './annotation-resolver'
import { getFileMimeType } from '@shumai/core/src/utils/file-mime'
import { is3dModel } from '@shumai/core/src/utils/mime'
import {
  isValidTurntableDegree,
  secondToDegree,
  degreeToSecond,
} from '@shumai/core/src/utils/model3d'

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
    s3KeyOnly: Type.Optional(
      Type.Boolean({
        description:
          'When true, returns only the storage S3 key(s) and MIME types of the asset/frames without attaching base64 image or text content to the agent context. Use this to obtain S3 keys for generate_image or generate_video references without consuming context tokens.',
        default: false,
      }),
    ),
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
    config3d: Type.Optional(
      Type.Union([
        Type.Object(
          {
            degree: Type.Optional(
              Type.Union([
                Type.Integer({
                  minimum: 0,
                  maximum: 345,
                  description:
                    'Turntable rotation degree (integer: 0, 15, 30, ..., 345 in 15° increments) to inspect a specific angle of a 3D model. Leave null/omitted to view the 4-view composite overview.',
                }),
                Type.Null(),
              ]),
            ),
          },
          {
            additionalProperties: false,
            description:
              'Configuration for 3D model assets. Pass null if inspecting another asset type. Optionally pass degree to inspect a specific turntable angle, or leave null/omitted to view the 4-view composite overview.',
          },
        ),
        Type.Null(),
      ]),
    ),
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

export type ReadAssetAuthContext =
  | {
      userId?: string
      teamId?: string
      agentType?: 'chat' | 'embedding'
      targetAssetId?: string
    }
  | {
      userId?: undefined
      teamId: string
      agentType: 'autofill'
      targetAssetId: string
    }

export function createReadAssetTool(
  auth: string | ReadAssetAuthContext,
): AgentTool<typeof readAssetSchema> {
  const authContext: ReadAssetAuthContext =
    typeof auth === 'string' ? { userId: auth, agentType: 'chat' } : auth
  const { userId, teamId, agentType = 'chat', targetAssetId } = authContext

  return {
    name: 'read_asset',
    label: 'Read Asset',
    description:
      'Inspects and reads the content of an asset in the workspace. ' +
      'Supports visual analysis for images, 3D models (overview or specific degree angle), video frame extraction, PDF page rendering, and direct text reading for text/markdown files. ' +
      'Pass assetId, and provide the specific config (imageConfig, config3d, videoConfig, or docConfig) while setting unused configs to null. ' +
      'Optionally provide annotationId to view visual markups drawn on the asset.',
    parameters: readAssetSchema,
    execute: async (_toolCallId, params) => {
      const { assetId, annotationId, s3KeyOnly, config3d, videoConfig, docConfig } = params

      if (agentType === 'autofill' && !userId) {
        if (!targetAssetId) {
          throw new Error('Target asset ID is required for autofill agent authorization.')
        }
        if (!teamId) {
          throw new Error('Team ID is required for autofill agent authorization.')
        }

        // System background execution for Autofill Agent
        const assetRecord = await prisma.asset.findUnique({
          where: { id: assetId },
          include: { project: true, teamRootFolder: true },
        })
        if (!assetRecord) {
          throw new Error(`Asset with ID ${assetId} not found.`)
        }

        // Strict team boundary check
        const assetTeamId = assetRecord.project?.teamId || assetRecord.teamRootFolder?.id
        if (!assetTeamId || assetTeamId !== teamId) {
          throw new Error(`Access denied: asset ${assetId} does not belong to team ${teamId}.`)
        }

        // Strict target asset boundary check (allows the target asset or its version stack children)
        if (assetRecord.id !== targetAssetId && assetRecord.parentId !== targetAssetId) {
          throw new Error(
            `Access denied: autofill agent can only read target asset ${targetAssetId}.`,
          )
        }
      } else {
        // Chat agents or user-driven executions strictly require a userId and full ACL validation
        if (!userId) {
          throw new Error('User ID is required for authorization.')
        }

        await authzService.hasPermission({
          user: { id: userId } as User,
          permission: Permission.Read,
          type: ResourceType.Asset,
          id: assetId,
        })
      }

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
      // Branch 0: 3D Assets (Orthogonal 4-View Composite Image or Degree Angle)
      // ----------------------------------------------------------------------
      const is3d = proxyType === '3d' || is3dModel(mediaType, filename)
      if (is3d) {
        if (videoConfig) {
          throw new Error(
            `Asset ${asset.id} is a 3D model. To inspect specific angles pass 'config3d: { degree: ... }'; do not pass videoConfig.`,
          )
        }

        if (config3d?.degree !== undefined && config3d?.degree !== null) {
          if (!isValidTurntableDegree(config3d.degree)) {
            throw new Error(
              `Invalid turntable degree: ${config3d.degree}. Degree must be an integer multiple of 15 between 0 and 345 (e.g. 0, 15, 30, 45, ..., 345).`,
            )
          }
        }

        let annotations: PrismaJson.AnnotationList | null = null
        let commentTimestamp: number | null = null
        if (annotationId) {
          const resolved = await resolveAnnotationsById(asset.id, annotationId)
          annotations = resolved.annotations
          commentTimestamp = resolved.timestamp
          if (commentTimestamp !== null && commentTimestamp !== undefined) {
            const commentDegree = secondToDegree(commentTimestamp)
            if (
              config3d?.degree !== undefined &&
              config3d?.degree !== null &&
              config3d.degree !== commentDegree
            ) {
              throw new Error(
                `Annotation "${annotationId}" was drawn at ${commentDegree}°, but degree ${config3d.degree}° was specified. Do not pass a conflicting degree with annotationId.`,
              )
            }
          }
        }

        if ((config3d?.degree !== undefined && config3d?.degree !== null) || annotationId) {
          if (!mediaInfo?.videoTranscodes || mediaInfo.videoTranscodes.length === 0) {
            throw new Error(
              `Asset ${asset.id} is a 3D model, but its turntable video (turntable.mp4) is missing.`,
            )
          }

          let targetDegree: number
          let targetSecond: number

          if (config3d?.degree !== undefined && config3d?.degree !== null) {
            targetDegree = config3d.degree
            targetSecond = degreeToSecond(targetDegree)
          } else {
            targetSecond =
              commentTimestamp !== null && commentTimestamp !== undefined ? commentTimestamp : 0
            targetDegree = secondToDegree(targetSecond)
          }

          const task = await prisma.workflowTask.create({
            data: {
              assetId: asset.id,
              projectId: asset.projectId || 'none',
              type: WorkflowTaskType.transcode_screenshot,
              status: WorkflowTaskStatus.pending,
              payload: {
                projectId: asset.projectId || 'none',
                screenshot: {
                  start: targetSecond,
                  end: targetSecond,
                  count: 1,
                  commentTimestamp: targetSecond,
                  annotations: annotations ?? undefined,
                },
              },
            },
          })

          const completedTask = await workflowService.executeWait(task)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transcode screenshot output
          const output = completedTask.output as any
          const screenshots = output?.screenshots as
            Array<{ key: string; timestamp: number }> | undefined

          if (!screenshots || screenshots.length === 0) {
            throw new Error(
              `Failed to extract 3D turntable frame for asset ${asset.id} at ${targetDegree}°.`,
            )
          }

          const shotKey = screenshots[0].key
          const downloadUrl = await s3Service.presign(
            bucket,
            shotKey,
            'GET',
            true,
            asset.name || undefined,
          )

          const content: Array<TextContent | ImageContent> = []
          const hasMarkup = Boolean(annotations && annotations.length > 0)
          const textDescription = hasMarkup
            ? `3D asset "${asset.name}" (ID: ${asset.id}, S3 Key: "${shotKey}") view at ${targetDegree}° with visual markups overlaid:`
            : `3D asset "${asset.name}" (ID: ${asset.id}, S3 Key: "${shotKey}") view at ${targetDegree}°:`

          if (s3KeyOnly) {
            content.push({
              type: 'text',
              text: textDescription,
            })
          } else {
            const { buffer, contentType } = await s3Service.getObject(bucket, shotKey)
            const actualMimeType =
              contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'
            content.push({
              type: 'text',
              text: textDescription,
            })
            content.push({
              type: 'image',
              data: buffer.toString('base64'),
              mimeType: actualMimeType,
            })
          }

          return {
            content,
            details: {
              assetId: asset.id,
              name: asset.name,
              mediaType: asset.mediaType,
              key: shotKey,
              downloadUrl,
              sourceKeys: [shotKey],
            },
          }
        }

        if (!mediaInfo?.imageTranscodes || mediaInfo.imageTranscodes.length === 0) {
          throw new Error(
            `Asset ${asset.id} is a 3D model, but its 4-views image (views.webp) is missing.`,
          )
        }

        const mediaKey = mediaInfo.imageTranscodes[0].key
        if (!mediaKey) {
          throw new Error(`Asset ${asset.id} is a 3D model, but its 4-views image key is missing.`)
        }

        const keyToUse = mediaKey
        const mimeType = 'image/webp'

        const downloadUrl = await s3Service.presign(
          bucket,
          keyToUse,
          'GET',
          true,
          asset.name || undefined,
        )

        const content: Array<TextContent | ImageContent> = []
        const textDescription = [
          `3D asset "${asset.name}" (ID: ${asset.id}, MIME: ${mimeType}, S3 Key: "${keyToUse}"):`,
          'Orthogonal 4-view composite image (2x2 grid across 360° rotation):',
          '- Top-Left quadrant: Front view (0°)',
          '- Top-Right quadrant: Right side view (90°)',
          '- Bottom-Left quadrant: Back view (180°)',
          '- Bottom-Right quadrant: Left side view (270°)',
        ].join('\n')

        if (s3KeyOnly) {
          content.push({
            type: 'text',
            text: textDescription,
          })
        } else {
          const { buffer, contentType } = await s3Service.getObject(bucket, keyToUse)
          const actualMimeType =
            contentType && contentType !== 'application/octet-stream' ? contentType : mimeType
          content.push({
            type: 'text',
            text: textDescription,
          })
          content.push({
            type: 'image',
            data: buffer.toString('base64'),
            mimeType: actualMimeType,
          })
        }

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

        let keyToUse = mediaKey
        let mimeType = getFileMimeType(null, keyToUse, asset.mediaType || 'image/png')

        if (annotationId) {
          const { annotations } = await resolveAnnotationsById(asset.id, annotationId)
          if (annotations && annotations.length > 0) {
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
              mimeType = 'image/webp'
            } else {
              throw new Error('Image annotation transcode workflow failed to output S3 key.')
            }
          }
        }

        const downloadUrl = await s3Service.presign(
          bucket,
          keyToUse,
          'GET',
          true,
          asset.name || undefined,
        )

        const content: Array<TextContent | ImageContent> = []

        if (s3KeyOnly) {
          content.push({
            type: 'text',
            text: `Image asset "${asset.name}" (ID: ${asset.id}, MIME: ${mimeType}, S3 Key: "${keyToUse}")`,
          })
        } else {
          const { buffer, contentType } = await s3Service.getObject(bucket, keyToUse)
          const actualMimeType =
            contentType && contentType !== 'application/octet-stream' ? contentType : mimeType
          content.push({
            type: 'text',
            text: `Image asset "${asset.name}" (ID: ${asset.id}, MIME: ${actualMimeType}, S3 Key: "${keyToUse}")`,
          })
          content.push({
            type: 'image',
            data: buffer.toString('base64'),
            mimeType: actualMimeType,
          })
        }

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
          Array<{ key: string; timestamp: number }> | undefined

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
          const downloadUrl = await s3Service.presign(
            bucket,
            shot.key,
            'GET',
            true,
            asset.name || undefined,
          )

          sourceKeys.push(shot.key)
          results.push({
            key: shot.key,
            timestamp: shot.timestamp,
            downloadUrl,
          })

          if (s3KeyOnly) {
            const mimeType = getFileMimeType(null, shot.key, 'image/webp')
            textLines.push(
              `- Frame at ${shot.timestamp}s (S3 Key: "${shot.key}", MIME: ${mimeType})`,
            )
          } else {
            const { buffer, contentType } = await s3Service.getObject(bucket, shot.key)
            const mimeType =
              contentType && contentType !== 'application/octet-stream'
                ? contentType
                : getFileMimeType(buffer, shot.key, 'image/webp')
            textLines.push(
              `- Frame at ${shot.timestamp}s (S3 Key: "${shot.key}", MIME: ${mimeType})`,
            )
            content.push({
              type: 'image',
              data: buffer.toString('base64'),
              mimeType,
            })
          }
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

          const docMimeType =
            asset.mediaType || getFileMimeType(null, asset.name || mediaKey, 'text/plain')
          const downloadUrl = await s3Service.presign(
            bucket,
            mediaKey,
            'GET',
            true,
            asset.name || undefined,
          )

          if (s3KeyOnly) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Document "${asset.name}" (ID: ${asset.id}, MIME: ${docMimeType}, S3 Key: "${mediaKey}")`,
                },
              ],
              details: {
                assetId: asset.id,
                name: asset.name,
                mediaType: asset.mediaType,
                key: mediaKey,
                downloadUrl,
                sourceKeys: [mediaKey],
                size: 0,
                isTruncated: false,
              },
            }
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

          return {
            content: [
              {
                type: 'text',
                text: `Document "${asset.name}" (ID: ${asset.id}, MIME: ${docMimeType}, S3 Key: "${mediaKey}"):\n\n${text}`,
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
          const downloadUrl = await s3Service.presign(
            bucket,
            pageItem.key,
            'GET',
            true,
            asset.name || undefined,
          )

          sourceKeys.push(pageItem.key)
          results.push({
            key: pageItem.key,
            page: pageItem.page,
            downloadUrl,
          })

          if (s3KeyOnly) {
            const mimeType = getFileMimeType(null, pageItem.key, 'image/webp')
            textLines.push(`- Page ${pageItem.page} (S3 Key: "${pageItem.key}", MIME: ${mimeType})`)
          } else {
            const { buffer, contentType } = await s3Service.getObject(bucket, pageItem.key)
            const mimeType =
              contentType && contentType !== 'application/octet-stream'
                ? contentType
                : getFileMimeType(buffer, pageItem.key, 'image/webp')
            textLines.push(`- Page ${pageItem.page} (S3 Key: "${pageItem.key}", MIME: ${mimeType})`)
            content.push({
              type: 'image',
              data: buffer.toString('base64'),
              mimeType,
            })
          }
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
