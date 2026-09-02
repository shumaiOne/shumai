import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { resolveAnnotationsById } from './annotation-resolver'

const readPdfPagesSchema = Type.Object({
  assetId: Type.String({
    description: 'Asset ID of the PDF document. This parameter is required.',
  }),
  start: Type.Number({ description: 'Start page number (1-based index)' }),
  end: Type.Number({ description: 'End page number (1-based index)' }),
  annotationId: Type.Optional(
    Type.String({
      description:
        'The ID of the comment or message entry from <annotation id="..." /> whose visual markup should be overlaid on the rendered PDF pages.',
    }),
  ),
})

export function createReadPdfPagesTool(userId: string): AgentTool<typeof readPdfPagesSchema> {
  return {
    name: 'read_pdf_pages',
    label: 'Read PDF Pages',
    description:
      'Converts specific page range of a PDF document into 1080p WebP images for visual analysis. Maximum 20 pages allowed per call.',
    parameters: readPdfPagesSchema,
    execute: async (_toolCallId, params) => {
      if (params.start < 1) {
        throw new Error(`Invalid page range: start page (${params.start}) must be at least 1.`)
      }

      if (params.start > params.end) {
        throw new Error(
          `Invalid page range: start page (${params.start}) must be less than or equal to end page (${params.end}).`,
        )
      }

      const MAX_PAGE_RANGE = 20
      const requestedPages = params.end - params.start + 1
      if (requestedPages > MAX_PAGE_RANGE) {
        throw new Error(
          `Page range (${requestedPages} pages requested) exceeds the maximum limit of ${MAX_PAGE_RANGE} pages per request.`,
        )
      }

      const targetAssetId = params.assetId

      if (!userId) {
        throw new Error('User ID is required for authorization.')
      }

      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: targetAssetId,
      })

      let asset = await prisma.asset.findUnique({
        where: { id: targetAssetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${targetAssetId} not found.`)
      }

      if (asset.type === 'version_stack') {
        const latestVersion = await prisma.asset.findFirst({
          where: { parentId: asset.id, isDeleted: false },
          orderBy: { sortIndex: 'asc' },
        })
        if (latestVersion) {
          asset = latestVersion
        }
      }

      const proxyType = (asset.media as PrismaJson.MediaInfo | null)?.proxyType
      if (proxyType !== 'pdf') {
        throw new Error(`Asset ${targetAssetId} is not a PDF or document.`)
      }

      // Resolve annotations dynamically by annotationId
      const { annotations, timestamp: commentTimestamp } = await resolveAnnotationsById(
        params.annotationId,
      )

      // Trigger transcode workflow to render PDF pages
      const task = await prisma.workflowTask.create({
        data: {
          assetId: targetAssetId,
          projectId: asset.projectId || 'none',
          type: WorkflowTaskType.transcode_pdf_pages,
          status: WorkflowTaskStatus.pending,
          payload: {
            projectId: asset.projectId || 'none',
            pdfPages: {
              start: params.start,
              end: params.end,
              commentTimestamp,
              annotations,
            },
          },
        },
      })

      const completedTask = await workflowService.executeWait(task)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = completedTask.output as any
      const pages = output?.pages as Array<{ key: string; page: number }> | undefined

      if (!pages || pages.length === 0) {
        throw new Error('No PDF page images were generated.')
      }

      const content: ImageContent[] = []
      const sourceKeys: string[] = []
      const bucket = process.env.S3_BUCKET || 'shumai'

      for (const pageItem of pages) {
        const { buffer, contentType } = await s3Service.getObject(bucket, pageItem.key)
        const mimeType =
          contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'
        content.push({
          type: 'image',
          data: buffer.toString('base64'),
          mimeType,
        })
        sourceKeys.push(pageItem.key)
      }

      return {
        content,
        details: {
          sourceKeys,
        },
      }
    },
  }
}
