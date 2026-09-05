import { prisma } from '@shumai/db'
import {
  CreateEnabledMediaModelRequest,
  CuratedMediaModel,
  EnabledMediaModel,
  MediaGenerationSettingsResponse,
  MediaModelType,
  MediaProviderStatus,
} from '@shumai/dtos'
import { ulid } from 'ulid'
import { HTTPException } from 'hono/http-exception'
import { generateImage as aiGenerateImage, experimental_generateVideo as aiGenerateVideo } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGoogleVertex } from '@ai-sdk/google-vertex'
import { createXai } from '@ai-sdk/xai'
import { createFal } from '@ai-sdk/fal'
import { createReplicate } from '@ai-sdk/replicate'
import { createBlackForestLabs } from '@ai-sdk/black-forest-labs'
import { createKlingAI } from '@ai-sdk/klingai'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createFireworks } from '@ai-sdk/fireworks'
import { createDeepInfra } from '@ai-sdk/deepinfra'
import { createLuma } from '@ai-sdk/luma'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'

export interface CuratedModelItem {
  modelId: string
  name: string
  type: MediaModelType
}

export interface BuiltinMediaProviderDef {
  provider: string
  displayName: string
  defaultEnvKey: string
  supportedTypes: MediaModelType[]
  curatedModels: CuratedModelItem[]
}

