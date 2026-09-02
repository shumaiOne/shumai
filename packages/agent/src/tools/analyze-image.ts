import { Type } from 'typebox'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { type ImageContent } from '@earendil-works/pi-ai'
import { prisma, WorkflowTaskType, WorkflowTaskStatus, type User } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { workflowService } from '@shumai/workflow-core'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { resolveAnnotationsById } from './annotation-resolver'

const analyzeImageSchema = Type.Object({
  assetId: Type.String({
    description: 'The asset ID of the image to analyze. This parameter is required.',
  }),
  annotationId: Type.Optional(
    Type.String({
      description:
        'The ID of the comment or message entry from <annotation id="..." /> whose visual markup should be overlaid on the image.',
    }),
  ),
})

export function createAnalyzeImageTool(userId: string): AgentTool<typeof analyzeImageSchema> {
  return {
    name: 'analyze_image',
    label: 'Analyze Image',
    description:
      'Retrieves and views the image content. Call this tool if you need to analyze the image.',
    parameters: analyzeImageSchema,
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
        throw new Error('No media content found for this asset.')
      }

      // Resolve annotations dynamically by annotationId
      const { annotations } = await resolveAnnotationsById(params.annotationId)

      let keyToUse = mediaKey

      if (annotations) {
        // Trigger transcode workflow to draw annotation
        const task = await prisma.workflowTask.create({
          data: {
            assetId,
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

      const mimeType =
        contentType && contentType !== 'application/octet-stream' ? contentType : 'image/webp'

      const content: ImageContent[] = [
        {
          type: 'image',
          data: buffer.toString('base64'),
          mimeType,
        },
      ]

      return {
        content,
        details: {
          sourceKeys: [keyToUse],
        },
      }
    },
  }
}
