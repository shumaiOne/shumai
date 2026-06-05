import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'

const analyzeImageSchema = Type.Object({})

export function createAnalyzeImageTool(
  assetId: string,
  userCommentId?: string | null,
): AgentTool<typeof analyzeImageSchema> {
  return {
    name: 'analyze_image',
    label: 'Analyze Image',
    description:
      'Retrieves and views the image content. Call this tool if you need to analyze the image.',
    parameters: analyzeImageSchema,
    execute: async () => {
      try {
        const asset = await prisma.asset.findUnique({
          where: { id: assetId },
          include: { storageKey: true },
        })

        if (!asset) {
          return {
            content: [{ type: 'text', text: `Asset with ID ${assetId} not found.` }],
            details: {},
          }
        }

        // Get default media key
        let mediaKey = asset.storageKey?.key
        if (asset.media) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mediaInfo = asset.media as any
          if (mediaInfo.imageTranscodes && mediaInfo.imageTranscodes.length > 0) {
            mediaKey = mediaInfo.imageTranscodes[0].key || mediaKey
          }
        }

        if (!mediaKey) {
          return {
            content: [{ type: 'text', text: 'No media content found for this asset.' }],
            details: {},
          }
        }

        // Check if trigger comment has draw annotations
        let annotations: unknown = null
        if (userCommentId) {
          const comment = await prisma.assetComment.findUnique({
            where: { id: userCommentId },
          })
          if (comment?.annotation) {
            const list = comment.annotation
            if (Array.isArray(list) && list.length > 0) {
              annotations = list
            }
          }
        }

        let keyToUse = mediaKey

        if (annotations) {
          // Trigger transcode workflow to draw annotation
          const task = await prisma.workflowTask.create({
            data: {
              assetId,
              projectId: asset.projectId || 'none',
              type: WorkflowTaskType.transcode,
              status: WorkflowTaskStatus.pending,
              payload: {
                projectId: asset.projectId || 'none',
                imageAnnotation: {
                  annotations: annotations as PrismaJson.AnnotationList,
                },
              },
            },
          })

          const completedTask = await workflowService.executeWait(task)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const output = completedTask.output as any
          if (output?.key) {
            keyToUse = output.key
          } else {
            throw new Error('Image annotation transcode workflow failed to output S3 key.')
          }
        }

        // Retrieve the image content from S3
        const bucket = process.env.S3_BUCKET || 'shumai'
        const { buffer, contentType } = await s3Service.getObject(bucket, keyToUse)

        const content: ImageContent[] = [
          {
            type: 'image',
            data: buffer.toString('base64'),
            mimeType: contentType || 'image/webp',
          },
        ]

        return {
          content,
          details: {
            sourceKeys: [keyToUse],
          },
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error analyzing image: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          details: {},
        }
      }
    },
  }
}
