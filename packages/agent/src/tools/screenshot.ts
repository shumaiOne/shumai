import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { resolveAnnotationsById } from './annotation-resolver'

const screenshotSchema = Type.Object({
  assetId: Type.String({
    description: 'The asset ID of the video asset. This parameter is required.',
  }),
  start: Type.Number({ description: 'Start time in seconds' }),
  end: Type.Number({ description: 'End time in seconds' }),
  count: Type.Number({ description: 'Number of screenshots to take' }),
  annotationId: Type.Optional(
    Type.String({
      description:
        'The ID of the comment or message entry from <annotation id="..." /> whose visual markup should be overlaid on the screenshot.',
    }),
  ),
})

export function createScreenshotTool(userId: string): AgentTool<typeof screenshotSchema> {
  return {
    name: 'screenshot',
    label: 'Take Video Screenshots',
    description:
      'Takes screenshots for a video at specified interval. It returns the images to the agent context.',
    parameters: screenshotSchema,
    execute: async (_toolCallId, params) => {
      const assetId = params.assetId

      if (!userId) {
        throw new Error('User ID is required for authorization.')
      }

      await authzService.hasPermission({
        user: { id: userId } as User,
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: assetId,
      })

      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found.`)
      }

      // Resolve annotations dynamically by annotationId
      const { annotations, timestamp: commentTimestamp } = await resolveAnnotationsById(
        assetId,
        params.annotationId,
      )

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
              annotations,
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
        throw new Error('No screenshots were generated.')
      }

      const content: ImageContent[] = []
      const sourceKeys: string[] = []
      const bucket = process.env.S3_BUCKET || 'shumai'

      for (const shot of screenshots) {
        const { buffer, contentType } = await s3Service.getObject(bucket, shot.key)
        const mimeType =
          contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'
        content.push({
          type: 'image',
          data: buffer.toString('base64'),
          mimeType,
        })
        sourceKeys.push(shot.key)
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
