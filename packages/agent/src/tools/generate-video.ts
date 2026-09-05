import { type AgentTool } from '@earendil-works/pi-agent-core'
import { EnabledMediaModel } from '@shumai/dtos'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { sanitizeFilename } from '@shumai/core/src/utils/filename'
import { Type, type TSchema } from 'typebox'
import * as fs from 'fs'
import * as path from 'path'
import { ulid } from 'ulid'
import { resolveMediaData } from './generate-image'

export function createGenerateVideoTool(
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
        description: `The video model to use. Available enabled models: ${enabledModels.map((m) => m.modelId).join(', ')}. Pass null to use the first enabled model (${enabledModels[0].modelId}).`,
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
                'Path (e.g. in .pi/), workspace asset ID, or URL of the image to animate.',
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
              Type.String({ description: 'Starting frame image path, asset ID, or URL.' }),
              Type.Null(),
            ]),
            lastFrame: Type.Union([
              Type.String({ description: 'Ending frame image path, asset ID, or URL.' }),
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
                'List of image/video paths, asset IDs, or URLs for style/motion/character reference.',
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

  return {
    name: 'generate_video',
    label: 'Generate Video',
    description:
      'Generate a video using a configured video model. Supports text-to-video, image-to-video, first/last frame, and reference-to-video. The generated file is saved in the local .pi/ directory.',
    parameters: generateVideoSchema,
    execute: async (_toolCallId, params) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = params as any

      const selectedModelId = p.model || enabledModels[0].modelId
      const modelConfig = enabledModels.find((m) => m.modelId === selectedModelId)
      if (!modelConfig) {
        throw new Error(
          `Video model "${selectedModelId}" is not enabled. Available enabled models: ${enabledModels.map((m) => m.modelId).join(', ')}`,
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
      let resolvedImage: string | Buffer | undefined
      let resolvedFirstFrame: string | Buffer | undefined
      let resolvedLastFrame: string | Buffer | undefined
      let resolvedReferences: Array<string | Buffer> | undefined

      if (p.mode === 'text_to_video') {
        if (!p.textToVideoConfig?.prompt) {
          throw new Error('textToVideoConfig.prompt is required when mode is "text_to_video"')
        }
        promptText = p.textToVideoConfig.prompt
      } else if (p.mode === 'image_to_video') {
        if (!p.imageToVideoConfig?.image) {
          throw new Error('imageToVideoConfig.image is required when mode is "image_to_video"')
        }
        resolvedImage = await resolveMediaData(p.imageToVideoConfig.image)
        promptText = p.imageToVideoConfig.prompt || ''
      } else if (p.mode === 'first_last_frame') {
        if (!p.firstLastFrameConfig?.firstFrame && !p.firstLastFrameConfig?.lastFrame) {
          throw new Error(
            'At least one of firstFrame or lastFrame is required in firstLastFrameConfig',
          )
        }
        if (p.firstLastFrameConfig.firstFrame) {
          resolvedFirstFrame = await resolveMediaData(p.firstLastFrameConfig.firstFrame)
        }
        if (p.firstLastFrameConfig.lastFrame) {
          resolvedLastFrame = await resolveMediaData(p.firstLastFrameConfig.lastFrame)
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
          p.referenceToVideoConfig.references.map((ref: string) => resolveMediaData(ref)),
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
        aspectRatio: p.aspectRatio || undefined,
        resolution: p.resolution || undefined,
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