export const BUILTIN_MEDIA_PROVIDERS: Record<string, BuiltinMediaProviderDef> = {
  openai: {
    provider: 'openai',
    displayName: 'OpenAI',
    defaultEnvKey: 'OPENAI_API_KEY',
    supportedTypes: ['image'],
    curatedModels: [
      { modelId: 'dall-e-3', name: 'DALL-E 3', type: 'image' },
      { modelId: 'gpt-image-2', name: 'GPT Image 2', type: 'image' },
      { modelId: 'dall-e-2', name: 'DALL-E 2', type: 'image' },
      { modelId: 'gpt-image-1.5', name: 'GPT Image 1.5', type: 'image' },
      { modelId: 'gpt-image-1', name: 'GPT Image 1', type: 'image' },
      { modelId: 'gpt-image-1-mini', name: 'GPT Image 1 Mini', type: 'image' },
      { modelId: 'chatgpt-image-latest', name: 'ChatGPT Image Latest', type: 'image' },
    ],
  },
  google: {
    provider: 'google',
    displayName: 'Google',
    defaultEnvKey: 'GEMINI_API_KEY',
    supportedTypes: ['image', 'video'],
    curatedModels: [
      { modelId: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', type: 'image' },
      { modelId: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', type: 'image' },
      {
        modelId: 'gemini-3.1-flash-image-preview',
        name: 'Gemini 3.1 Flash Image Preview',
        type: 'image',
      },
      { modelId: 'veo-3.1-generate', name: 'Veo 3.1', type: 'video' },
      { modelId: 'veo-3.1-generate-preview', name: 'Veo 3.1 Preview', type: 'video' },
      { modelId: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast Preview', type: 'video' },
      { modelId: 'veo-3.0-generate-001', name: 'Veo 3.0', type: 'video' },
      { modelId: 'veo-3.0-fast-generate-001', name: 'Veo 3.0 Fast', type: 'video' },
      { modelId: 'veo-2.0-generate-001', name: 'Veo 2.0', type: 'video' },
    ],
  },
  'google-vertex': {
    provider: 'google-vertex',
    displayName: 'Google Vertex',
    defaultEnvKey: 'GOOGLE_CLOUD_API_KEY',
    supportedTypes: ['image', 'video'],
    curatedModels: [
      { modelId: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', type: 'image' },
      { modelId: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', type: 'image' },
      { modelId: 'veo-3.1-generate-001', name: 'Veo 3.1', type: 'video' },
      { modelId: 'veo-3.1-fast-generate-001', name: 'Veo 3.1 Fast', type: 'video' },
      { modelId: 'veo-3.0-generate-001', name: 'Veo 3.0', type: 'video' },
      { modelId: 'veo-2.0-generate-001', name: 'Veo 2.0', type: 'video' },
    ],
  },
  xai: {
    provider: 'xai',
    displayName: 'xAI',
    defaultEnvKey: 'XAI_API_KEY',
    supportedTypes: ['image', 'video'],
    curatedModels: [
      { modelId: 'grok-imagine-image', name: 'Grok Imagine Image', type: 'image' },
      { modelId: 'grok-imagine-image-pro', name: 'Grok Imagine Image Pro', type: 'image' },
      { modelId: 'grok-imagine-video', name: 'Grok Imagine Video', type: 'video' },
      { modelId: 'grok-imagine-video-1.5', name: 'Grok Imagine Video 1.5', type: 'video' },
    ],
  },
  fal: {
    provider: 'fal',
    displayName: 'Fal',
    defaultEnvKey: 'FAL_KEY',
    supportedTypes: ['image', 'video'],
    curatedModels: [
      { modelId: 'fal-ai/flux/dev', name: 'FLUX Dev', type: 'image' },
      { modelId: 'fal-ai/flux/schnell', name: 'FLUX Schnell', type: 'image' },
      { modelId: 'fal-ai/flux-pro/v1.1-ultra', name: 'FLUX Pro 1.1 Ultra', type: 'image' },
      { modelId: 'fal-ai/flux-pro/v1.1', name: 'FLUX Pro 1.1', type: 'image' },
      { modelId: 'fal-ai/flux-pro/kontext', name: 'FLUX Pro Kontext', type: 'image' },
      { modelId: 'fal-ai/recraft/v3/text-to-image', name: 'Recraft v3', type: 'image' },
      { modelId: 'fal-ai/ideogram/character', name: 'Ideogram Character', type: 'image' },
      { modelId: 'fal-ai/imagen4/preview', name: 'Imagen 4 Preview', type: 'image' },
      { modelId: 'fal-ai/luma-photon', name: 'Luma Photon', type: 'image' },
      { modelId: 'fal-ai/wan/v2.2-5b/text-to-image', name: 'Wan 2.2 5B', type: 'image' },
      { modelId: 'luma-ray-2', name: 'Luma Ray 2', type: 'video' },
      { modelId: 'luma-ray-2-flash', name: 'Luma Ray 2 Flash', type: 'video' },
      { modelId: 'luma-dream-machine', name: 'Luma Dream Machine', type: 'video' },
      { modelId: 'minimax-video', name: 'MiniMax Video', type: 'video' },
      { modelId: 'hunyuan-video', name: 'Hunyuan Video', type: 'video' },
    ],
  },
  replicate: {
    provider: 'replicate',
    displayName: 'Replicate',
    defaultEnvKey: 'REPLICATE_API_TOKEN',
    supportedTypes: ['image', 'video'],
    curatedModels: [
      { modelId: 'black-forest-labs/flux-1.1-pro', name: 'FLUX 1.1 Pro', type: 'image' },
      {
        modelId: 'black-forest-labs/flux-1.1-pro-ultra',
        name: 'FLUX 1.1 Pro Ultra',
        type: 'image',
      },
      { modelId: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', type: 'image' },
      { modelId: 'black-forest-labs/flux-dev', name: 'FLUX Dev', type: 'image' },
      { modelId: 'recraft-ai/recraft-v3', name: 'Recraft v3', type: 'image' },
      { modelId: 'ideogram-ai/ideogram-v2', name: 'Ideogram v2', type: 'image' },
      { modelId: 'stability-ai/stable-diffusion-3.5-large', name: 'SD 3.5 Large', type: 'image' },
      { modelId: 'luma/photon', name: 'Luma Photon', type: 'image' },
      { modelId: 'minimax/video-01', name: 'MiniMax Video-01', type: 'video' },
    ],
  },
  'black-forest-labs': {
    provider: 'black-forest-labs',
    displayName: 'Black Forest Labs',
    defaultEnvKey: 'BFL_API_KEY',
    supportedTypes: ['image', 'video'],
    curatedModels: [
      { modelId: 'flux-kontext-pro', name: 'FLUX Kontext Pro', type: 'image' },
      { modelId: 'flux-kontext-max', name: 'FLUX Kontext Max', type: 'image' },
      { modelId: 'flux-pro-1.1-ultra', name: 'FLUX Pro 1.1 Ultra', type: 'image' },
      { modelId: 'flux-pro-1.1', name: 'FLUX Pro 1.1', type: 'image' },
      { modelId: 'flux-pro-1.0-fill', name: 'FLUX Pro 1.0 Fill', type: 'image' },
      { modelId: 'flux-3-video', name: 'FLUX 3 Video', type: 'video' },
    ],
  },
  klingai: {
    provider: 'klingai',
    displayName: 'Kling AI',
    defaultEnvKey: 'KLINGAI_API_KEY',
    supportedTypes: ['video'],
    curatedModels: [
      { modelId: 'kling-v3.0-t2v', name: 'Kling v3.0 T2V', type: 'video' },
      { modelId: 'kling-v3.0-i2v', name: 'Kling v3.0 I2V', type: 'video' },
      { modelId: 'kling-v3.0-motion-control', name: 'Kling v3.0 Motion Control', type: 'video' },
      { modelId: 'kling-v2.6-t2v', name: 'Kling v2.6 T2V', type: 'video' },
      { modelId: 'kling-v2.6-i2v', name: 'Kling v2.6 I2V', type: 'video' },
      { modelId: 'kling-v2.6-motion-control', name: 'Kling v2.6 Motion Control', type: 'video' },
      { modelId: 'kling-v2.5-turbo-t2v', name: 'Kling v2.5 Turbo T2V', type: 'video' },
      { modelId: 'kling-v2.1-master-t2v', name: 'Kling v2.1 Master T2V', type: 'video' },
    ],
  },
  togetherai: {
    provider: 'togetherai',
    displayName: 'Together.ai',
    defaultEnvKey: 'TOGETHER_API_KEY',
    supportedTypes: ['image'],
    curatedModels: [
      { modelId: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell', type: 'image' },
      { modelId: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1 Dev', type: 'image' },
      { modelId: 'black-forest-labs/FLUX.1.1-pro', name: 'FLUX.1.1 Pro', type: 'image' },
      {
        modelId: 'black-forest-labs/FLUX.1-kontext-pro',
        name: 'FLUX.1 Kontext Pro',
        type: 'image',
      },
      { modelId: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', type: 'image' },
    ],
  },
  fireworks: {
    provider: 'fireworks',
    displayName: 'Fireworks',
    defaultEnvKey: 'FIREWORKS_API_KEY',
    supportedTypes: ['image'],
    curatedModels: [
      {
        modelId: 'accounts/fireworks/models/flux-1-dev-fp8',
        name: 'FLUX.1 Dev FP8',
        type: 'image',
      },
      {
        modelId: 'accounts/fireworks/models/flux-1-schnell-fp8',
        name: 'FLUX.1 Schnell FP8',
        type: 'image',
      },
      {
        modelId: 'accounts/fireworks/models/flux-kontext-pro',
        name: 'FLUX Kontext Pro',
        type: 'image',
      },
      {
        modelId: 'accounts/fireworks/models/playground-v2-5-1024px-aesthetic',
        name: 'Playground v2.5',
        type: 'image',
      },
    ],
  },
  deepinfra: {
    provider: 'deepinfra',
    displayName: 'DeepInfra',
    defaultEnvKey: 'DEEPINFRA_API_KEY',
    supportedTypes: ['image'],
    curatedModels: [
      { modelId: 'black-forest-labs/FLUX-1.1-pro', name: 'FLUX 1.1 Pro', type: 'image' },
      { modelId: 'black-forest-labs/FLUX-1-schnell', name: 'FLUX 1 Schnell', type: 'image' },
      { modelId: 'black-forest-labs/FLUX-1-dev', name: 'FLUX 1 Dev', type: 'image' },
      { modelId: 'stabilityai/sd3.5', name: 'SD 3.5', type: 'image' },
    ],
  },
  luma: {
    provider: 'luma',
    displayName: 'Luma',
    defaultEnvKey: 'LUMA_API_KEY',
    supportedTypes: ['image'],
    curatedModels: [
      { modelId: 'photon-1', name: 'Photon 1', type: 'image' },
      { modelId: 'photon-flash-1', name: 'Photon Flash 1', type: 'image' },
    ],
  },
  'amazon-bedrock': {
    provider: 'amazon-bedrock',
    displayName: 'Amazon Bedrock',
    defaultEnvKey: 'AWS_ACCESS_KEY_ID',
    supportedTypes: ['image'],
    curatedModels: [
      { modelId: 'amazon.nova-canvas-v1:0', name: 'Amazon Nova Canvas v1', type: 'image' },
    ],
  },
}

export interface GenerateImageServiceParams {
  provider: string
  modelId: string
  apiKey: string
  prompt: string
  images?: Array<string | Uint8Array | Buffer>
  mask?: string | Uint8Array | Buffer
  aspectRatio?: `${number}:${number}`
  size?: `${number}x${number}`
  seed?: number
}

export interface GenerateVideoServiceParams {
  provider: string
  modelId: string
  apiKey: string
  mode: 'text_to_video' | 'image_to_video' | 'first_last_frame' | 'reference_to_video'
  prompt?: string
  image?: string | Uint8Array | Buffer
  firstFrame?: string | Uint8Array | Buffer
  lastFrame?: string | Uint8Array | Buffer
  inputReferences?: Array<string | Uint8Array | Buffer>
  aspectRatio?: `${number}:${number}` | 'adaptive'
  resolution?: `${number}x${number}`
  duration?: number
  fps?: number
  generateAudio?: boolean
  seed?: number
}

export class MediaGenerationService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  resolveApiKey(provider: string, customApiKeyOrEnv?: string): string | undefined {
    if (customApiKeyOrEnv && customApiKeyOrEnv.trim()) {
      const trimmed = customApiKeyOrEnv.trim()
      // If it matches an environment variable name, use that env var value
      if (process.env[trimmed]) {
        return process.env[trimmed]
      }
      return trimmed
    }
    const def = BUILTIN_MEDIA_PROVIDERS[provider]
    if (def?.defaultEnvKey && process.env[def.defaultEnvKey]) {
      return process.env[def.defaultEnvKey]
    }
    return undefined
  }

  getCuratedModels(provider?: string, type?: 'image' | 'video'): CuratedMediaModel[] {
    const list: CuratedMediaModel[] = []
    for (const [p, def] of Object.entries(BUILTIN_MEDIA_PROVIDERS)) {
      if (provider && p !== provider) continue
      for (const m of def.curatedModels) {
        if (type && m.type !== type) continue
        list.push({
          modelId: m.modelId,
          name: m.name,
          type: m.type,
        })
      }
    }
    return list
  }

  async getSettings(teamId: string): Promise<MediaGenerationSettingsResponse> {
    const team = await this.prismaClient.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    if (!team) {
      throw new HTTPException(404, { message: 'Team not found' })
    }

    const mediaSettings = team.settings?.mediaGeneration || {}
    const customProviders = mediaSettings.providers || {}
    const enabledModels = (mediaSettings.enabledModels || []).map((m) => ({
      id: m.id,
      type: m.type,
      provider: m.provider,
      modelId: m.modelId,
      name: m.name || '',
      createdAt: m.createdAt,
    }))

    const providers: MediaProviderStatus[] = Object.values(BUILTIN_MEDIA_PROVIDERS).map((def) => {
      const customConfig = customProviders[def.provider]
      const customKey = customConfig?.apiKey?.trim()
      const resolvedKey = this.resolveApiKey(def.provider, customKey)

      let status: MediaProviderStatus['status'] = 'not_configured'
      if (customKey) {
        status = 'configured_custom'
      } else if (resolvedKey) {
        status = 'configured_env'
      }

      return {
        provider: def.provider,
        defaultEnvKey: def.defaultEnvKey,
        apiKeyConfigured: !!resolvedKey,
        status,
        customApiKeyOrEnv: customKey || undefined,
        supportedTypes: def.supportedTypes,
      }
    })

    return {
      providers,
      enabledModels,
    }
  }

  async updateProviderApiKey(teamId: string, provider: string, apiKey?: string): Promise<void> {
    if (!BUILTIN_MEDIA_PROVIDERS[provider]) {
      throw new HTTPException(400, { message: `Unknown media provider: "${provider}"` })
    }

    const team = await this.prismaClient.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    if (!team) {
      throw new HTTPException(404, { message: 'Team not found' })
    }

    const currentSettings = team.settings || { transcode: { videoStrategy: 'best_match' } }
    const mediaGen = currentSettings.mediaGeneration || {}
    const providers = mediaGen.providers || {}

    if (apiKey && apiKey.trim()) {
      providers[provider] = { apiKey: apiKey.trim() }
    } else {
      delete providers[provider]
    }

    mediaGen.providers = providers
    currentSettings.mediaGeneration = mediaGen

    await this.prismaClient.team.update({
      where: { id: teamId },
      data: { settings: currentSettings },
    })
  }

  async addEnabledModel(
    teamId: string,
    data: CreateEnabledMediaModelRequest,
  ): Promise<EnabledMediaModel> {
    const providerDef = BUILTIN_MEDIA_PROVIDERS[data.provider]
    if (!providerDef) {
      throw new HTTPException(400, { message: `Unknown media provider: "${data.provider}"` })
    }

    if (!providerDef.supportedTypes.includes(data.type)) {
      throw new HTTPException(400, {
        message: `Provider "${data.provider}" does not support ${data.type} generation`,
      })
    }

    const team = await this.prismaClient.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    if (!team) {
      throw new HTTPException(404, { message: 'Team not found' })
    }

    const currentSettings = team.settings || { transcode: { videoStrategy: 'best_match' } }
    const mediaGen = currentSettings.mediaGeneration || {}
    const enabledModels = mediaGen.enabledModels || []

    const alreadyExists = enabledModels.some(
      (m) => m.provider === data.provider && m.modelId === data.modelId && m.type === data.type,
    )
    if (alreadyExists) {
      throw new HTTPException(400, {
        message: `Model "${data.modelId}" is already enabled for provider "${data.provider}"`,
      })
    }

    const newModel: PrismaJson.EnabledMediaModelConfig = {
      id: ulid(),
      type: data.type,
      provider: data.provider,
      modelId: data.modelId,
      name: data.name || '',
      createdAt: new Date().toISOString(),
    }

    enabledModels.push(newModel)
    mediaGen.enabledModels = enabledModels
    currentSettings.mediaGeneration = mediaGen

    await this.prismaClient.team.update({
      where: { id: teamId },
      data: { settings: currentSettings },
    })

    return {
      id: newModel.id,
      type: newModel.type,
      provider: newModel.provider,
      modelId: newModel.modelId,
      name: newModel.name || '',
      createdAt: newModel.createdAt,
    }
  }

  async removeEnabledModel(teamId: string, modelId: string): Promise<void> {
    const team = await this.prismaClient.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    if (!team) {
      throw new HTTPException(404, { message: 'Team not found' })
    }

    const currentSettings = team.settings || { transcode: { videoStrategy: 'best_match' } }
    const mediaGen = currentSettings.mediaGeneration || {}
    const enabledModels = mediaGen.enabledModels || []

    const nextModels = enabledModels.filter((m) => m.id !== modelId)
    if (nextModels.length === enabledModels.length) {
      throw new HTTPException(404, { message: `Enabled model "${modelId}" not found` })
    }

    mediaGen.enabledModels = nextModels
    currentSettings.mediaGeneration = mediaGen

    await this.prismaClient.team.update({
      where: { id: teamId },
      data: { settings: currentSettings },
    })
  }

  async getValidModels(teamId: string): Promise<{
    imageModels: EnabledMediaModel[]
    videoModels: EnabledMediaModel[]
    providerKeys: Record<string, { apiKey?: string }>
  }> {
    const team = await this.prismaClient.team.findUnique({
      where: { id: teamId },
      select: { settings: true },
    })
    const providerKeys = team?.settings?.mediaGeneration?.providers || {}
    const { providers, enabledModels } = await this.getSettings(teamId)
    const activeProviderMap = new Map<string, boolean>()
    for (const p of providers) {
      activeProviderMap.set(p.provider, p.apiKeyConfigured)
    }

    const imageModels: EnabledMediaModel[] = []
    const videoModels: EnabledMediaModel[] = []

    for (const model of enabledModels) {
      if (activeProviderMap.get(model.provider)) {
        if (model.type === 'image') {
          imageModels.push(model)
        } else if (model.type === 'video') {
          videoModels.push(model)
        }
      }
    }

    return { imageModels, videoModels, providerKeys }
  }

  getImageModel(provider: string, modelId: string, apiKey: string) {
    switch (provider) {
      case 'openai':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createOpenAI({ apiKey }).image(modelId as any)
      case 'google':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createGoogleGenerativeAI({ apiKey }).image(modelId as any)
      case 'google-vertex':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createGoogleVertex({ apiKey }).image(modelId as any)
      case 'xai':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createXai({ apiKey }).image(modelId as any)
      case 'fal':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createFal({ apiKey }).image(modelId as any)
      case 'replicate':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createReplicate({ apiToken: apiKey }).image(modelId as any)
      case 'black-forest-labs':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createBlackForestLabs({ apiKey }).image(modelId as any)
      case 'togetherai':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createTogetherAI({ apiKey }).image(modelId as any)
      case 'fireworks':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createFireworks({ apiKey }).image(modelId as any)
      case 'deepinfra':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createDeepInfra({ apiKey }).image(modelId as any)
      case 'luma':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createLuma({ apiKey }).image(modelId as any)
      case 'amazon-bedrock':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createAmazonBedrock({ apiKey }).image(modelId as any)
      default:
        throw new Error(`Unsupported image provider: "${provider}"`)
    }
  }

  getVideoModel(provider: string, modelId: string, apiKey: string) {
    switch (provider) {
      case 'google':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createGoogleGenerativeAI({ apiKey }).video(modelId as any)
      case 'google-vertex':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createGoogleVertex({ apiKey }).video(modelId as any)
      case 'xai':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createXai({ apiKey }).video(modelId as any)
      case 'fal':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createFal({ apiKey }).video(modelId as any)
      case 'replicate':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createReplicate({ apiToken: apiKey }).video(modelId as any)
      case 'black-forest-labs':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createBlackForestLabs({ apiKey }).video(modelId as any)
      case 'klingai':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return createKlingAI({ apiKey }).video(modelId as any)
      default:
        throw new Error(`Unsupported video provider: "${provider}"`)
    }
  }

  async generateImage(params: GenerateImageServiceParams): Promise<{
    buffer: Buffer
    mimeType: string
    warnings?: unknown
  }> {
    const model = this.getImageModel(params.provider, params.modelId, params.apiKey)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let promptPayload: any = params.prompt
    if ((params.images && params.images.length > 0) || params.mask) {
      promptPayload = {
        text: params.prompt,
        images: params.images || [],
        mask: params.mask,
      }
    }

    const { image, warnings } = await aiGenerateImage({
      model,
      prompt: promptPayload,
      aspectRatio: params.aspectRatio,
      size: params.size,
      seed: params.seed,
    })

    let buffer: Buffer
    if (image.uint8Array) {
      buffer = Buffer.from(image.uint8Array)
    } else if (image.base64) {
      buffer = Buffer.from(image.base64, 'base64')
    } else {
      throw new Error('No image binary data returned by provider')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mimeType = (image as any).mediaType || (image as any).mimeType || 'image/png'

    return {
      buffer,
      mimeType,
      warnings,
    }
  }

  async generateVideo(params: GenerateVideoServiceParams): Promise<{
    buffer: Buffer
    mimeType: string
    warnings?: unknown
  }> {
    const model = this.getVideoModel(params.provider, params.modelId, params.apiKey)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let promptPayload: any = params.prompt || ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let frameImages: any = undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inputReferences: any = undefined

    if (params.mode === 'image_to_video' && params.image) {
      promptPayload = {
        text: params.prompt || '',
        image: params.image,
      }
    } else if (params.mode === 'first_last_frame') {
      const frames = []
      if (params.firstFrame) {
        frames.push({ image: params.firstFrame, frameType: 'first_frame' as const })
      }
      if (params.lastFrame) {
        frames.push({ image: params.lastFrame, frameType: 'last_frame' as const })
      }
      if (frames.length > 0) {
        frameImages = frames
      }
    } else if (
      params.mode === 'reference_to_video' &&
      params.inputReferences &&
      params.inputReferences.length > 0
    ) {
      inputReferences = params.inputReferences
    }

    const { video, warnings } = await aiGenerateVideo({
      model,
      prompt: promptPayload,
      frameImages,
      inputReferences,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      duration: params.duration,
      fps: params.fps,
      generateAudio: params.generateAudio,
      seed: params.seed,
    })

    let buffer: Buffer
    if (video.uint8Array) {
      buffer = Buffer.from(video.uint8Array)
    } else if (video.base64) {
      buffer = Buffer.from(video.base64, 'base64')
    } else {
      throw new Error('No video binary data returned by provider')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mimeType = (video as any).mediaType || (video as any).mimeType || 'video/mp4'

    return {
      buffer,
      mimeType,
      warnings,
    }
  }
}

export const mediaGenerationService = new MediaGenerationService()
