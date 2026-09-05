import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { mediaGenerationService, BUILTIN_MEDIA_PROVIDERS } from './media-generation'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('MediaGenerationService', () => {
  setupTestDbHooks()

  let teamId: string
  const originalEnv = process.env

  beforeEach(async () => {
    process.env = { ...originalEnv }
    const team = await prisma.team.create({
      data: {
        name: 'Media Team',
        settings: {
          transcode: { videoStrategy: 'best_match' },
        },
      },
    })
    teamId = team.id
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('should list all 13 providers in getSettings', async () => {
    const settings = await mediaGenerationService.getSettings(teamId)
    expect(settings.providers).toHaveLength(13)
    expect(settings.enabledModels).toEqual([])

    const openai = settings.providers.find((p) => p.provider === 'openai')
    expect(openai).toBeDefined()
    expect(openai?.defaultEnvKey).toBe('OPENAI_API_KEY')
    expect(openai?.supportedTypes).toEqual(['image'])
  })

  it('should detect API key from environment variable', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-env-key'
    const settings = await mediaGenerationService.getSettings(teamId)
    const openai = settings.providers.find((p) => p.provider === 'openai')

    expect(openai?.apiKeyConfigured).toBe(true)
    expect(openai?.status).toBe('configured_env')
    expect(openai?.customApiKeyOrEnv).toBeUndefined()
  })

  it('should allow setting custom API key and custom env variable', async () => {
    // 1. Set literal API key
    await mediaGenerationService.updateProviderApiKey(teamId, 'openai', 'sk-literal-key')
    let settings = await mediaGenerationService.getSettings(teamId)
    let openai = settings.providers.find((p) => p.provider === 'openai')

    expect(openai?.apiKeyConfigured).toBe(true)
    expect(openai?.status).toBe('configured_custom')
    expect(openai?.customApiKeyOrEnv).toBe('sk-literal-key')

    // 2. Set custom ENV var name
    process.env.MY_CUSTOM_OPENAI_ENV = 'sk-resolved-custom-env'
    await mediaGenerationService.updateProviderApiKey(teamId, 'openai', 'MY_CUSTOM_OPENAI_ENV')
    settings = await mediaGenerationService.getSettings(teamId)
    openai = settings.providers.find((p) => p.provider === 'openai')

    expect(openai?.apiKeyConfigured).toBe(true)
    expect(openai?.status).toBe('configured_custom')
    expect(openai?.customApiKeyOrEnv).toBe('MY_CUSTOM_OPENAI_ENV')
    expect(mediaGenerationService.resolveApiKey('openai', 'MY_CUSTOM_OPENAI_ENV')).toBe(
      'sk-resolved-custom-env',
    )

    // 3. Clear custom key
    await mediaGenerationService.updateProviderApiKey(teamId, 'openai', '')
    delete process.env.OPENAI_API_KEY
    settings = await mediaGenerationService.getSettings(teamId)
    openai = settings.providers.find((p) => p.provider === 'openai')

    expect(openai?.apiKeyConfigured).toBe(false)
    expect(openai?.status).toBe('not_configured')
    expect(openai?.customApiKeyOrEnv).toBeUndefined()
  })

  it('should add enabled models and reject invalid configurations', async () => {
    // Valid model addition
    const added = await mediaGenerationService.addEnabledModel(teamId, {
      type: 'image',
      provider: 'openai',
      modelId: 'dall-e-3',
      name: 'DALL-E 3 High Quality',
    })

    expect(added.id).toBeDefined()
    expect(added.type).toBe('image')
    expect(added.provider).toBe('openai')
    expect(added.modelId).toBe('dall-e-3')
    expect(added.name).toBe('DALL-E 3 High Quality')

    const settings = await mediaGenerationService.getSettings(teamId)
    expect(settings.enabledModels).toHaveLength(1)
    expect(settings.enabledModels[0].id).toBe(added.id)

    // Rejects duplicate model addition
    await expect(
      mediaGenerationService.addEnabledModel(teamId, {
        type: 'image',
        provider: 'openai',
        modelId: 'dall-e-3',
      }),
    ).rejects.toThrow('already enabled')

    // Rejects unsupported type for provider (OpenAI does not support video)
    await expect(
      mediaGenerationService.addEnabledModel(teamId, {
        type: 'video',
        provider: 'openai',
        modelId: 'some-video-model',
      }),
    ).rejects.toThrow('does not support video')

    // Rejects unknown provider
    await expect(
      mediaGenerationService.addEnabledModel(teamId, {
        type: 'image',
        provider: 'unknown-provider',
        modelId: 'model-1',
      }),
    ).rejects.toThrow('Unknown media provider')
  })

  it('should remove enabled models', async () => {
    const model = await mediaGenerationService.addEnabledModel(teamId, {
      type: 'image',
      provider: 'fal',
      modelId: 'fal-ai/flux/dev',
    })

    let settings = await mediaGenerationService.getSettings(teamId)
    expect(settings.enabledModels).toHaveLength(1)

    await mediaGenerationService.removeEnabledModel(teamId, model.id)
    settings = await mediaGenerationService.getSettings(teamId)
    expect(settings.enabledModels).toHaveLength(0)

    // Throws if model does not exist
    await expect(mediaGenerationService.removeEnabledModel(teamId, 'non-existent')).rejects.toThrow(
      'not found',
    )
  })

  it('should return valid models only when provider has active API key', async () => {
    // Add an image model for OpenAI and a video model for Google
    await mediaGenerationService.addEnabledModel(teamId, {
      type: 'image',
      provider: 'openai',
      modelId: 'dall-e-3',
    })
    await mediaGenerationService.addEnabledModel(teamId, {
      type: 'video',
      provider: 'google',
      modelId: 'veo-2.0-generate-001',
    })

    // Neither key is configured yet
    delete process.env.OPENAI_API_KEY
    delete process.env.GEMINI_API_KEY
    let valid = await mediaGenerationService.getValidModels(teamId)
    expect(valid.imageModels).toHaveLength(0)
    expect(valid.videoModels).toHaveLength(0)

    // Configure OpenAI key
    process.env.OPENAI_API_KEY = 'sk-test'
    valid = await mediaGenerationService.getValidModels(teamId)
    expect(valid.imageModels).toHaveLength(1)
    expect(valid.imageModels[0].modelId).toBe('dall-e-3')
    expect(valid.videoModels).toHaveLength(0)

    // Configure Google key
    process.env.GEMINI_API_KEY = 'gemini-key'
    valid = await mediaGenerationService.getValidModels(teamId)
    expect(valid.imageModels).toHaveLength(1)
    expect(valid.videoModels).toHaveLength(1)
    expect(valid.videoModels[0].modelId).toBe('veo-2.0-generate-001')
  })

  it('should instantiate image and video models across all supported providers', () => {
    for (const [providerKey, def] of Object.entries(BUILTIN_MEDIA_PROVIDERS)) {
      if (def.supportedTypes.includes('image')) {
        const imageModel = def.curatedModels.find((m) => m.type === 'image')!
        const instance = mediaGenerationService.getImageModel(
          providerKey,
          imageModel.modelId,
          'mock-api-key',
        )
        expect(instance).toBeDefined()
        expect(instance.modelId).toBe(imageModel.modelId)
      }

      if (def.supportedTypes.includes('video')) {
        const videoModel = def.curatedModels.find((m) => m.type === 'video')!
        const instance = mediaGenerationService.getVideoModel(
          providerKey,
          videoModel.modelId,
          'mock-api-key',
        )
        expect(instance).toBeDefined()
        expect(instance.modelId).toBe(videoModel.modelId)
      }
    }
  })
})
