import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { mediaGenerationService, BUILTIN_MEDIA_PROVIDERS } from './media-generation'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as aiModule from 'ai'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: vi.fn(),
  }
})

describe('MediaGenerationService', () => {
  setupTestDbHooks()

  let teamId: string
  const originalEnv = process.env

  beforeEach(async () => {
    vi.clearAllMocks()
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
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should list all 18 providers in getSettings', async () => {
    const settings = await mediaGenerationService.getSettings(teamId)
    expect(settings.providers).toHaveLength(18)
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

  it('should include gemini-omni-1.1-flash as the default video model in Google curated models', () => {
    const googleVideoModels = mediaGenerationService.getCuratedModels('google', 'video')
    expect(googleVideoModels.length).toBeGreaterThan(0)
    expect(googleVideoModels[0].modelId).toBe('gemini-omni-1.1-flash')
    expect(googleVideoModels[0].name).toBe('Gemini Omni 1.1 Flash')
    expect(googleVideoModels[0].type).toBe('video')
  })

  it('should generate video via interactions API for gemini-omni-1.1-flash in text_to_video mode', async () => {
    const mockGenerateText = vi.mocked(aiModule.generateText).mockResolvedValue({
      files: [
        {
          mediaType: 'video/mp4',
          uint8Array: new Uint8Array([10, 20, 30, 40]),
          base64: Buffer.from([10, 20, 30, 40]).toString('base64'),
        },
      ],
      warnings: [],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>)

    const result = await mediaGenerationService.generateVideo({
      provider: 'google',
      modelId: 'gemini-omni-1.1-flash',
      apiKey: 'test-gemini-key',
      mode: 'text_to_video',
      prompt: 'A cinematic drone shot over rolling hills',
      aspectRatio: '16:9',
      resolution: '1280x720',
      duration: 5,
      fps: 24,
      generateAudio: true,
      seed: 42,
    })

    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = mockGenerateText.mock.calls[0][0]
    expect(callArgs.seed).toBe(42)
    expect(callArgs.system).toContain('Aspect ratio: 16:9')
    expect(callArgs.system).toContain('Resolution: 720p (1280x720)')
    expect(callArgs.system).toContain('Duration: 5 seconds')
    expect(callArgs.system).toContain('Frame rate: 24 fps')
    expect(callArgs.system).toContain('Audio: generate synchronized audio')
    const messages = callArgs.messages as Array<{
      role: string
      content: Array<{ type: string; text?: string }>
    }>
    expect(messages[0].content[0].text).toContain(
      '[Video parameters: Aspect ratio: 16:9, Resolution: 720p (1280x720), Duration: 5 seconds, Frame rate: 24 fps, Audio: generate synchronized audio]',
    )
    expect(callArgs.providerOptions).toEqual({
      google: {
        responseModalities: ['video'],
        store: false,
      },
    })
    expect(result.mimeType).toBe('video/mp4')
    expect(result.buffer).toEqual(Buffer.from([10, 20, 30, 40]))
  })

  it('should generate video via interactions API for gemini-omni-1.1-flash in image_to_video mode', async () => {
    const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const mockGenerateText = vi.mocked(aiModule.generateText).mockResolvedValue({
      files: [
        {
          mediaType: 'video/mp4',
          uint8Array: new Uint8Array([50, 60, 70, 80]),
          base64: Buffer.from([50, 60, 70, 80]).toString('base64'),
        },
      ],
      warnings: [],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>)

    const result = await mediaGenerationService.generateVideo({
      provider: 'google',
      modelId: 'gemini-omni-1.1-flash',
      apiKey: 'test-gemini-key',
      mode: 'image_to_video',
      prompt: 'Make the character wave',
      image: fakeImageBuffer,
    })

    expect(mockGenerateText).toHaveBeenCalledTimes(1)
    const callArgs = mockGenerateText.mock.calls[0][0]
    const messages = callArgs.messages as Array<{
      role: string
      content: Array<{ type: string; mediaType?: string; data?: Buffer }>
    }>
    expect(messages).toBeDefined()
    expect(messages[0].content).toHaveLength(2)
    expect(messages[0].content[0].type).toBe('text')
    expect(messages[0].content[1].type).toBe('file')
    expect(messages[0].content[1].mediaType).toBe('image/png')
    expect(messages[0].content[1].data).toEqual(fakeImageBuffer)
    expect(result.buffer).toEqual(Buffer.from([50, 60, 70, 80]))
  })

  it('should throw an error if interactions API returns no video file', async () => {
    vi.mocked(aiModule.generateText).mockResolvedValue({
      files: [],
      warnings: [],
    } as unknown as Awaited<ReturnType<typeof aiModule.generateText>>)

    await expect(
      mediaGenerationService.generateVideo({
        provider: 'google',
        modelId: 'gemini-omni-1.1-flash',
        apiKey: 'test-gemini-key',
        mode: 'text_to_video',
        prompt: 'A video that fails to generate',
      }),
    ).rejects.toThrow('No video binary data returned by Gemini Omni Flash')
  })
})
