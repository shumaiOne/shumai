import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

const readPdfPagesSchema = Type.Object({
  assetId: Type.String({
    description: 'Asset ID of the PDF document. This parameter is required.',
  }),
  start: Type.Number({ description: 'Start page number (1-based index)' }),
  end: Type.Number({ description: 'End page number (1-based index)' }),
})

export function createReadPdfPagesTool(
  userId: string,
  userCommentId?: string | null,
): AgentTool<typeof readPdfPagesSchema> {
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

      const asset = await prisma.asset.findUnique({
        where: { id: targetAssetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${targetAssetId} not found.`)
      }

      const proxyType = (asset.media as PrismaJson.MediaInfo | null)?.proxyType
      if (proxyType !== 'pdf') {
        throw new Error(`Asset ${targetAssetId} is not a PDF or document.`)
      }

      // Fetch trigger comment details for comment page and annotations
      let commentTimestamp: number | null = null
      let annotations: unknown = null
      if (userCommentId) {
        const comment = await prisma.assetComment.findUnique({
          where: { id: userCommentId },
        })
        if (comment && comment.assetId === targetAssetId) {
          commentTimestamp = comment.second !== null ? comment.second : null
          if (comment.annotation) {
            const list = comment.annotation
            if (Array.isArray(list) && list.length > 0) {
              annotations = list
            }
          }
        }
      }

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
              annotations: annotations as PrismaJson.AnnotationList,
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
        content.push({
          type: 'image',
          data: buffer.toString('base64'),
          mimeType: contentType || 'image/webp',
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
