import { type AgentTool } from '@earendil-works/pi-agent-core'
import { EnabledMediaModel } from '@shumai/dtos'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { Type, type Static, type TSchema } from 'typebox'
import * as fs from 'fs'
import * as path from 'path'
import { ulid } from 'ulid'
import { resolveS3MediaBuffer } from './download-asset'

export function createGenerateImageTool(
  enabledModels: EnabledMediaModel[],
  providerKeys: Record<string, { apiKey?: string }>,
  userId?: string,
): AgentTool {
  const modelIdentifiers = enabledModels.map((m) => `${m.provider}:${m.modelId}`)
  const modelSchemas =
    modelIdentifiers.length === 1
      ? Type.Literal(modelIdentifiers[0])
      : Type.Union(
          modelIdentifiers.map((id) => Type.Literal(id)) as unknown as [
            TSchema,
            TSchema,
            ...TSchema[],
          ],
        )

  const generateImageSchema = Type.Object(
    {
      prompt: Type.String({
        description: 'The text prompt describing the image to generate in detail.',
      }),
      model: Type.Union([modelSchemas, Type.Null()], {
        description: `The image model to use, in "provider:modelId" format. Available enabled models: ${modelIdentifiers.join(', ')}. Pass null to use the first enabled model (${modelIdentifiers[0]}).`,
      }),
      outputFileName: Type.Union([
        Type.String({
          description:
            'Optional desired filename for the generated image (e.g. "cover.png"). Set to null for auto-generated name.',
        }),
        Type.Null(),
      ]),
      images: Type.Union([
        Type.Array(Type.String(), {
          description:
            'Optional list of storage S3 keys of images to use as image-to-image or style reference. Call read_asset with s3KeyOnly: true to obtain the S3 key of an asset or video frame without loading its content into context. Set to null if not using.',
        }),
        Type.Null(),
      ]),
      mask: Type.Union([
        Type.String({
          description:
            'Optional storage S3 key of an inpainting mask image (white=inpaint, black=keep). Call read_asset with s3KeyOnly: true to obtain the S3 key. Set to null if not inpainting.',
        }),
        Type.Null(),
      ]),
      aspectRatio: Type.Union([
        Type.String({
          description:
            'Optional aspect ratio, e.g. "1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2". Set to null for default.',
        }),
        Type.Null(),
      ]),
      size: Type.Union([
        Type.String({
          description:
            'Optional target image dimensions, e.g. "1024x1024", "1536x1024". Set to null for default.',
        }),
        Type.Null(),
      ]),
      seed: Type.Union([
        Type.Integer({
          description:
            'Optional random seed for reproducible generations. Set to null for random generation.',
        }),
        Type.Null(),
      ]),
    },
    { additionalProperties: false },
  )

  type GenerateImageParams = Static<typeof generateImageSchema>

  return {
    name: 'generate_image',
    label: 'Generate Image',
    description:
      'Generate an image using a configured image model. Supports text-to-image, reference images (image-to-image using S3 keys from read_asset), and inpainting (using a mask image S3 key from read_asset). The generated file is saved in the local .pi/ directory.',
    parameters: generateImageSchema,
    execute: async (_toolCallId, params) => {
      const p = params as GenerateImageParams

      const defaultModel = `${enabledModels[0].provider}:${enabledModels[0].modelId}`
      const selected = p.model || defaultModel
      const modelConfig =
        enabledModels.find((m) => `${m.provider}:${m.modelId}` === selected) ||
        enabledModels.find((m) => m.modelId === selected)

      if (!modelConfig) {
        throw new Error(
          `Image model "${selected}" is not enabled. Available enabled models: ${modelIdentifiers.join(', ')}`,
        )
      }

      const customKey = providerKeys[modelConfig.provider]?.apiKey
      const apiKey = mediaGenerationService.resolveApiKey(modelConfig.provider, customKey)
      if (!apiKey) {
        throw new Error(
          `API key for provider "${modelConfig.provider}" is not configured. Please configure it in settings.`,
        )
      }

      let resolvedImages: Buffer[] | undefined
      if (p.images && Array.isArray(p.images) && p.images.length > 0) {
        resolvedImages = await Promise.all(
          p.images.map(async (key: string) => {
            const { buffer } = await resolveS3MediaBuffer(key, userId || '')
            return buffer
          }),
        )
      }

      let resolvedMask: Buffer | undefined
      if (p.mask) {
        const { buffer } = await resolveS3MediaBuffer(p.mask, userId || '')
        resolvedMask = buffer
      }

      const { buffer, mimeType } = await mediaGenerationService.generateImage({
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        apiKey,
        prompt: p.prompt,
        images: resolvedImages,
        mask: resolvedMask,
        aspectRatio: (p.aspectRatio as `${number}:${number}`) || undefined,
        size: (p.size as `${number}x${number}`) || undefined,
        seed: p.seed !== null && p.seed !== undefined ? p.seed : undefined,
      })

      const piDir = path.join(process.cwd(), '.pi')
      if (!fs.existsSync(piDir)) {
        fs.mkdirSync(piDir, { recursive: true })
      }

      const safeMime = mimeType || 'image/png'
      let ext = '.png'
      if (safeMime.includes('jpeg') || safeMime.includes('jpg')) ext = '.jpg'
      else if (safeMime.includes('webp')) ext = '.webp'

      let filename: string
      if (p.outputFileName) {
        const safe = sanitizeFilename(p.outputFileName)
        filename = safe.includes('.') ? safe : `${safe}${ext}`
      } else {
        filename = `generated_image_${ulid()}${ext}`
      }

      const targetPath = path.join(piDir, filename)
      const relativePath = path.join('.pi', filename)
      fs.writeFileSync(targetPath, buffer)

      return {
        content: [
          {
            type: 'text',
            text: `Successfully generated image using model "${modelConfig.modelId}" (${modelConfig.provider}). Saved to "${relativePath}". Size: ${(buffer.length / 1024).toFixed(1)} KB.`,
          },
        ],
        details: {
          fileName: filename,
          filePath: relativePath,
          absolutePath: targetPath,
          size: buffer.length,
          mimeType,
          provider: modelConfig.provider,
          model: modelConfig.modelId,
        },
      }
    },
  }
}
