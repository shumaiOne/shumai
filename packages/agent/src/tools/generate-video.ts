import { type AgentTool } from '@earendil-works/pi-agent-core'
import { EnabledMediaModel } from '@shumai/dtos'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { Type, type Static, type TSchema } from 'typebox'
import * as fs from 'fs'
import * as path from 'path'
import { ulid } from 'ulid'
import { resolveS3MediaBuffer } from './download-asset'

export function createGenerateVideoTool(
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

  const generateVideoSchema = Type.Object(
    {
      mode: Type.Union(
        [
          Type.Literal('text_to_video'),
          Type.Literal('image_to_video'),
          Type.Literal('first_last_frame'),
          Type.Literal('reference_to_video'),
        ],
        {
          description:
            'The video generation mode: "text_to_video", "image_to_video", "first_last_frame", or "reference_to_video".',
        },
      ),
      model: Type.Union([modelSchemas, Type.Null()], {
        description: `The video model to use, in "provider:modelId" format. Available enabled models: ${modelIdentifiers.join(', ')}. Pass null to use the first enabled model (${modelIdentifiers[0]}).`,
      }),
      outputFileName: Type.Union([
        Type.String({
          description:
            'Optional desired filename for the generated video (e.g. "intro.mp4"). Set to null for auto-generated name.',
        }),
        Type.Null(),
      ]),
      textToVideoConfig: Type.Union([
        Type.Object(
          {
            prompt: Type.String({
              description: 'Text prompt describing the desired video scene, action, and motion.',
            }),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
      imageToVideoConfig: Type.Union([
        Type.Object(
          {
            image: Type.String({
              description:
                'Storage S3 key of the image to animate. Call read_asset with s3KeyOnly: true to obtain the S3 key of an image asset or video frame without loading its content into context.',
            }),
            prompt: Type.Union([
              Type.String({
                description: 'Optional motion prompt describing how the image should animate.',
              }),
              Type.Null(),
            ]),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
      firstLastFrameConfig: Type.Union([
        Type.Object(
          {
            firstFrame: Type.Union([
              Type.String({
                description:
                  'Storage S3 key of the starting frame image. Call read_asset with s3KeyOnly: true to obtain the S3 key.',
              }),
              Type.Null(),
            ]),
            lastFrame: Type.Union([
              Type.String({
                description:
                  'Storage S3 key of the ending frame image. Call read_asset with s3KeyOnly: true to obtain the S3 key.',
              }),
              Type.Null(),
            ]),
            prompt: Type.Union([
              Type.String({ description: 'Optional prompt describing the transition.' }),
              Type.Null(),
            ]),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
      referenceToVideoConfig: Type.Union([
        Type.Object(
          {
            references: Type.Array(Type.String(), {
              description:
                'List of storage S3 keys for style/motion/character reference images. Call read_asset with s3KeyOnly: true to obtain the S3 keys.',
            }),
            prompt: Type.Union([
              Type.String({ description: 'Prompt describing the video to generate.' }),
              Type.Null(),
            ]),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
      aspectRatio: Type.Union([
        Type.String({
          description:
            'Optional aspect ratio: "16:9", "9:16", "1:1", or "adaptive", or null for default.',
        }),
        Type.Null(),
      ]),
      resolution: Type.Union([
        Type.String({
          description: 'Optional target video resolution, e.g. "1280x720", or null for default.',
        }),
        Type.Null(),
      ]),
      duration: Type.Union([
        Type.Integer({ description: 'Optional duration in seconds, or null for default.' }),
        Type.Null(),
      ]),
      fps: Type.Union([
        Type.Integer({ description: 'Optional frames per second, or null for default.' }),
        Type.Null(),
      ]),
      generateAudio: Type.Union([
        Type.Boolean({
          description: 'Whether to generate audio alongside video, or null for default.',
        }),
        Type.Null(),
      ]),
      seed: Type.Union([
        Type.Integer({
          description:
            'Optional random seed for reproducible video generation, or null for random.',
        }),
        Type.Null(),
      ]),
    },
    { additionalProperties: false },
  )

  type GenerateVideoParams = Static<typeof generateVideoSchema>

  return {
    name: 'generate_video',
    label: 'Generate Video',
    description:
      'Generate a video using a configured video model. Supports text-to-video, image-to-video (using an S3 image key from read_asset), first/last frame (using S3 image keys from read_asset), and reference-to-video (using S3 image keys from read_asset). The generated file is saved in the local .pi/ directory.',
    parameters: generateVideoSchema,
    execute: async (_toolCallId, params) => {
      const p = params as GenerateVideoParams

      const defaultModel = `${enabledModels[0].provider}:${enabledModels[0].modelId}`
      const selected = p.model || defaultModel
      const modelConfig =
        enabledModels.find((m) => `${m.provider}:${m.modelId}` === selected) ||
        enabledModels.find((m) => m.modelId === selected)

      if (!modelConfig) {
        throw new Error(
          `Video model "${selected}" is not enabled. Available enabled models: ${modelIdentifiers.join(', ')}`,
        )
      }

      const customKey = providerKeys[modelConfig.provider]?.apiKey
      const apiKey = mediaGenerationService.resolveApiKey(modelConfig.provider, customKey)
      if (!apiKey) {
        throw new Error(
          `API key for provider "${modelConfig.provider}" is not configured. Please configure it in settings.`,
        )
      }

      let promptText = ''
      let resolvedImage: Buffer | undefined
      let resolvedFirstFrame: Buffer | undefined
      let resolvedLastFrame: Buffer | undefined
      let resolvedReferences: Buffer[] | undefined

      if (p.mode === 'text_to_video') {
        if (!p.textToVideoConfig?.prompt) {
          throw new Error('textToVideoConfig.prompt is required when mode is "text_to_video"')
        }
        promptText = p.textToVideoConfig.prompt
      } else if (p.mode === 'image_to_video') {
        if (!p.imageToVideoConfig?.image) {
          throw new Error('imageToVideoConfig.image is required when mode is "image_to_video"')
        }
        const { buffer } = await resolveS3MediaBuffer(p.imageToVideoConfig.image, userId || '')
        resolvedImage = buffer
        promptText = p.imageToVideoConfig.prompt || ''
      } else if (p.mode === 'first_last_frame') {
        if (!p.firstLastFrameConfig?.firstFrame && !p.firstLastFrameConfig?.lastFrame) {
          throw new Error(
            'At least one of firstFrame or lastFrame is required in firstLastFrameConfig',
          )
        }
        if (p.firstLastFrameConfig.firstFrame) {
          const { buffer } = await resolveS3MediaBuffer(
            p.firstLastFrameConfig.firstFrame,
            userId || '',
          )
          resolvedFirstFrame = buffer
        }
        if (p.firstLastFrameConfig.lastFrame) {
          const { buffer } = await resolveS3MediaBuffer(
            p.firstLastFrameConfig.lastFrame,
            userId || '',
          )
          resolvedLastFrame = buffer
        }
        promptText = p.firstLastFrameConfig.prompt || ''
      } else if (p.mode === 'reference_to_video') {
        if (
          !p.referenceToVideoConfig?.references ||
          p.referenceToVideoConfig.references.length === 0
        ) {
          throw new Error('referenceToVideoConfig.references list is required')
        }
        resolvedReferences = await Promise.all(
          p.referenceToVideoConfig.references.map(async (ref: string) => {
            const { buffer } = await resolveS3MediaBuffer(ref, userId || '')
            return buffer
          }),
        )
        promptText = p.referenceToVideoConfig.prompt || ''
      }

      const { buffer, mimeType } = await mediaGenerationService.generateVideo({
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        apiKey,
        mode: p.mode,
        prompt: promptText,
        image: resolvedImage,
        firstFrame: resolvedFirstFrame,
        lastFrame: resolvedLastFrame,
        inputReferences: resolvedReferences,
        aspectRatio: (p.aspectRatio as `${number}:${number}` | 'adaptive') || undefined,
        resolution: (p.resolution as `${number}x${number}`) || undefined,
        duration: p.duration !== null && p.duration !== undefined ? p.duration : undefined,
        fps: p.fps !== null && p.fps !== undefined ? p.fps : undefined,
        generateAudio: p.generateAudio !== null ? p.generateAudio : undefined,
        seed: p.seed !== null && p.seed !== undefined ? p.seed : undefined,
      })

      const piDir = path.join(process.cwd(), '.pi')
      if (!fs.existsSync(piDir)) {
        fs.mkdirSync(piDir, { recursive: true })
      }

      let filename: string
      if (p.outputFileName) {
        const safe = sanitizeFilename(p.outputFileName)
        filename = safe.endsWith('.mp4') ? safe : `${safe}.mp4`
      } else {
        filename = `generated_video_${ulid()}.mp4`
      }

      const targetPath = path.join(piDir, filename)
      const relativePath = path.join('.pi', filename)
      fs.writeFileSync(targetPath, buffer)

      return {
        content: [
          {
            type: 'text',
            text: `Successfully generated video using model "${modelConfig.modelId}" (${modelConfig.provider}) in mode "${p.mode}". Saved to "${relativePath}". Size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.`,
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
          mode: p.mode,
        },
      }
    },
  }
}
