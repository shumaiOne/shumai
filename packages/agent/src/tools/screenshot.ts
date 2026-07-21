import { Type } from '@sinclair/typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

const screenshotSchema = Type.Object({
  assetId: Type.String({
    description: 'The asset ID of the video asset. This parameter is required.',
  }),
  start: Type.Number({ description: 'Start time in seconds' }),
  end: Type.Number({ description: 'End time in seconds' }),
  count: Type.Number({ description: 'Number of screenshots to take' }),
})

export function createScreenshotTool(
  userId?: string,
  userCommentId?: string | null,
): AgentTool<typeof screenshotSchema> {
  return {
    name: 'screenshot',
    label: 'Take Video Screenshots',
    description:
      'Takes screenshots for a video at specified interval. It returns the images to the agent context.',
    parameters: screenshotSchema,
    execute: async (_toolCallId, params) => {
      try {
        const assetId = params.assetId

        if (userId) {
          const user = await prisma.user.findUnique({ where: { id: userId } })
          if (!user) {
            return {
              content: [{ type: 'text', text: `User not found: ${userId}` }],
              details: {},
            }
          }
          await authzService.hasPermission({
            user,
            permission: Permission.Read,
            type: ResourceType.Asset,
            id: assetId,
          })
        }

        const asset = await prisma.asset.findUnique({
          where: { id: assetId },
        })

        if (!asset) {
          return {
            content: [{ type: 'text', text: `Asset with ID ${assetId} not found.` }],
            details: {},
          }
        }

        // Fetch trigger comment details for timestamp and annotations
        let commentTimestamp: number | null = null
        let annotations: unknown = null
        if (userCommentId) {
          const comment = await prisma.assetComment.findUnique({
            where: { id: userCommentId },
          })
          if (comment && comment.assetId === assetId) {
            commentTimestamp = comment.second !== null ? comment.second : null
            if (comment.annotation) {
              const list = comment.annotation
              if (Array.isArray(list) && list.length > 0) {
                annotations = list
              }
            }
          }
        }

        // Trigger transcode workflow to take screenshots
        const task = await prisma.workflowTask.create({
          data: {
            assetId,
            projectId: asset.projectId || 'none',
            type: WorkflowTaskType.transcode_screenshot,
            status: WorkflowTaskStatus.pending,
            payload: {
              projectId: asset.projectId || 'none',
              screenshot: {
                start: params.start,
                end: params.end,
                count: params.count,
                commentTimestamp,
                annotations: annotations as PrismaJson.AnnotationList,
              },
            },
          },
        })

        const completedTask = await workflowService.executeWait(task)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output = completedTask.output as any
        const screenshots = output?.screenshots as
          | Array<{ key: string; timestamp: number }>
          | undefined

        if (!screenshots || screenshots.length === 0) {
          return {
            content: [{ type: 'text', text: 'No screenshots were generated.' }],
            details: {},
          }
        }

        const content: ImageContent[] = []
        const sourceKeys: string[] = []
        const bucket = process.env.S3_BUCKET || 'shumai'

        for (const shot of screenshots) {
          const { buffer, contentType } = await s3Service.getObject(bucket, shot.key)
          content.push({
            type: 'image',
            data: buffer.toString('base64'),
            mimeType: contentType || 'image/webp',
          })
          sourceKeys.push(shot.key)
        }

        return {
          content,
          details: {
            sourceKeys,
          },
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error taking screenshots: ${
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
