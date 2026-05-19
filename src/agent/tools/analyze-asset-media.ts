import { s3Service } from '@/services/s3/s3'
import { Type } from '@sinclair/typebox'
import { defineTool } from '@mariozechner/pi-coding-agent'
import { ImageContent, TextContent } from '@mariozechner/pi-ai'
import { detectSupportedMimeType } from '@/utils/mime'

const analyzeAssetMediaSchema = Type.Object({
  key: Type.String({
    description:
      'The S3 key of the media file to analyze. This MUST be a key obtained from the asset media info.',
  }),
})

export interface MediaAnalysisDetails {
  sourceKey: string
}

export const analyzeAssetMediaTool = defineTool<
  typeof analyzeAssetMediaSchema,
  MediaAnalysisDetails
>({
  name: 'analyze_asset_media',
  label: 'Analyze Asset Media',
  description:
    'Retrieves and views the media content (images/video) by its S3 key. The key must be obtained from the asset media info provided in the context.',
  parameters: analyzeAssetMediaSchema,
  execute: async (_toolCallId, params) => {
    try {
      const { key } = params
      if (!key) {
        return {
          content: [{ type: 'text', text: 'S3 key is required.' }],
          details: { sourceKey: '' },
        }
      }

      const bucket = process.env.S3_BUCKET || 'shumai'
      const { buffer, contentType } = await s3Service.getObject(bucket, key)
      const uint8Array = new Uint8Array(buffer)
      let mimeType = contentType

      if (mimeType === 'application/octet-stream') {
        mimeType = detectSupportedMimeType(uint8Array) || 'application/octet-stream'
      }

      const content: (TextContent | ImageContent)[] = [
        {
          type: 'image',
          data: buffer.toString('base64'),
          mimeType,
        },
      ]

      return {
        content,
        details: {
          sourceKey: key,
        },
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing media: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        details: { sourceKey: params.key || '' },
      }
    }
  },
})
