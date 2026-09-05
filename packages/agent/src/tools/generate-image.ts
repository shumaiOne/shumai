import { type AgentTool } from '@earendil-works/pi-agent-core'
import { EnabledMediaModel } from '@shumai/dtos'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { s3Service } from '@shumai/core/src/s3/s3'
import { prisma } from '@shumai/db'
import { Type, type TSchema } from 'typebox'
import * as fs from 'fs'
import * as path from 'path'
import { ulid } from 'ulid'

export async function resolveMediaData(input: string): Promise<string | Buffer> {
  const trimmed = input.trim()
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }

  // Check direct local path
  const absPath = path.resolve(process.cwd(), trimmed)
  if (fs.existsSync(absPath)) {
    return fs.readFileSync(absPath)
  }

  // Check path relative to .pi
  const piPath = path.resolve(process.cwd(), '.pi', trimmed)
  if (fs.existsSync(piPath)) {
    return fs.readFileSync(piPath)
  }

  // Check if it is a storage key
  if (trimmed.startsWith('files/')) {
    const bucket = process.env.S3_BUCKET || 'shumai'
    const { buffer } = await s3Service.getObject(bucket, trimmed)
    return buffer
  }

  // Check if it is an asset ID
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: trimmed, isDeleted: false },
      include: { storageKey: true },
    })
    if (asset?.storageKey?.key) {
      const bucket = process.env.S3_BUCKET || 'shumai'
      const { buffer } = await s3Service.getObject(bucket, asset.storageKey.key)
      return buffer
    }
  } catch {
    // ignore db lookup failure
  }

  throw new Error(`Could not resolve media input "${input}" from disk, URL, or asset library.`)
}

export function createGenerateImageTool(
  enabledModels: EnabledMediaModel[],
  providerKeys: Record<string, { apiKey?: string }>,
): AgentTool {
  const modelSchemas =
    enabledModels.length === 1
      ? Type.Literal(enabledModels[0].modelId)
      : Type.Union(
          enabledModels.map((m) => Type.Literal(m.modelId)) as unknown as [
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
        description: `The image model to use. Available enabled models: ${enabledModels.map((m) => m.modelId).join(', ')}. Pass null to use the first enabled model (${enabledModels[0].modelId}).`,
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
            'Optional list of reference image paths (e.g. in .pi/), workspace asset IDs, or URLs for image-to-image or style reference. Set to null if not using.',
        }),
        Type.Null(),
      ]),
      mask: Type.Union([
        Type.String({
          description:
            'Optional path or URL to an inpainting mask image (white=inpaint, black=keep). Set to null if not inpainting.',
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

  return {
    name: 'generate_image',
    label: 'Generate Image',
    description:
      'Generate an image using a configured image model. Supports text-to-image, reference images (image-to-image), and inpainting. The generated file is saved in the local .pi/ directory.',
    parameters: generateImageSchema,
    execute: async (_toolCallId, params) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = params as any

      const selectedModelId = p.model || enabledModels[0].modelId
      const modelConfig = enabledModels.find((m) => m.modelId === selectedModelId)
      if (!modelConfig) {
        throw new Error(
          `Image model "${selectedModelId}" is not enabled. Available enabled models: ${enabledModels.map((m) => m.modelId).join(', ')}`,
        )
      }

      const customKey = providerKeys[modelConfig.provider]?.apiKey
      const apiKey = mediaGenerationService.resolveApiKey(modelConfig.provider, customKey)
      if (!apiKey) {
        throw new Error(
          `API key for provider "${modelConfig.provider}" is not configured. Please configure it in settings.`,
        )
      }

      let resolvedImages: Array<string | Buffer> | undefined
      if (p.images && Array.isArray(p.images) && p.images.length > 0) {
        resolvedImages = await Promise.all(p.images.map((img: string) => resolveMediaData(img)))
      }

      let resolvedMask: string | Buffer | undefined
      if (p.mask) {
        resolvedMask = await resolveMediaData(p.mask)
      }

      const { buffer, mimeType } = await mediaGenerationService.generateImage({
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        apiKey,
        prompt: p.prompt,
        images: resolvedImages,
        mask: resolvedMask,
        aspectRatio: p.aspectRatio || undefined,
        size: p.size || undefined,
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
