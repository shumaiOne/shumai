import { vi } from 'vitest'

vi.mock('fs')

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createGenerateVideoTool } from './generate-video'
import * as downloadAsset from './download-asset'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { EnabledMediaModel } from '@shumai/dtos'
import * as fs from 'fs'
import * as path from 'path'

describe('generate_video tool', () => {
  const enabledModels: EnabledMediaModel[] = [
    {
      id: 'vm-1',
      type: 'video',
      provider: 'klingai',
      modelId: 'kling-v1-standard',
      name: 'Kling v1 Standard',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'vm-2',
      type: 'video',
      provider: 'fal',
      modelId: 'kling-v1-standard',
      name: 'Kling v1 Standard (fal)',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'vm-3',
      type: 'video',
      provider: 'google',
      modelId: 'veo-2.0-generate-001',
      name: 'Veo 2',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]

  const providerKeys = {
    klingai: { apiKey: 'mock-kling-key' },
    fal: { apiKey: 'mock-fal-key' },
    google: { apiKey: 'mock-google-key' },
  }

  const piDir = path.join(process.cwd(), '.pi')

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates tool with correct metadata and provider-prefixed model schema', () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys, 'user-1')
    expect(tool.name).toBe('generate_video')
    expect(tool.label).toBe('Generate Video')
    expect(tool.description).toContain('Generate a video')
    const modelDesc = (tool.parameters as { properties: { model: { description: string } } })
      .properties.model.description
    expect(modelDesc).toContain('klingai:kling-v1-standard')
    expect(modelDesc).toContain('fal:kling-v1-standard')
  })

  it('generates text_to_video successfully', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys, 'user-1')

    const mockBuffer = Buffer.from('fake-mp4-video-stream')
    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: mockBuffer,
      mimeType: 'video/mp4',
    })
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

    const result = await tool.execute(
      'call-vid-1',
      {
        mode: 'text_to_video',
        model: 'klingai:kling-v1-standard',
        outputFileName: 'test_nature.mp4',
        textToVideoConfig: {
          prompt: 'A gentle waterfall in a lush forest with cinematic lighting',
        },
        imageToVideoConfig: null,
        firstLastFrameConfig: null,
        referenceToVideoConfig: null,
        aspectRatio: '16:9',
        resolution: null,
        duration: 5,
        fps: 24,
        generateAudio: null,
        seed: 123,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'klingai',
        modelId: 'kling-v1-standard',
        apiKey: 'mock-kling-key',
        mode: 'text_to_video',
        prompt: 'A gentle waterfall in a lush forest with cinematic lighting',
        aspectRatio: '16:9',
        duration: 5,
        fps: 24,
        seed: 123,
      }),
    )

    const expectedPath = path.join(piDir, 'test_nature.mp4')
    expect(writeSpy).toHaveBeenCalledWith(expectedPath, mockBuffer)

    const textContent = result.content[0]
    expect(textContent.type).toBe('text')
    if (textContent.type === 'text') {
      expect(textContent.text).toContain('Successfully generated video')
      expect(textContent.text).toContain('.pi/test_nature.mp4')
    }
    expect(result.details).toMatchObject({
      fileName: 'test_nature.mp4',
      provider: 'klingai',
      model: 'kling-v1-standard',
      mode: 'text_to_video',
    })
  })

  it('disambiguates identical model IDs across different providers', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys, 'user-1')

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: Buffer.from('video-bytes'),
      mimeType: 'video/mp4',
    })

    // Select fal:kling-v1-standard
    await tool.execute(
      'call-fal',
      {
        mode: 'text_to_video',
        model: 'fal:kling-v1-standard',
        outputFileName: null,
        textToVideoConfig: { prompt: 'A soaring eagle' },
        imageToVideoConfig: null,
        firstLastFrameConfig: null,
        referenceToVideoConfig: null,
        aspectRatio: null,
        resolution: null,
        duration: null,
        fps: null,
        generateAudio: null,
        seed: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: 'fal',
        modelId: 'kling-v1-standard',
        apiKey: 'mock-fal-key',
      }),
    )

    // Select klingai:kling-v1-standard
    await tool.execute(
      'call-klingai',
      {
        mode: 'text_to_video',
        model: 'klingai:kling-v1-standard',
        outputFileName: null,
        textToVideoConfig: { prompt: 'A roaring tiger' },
        imageToVideoConfig: null,
        firstLastFrameConfig: null,
        referenceToVideoConfig: null,
        aspectRatio: null,
        resolution: null,
        duration: null,
        fps: null,
        generateAudio: null,
        seed: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: 'klingai',
        modelId: 'kling-v1-standard',
        apiKey: 'mock-kling-key',
      }),
    )
  })

  it('generates image_to_video using resolveS3MediaBuffer', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys, 'user-1')

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: Buffer.from('video-bytes'),
      mimeType: 'video/mp4',
    })

    const resolverSpy = vi.spyOn(downloadAsset, 'resolveS3MediaBuffer').mockResolvedValue({
      buffer: Buffer.from('resolved-image-data'),
      mimeType: 'image/png',
    })

    await tool.execute(
      'call-vid-2',
      {
        mode: 'image_to_video',
        model: 'klingai:kling-v1-standard',
        outputFileName: 'animate_cat.mp4',
        textToVideoConfig: null,
        imageToVideoConfig: {
          image: 'files/ast-1/img.png',
          prompt: 'Cat starts blinking and looks to the side',
        },
        firstLastFrameConfig: null,
        referenceToVideoConfig: null,
        aspectRatio: null,
        resolution: null,
        duration: null,
        fps: null,
        generateAudio: null,
        seed: null,
      },
      new AbortController().signal,
    )

    expect(resolverSpy).toHaveBeenCalledWith('files/ast-1/img.png', 'user-1')
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'image_to_video',
        image: Buffer.from('resolved-image-data'),
        prompt: 'Cat starts blinking and looks to the side',
      }),
    )
  })

  it('generates first_last_frame using resolveS3MediaBuffer', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys, 'user-1')

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: Buffer.from('transition-video'),
      mimeType: 'video/mp4',
    })

    vi.spyOn(downloadAsset, 'resolveS3MediaBuffer').mockImplementation(async (key: string) => ({
      buffer: Buffer.from(`frame-data-${key}`),
      mimeType: 'image/png',
    }))

    await tool.execute(
      'call-vid-3',
      {
        mode: 'first_last_frame',
        model: 'klingai:kling-v1-standard',
        outputFileName: 'transition.mp4',
        textToVideoConfig: null,
        imageToVideoConfig: null,
        firstLastFrameConfig: {
          firstFrame: 'files/ast-1/start.png',
          lastFrame: 'files/ast-2/end.png',
          prompt: 'Smooth morph from sunrise to night',
        },
        referenceToVideoConfig: null,
        aspectRatio: null,
        resolution: null,
        duration: null,
        fps: null,
        generateAudio: null,
        seed: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'first_last_frame',
        firstFrame: Buffer.from('frame-data-files/ast-1/start.png'),
        lastFrame: Buffer.from('frame-data-files/ast-2/end.png'),
        prompt: 'Smooth morph from sunrise to night',
      }),
    )
  })

  it('generates reference_to_video using resolveS3MediaBuffer', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys, 'user-1')

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: Buffer.from('ref-video'),
      mimeType: 'video/mp4',
    })

    vi.spyOn(downloadAsset, 'resolveS3MediaBuffer').mockImplementation(async (key: string) => ({
      buffer: Buffer.from(`ref-data-${key}`),
      mimeType: 'image/png',
    }))

    await tool.execute(
      'call-vid-4',
      {
        mode: 'reference_to_video',
        model: 'klingai:kling-v1-standard',
        outputFileName: 'reference_output.mp4',
        textToVideoConfig: null,
        imageToVideoConfig: null,
        firstLastFrameConfig: null,
        referenceToVideoConfig: {
          references: ['files/ast-1/ref1.png', 'files/ast-2/ref2.png'],
          prompt: 'Generate an anime dance following these characters',
        },
        aspectRatio: null,
        resolution: null,
        duration: null,
        fps: null,
        generateAudio: null,
        seed: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'reference_to_video',
        inputReferences: [
          Buffer.from('ref-data-files/ast-1/ref1.png'),
          Buffer.from('ref-data-files/ast-2/ref2.png'),
        ],
        prompt: 'Generate an anime dance following these characters',
      }),
    )
  })

  it('fails gracefully when API key is missing', async () => {
    const tool = createGenerateVideoTool(enabledModels, {}, 'user-1')

    await expect(
      tool.execute(
        'call-vid-5',
        {
          mode: 'text_to_video',
          model: 'klingai:kling-v1-standard',
          outputFileName: null,
          textToVideoConfig: { prompt: 'A simple video' },
          imageToVideoConfig: null,
          firstLastFrameConfig: null,
          referenceToVideoConfig: null,
          aspectRatio: null,
          resolution: null,
          duration: null,
          fps: null,
          generateAudio: null,
          seed: null,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('API key for provider "klingai" is not configured')
  })
})
