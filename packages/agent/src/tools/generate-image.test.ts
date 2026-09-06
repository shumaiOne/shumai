import { vi } from 'vitest'

vi.mock('fs')

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createGenerateImageTool } from './generate-image'
import * as downloadAsset from './download-asset'
import { mediaGenerationService } from '@shumai/core/src/media-generation/media-generation'
import { EnabledMediaModel } from '@shumai/dtos'
import * as fs from 'fs'
import * as path from 'path'

describe('generate_image tool', () => {
  const enabledModels: EnabledMediaModel[] = [
    {
      id: 'em-1',
      type: 'image',
      provider: 'openai',
      modelId: 'dall-e-3',
      name: 'DALL-E 3 (OpenAI)',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'em-2',
      type: 'image',
      provider: 'azure',
      modelId: 'dall-e-3',
      name: 'DALL-E 3 (Azure)',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'em-3',
      type: 'image',
      provider: 'google',
      modelId: 'imagen-3.0-generate-002',
      name: 'Imagen 3',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]

  const providerKeys = {
    openai: { apiKey: 'mock-openai-key' },
    azure: { apiKey: 'mock-azure-key' },
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
    const tool = createGenerateImageTool(enabledModels, providerKeys, 'user-1')
    expect(tool.name).toBe('generate_image')
    expect(tool.label).toBe('Generate Image')
    expect(tool.description).toContain('Generate an image')
    const modelDesc = (tool.parameters as { properties: { model: { description: string } } })
      .properties.model.description
    expect(modelDesc).toContain('openai:dall-e-3')
    expect(modelDesc).toContain('azure:dall-e-3')
  })

  it('generates an image successfully and writes to .pi directory', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys, 'user-1')

    const mockBuffer = Buffer.from('fake-image-png-content')
    const generateSpy = vi.spyOn(mediaGenerationService, 'generateImage').mockResolvedValue({
      buffer: mockBuffer,
      mimeType: 'image/png',
    })
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

    const result = await tool.execute(
      'call-1',
      {
        prompt: 'A futuristic city skyline at dusk',
        model: 'openai:dall-e-3',
        aspectRatio: '16:9',
        size: null,
        seed: 42,
        images: null,
        mask: null,
        outputFileName: 'test_city.png',
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        modelId: 'dall-e-3',
        apiKey: 'mock-openai-key',
        prompt: 'A futuristic city skyline at dusk',
        aspectRatio: '16:9',
        seed: 42,
      }),
    )

    const expectedPath = path.join(piDir, 'test_city.png')
    expect(writeSpy).toHaveBeenCalledWith(expectedPath, mockBuffer)

    const textContent = result.content[0]
    expect(textContent.type).toBe('text')
    if (textContent.type === 'text') {
      expect(textContent.text).toContain('Successfully generated image')
      expect(textContent.text).toContain('.pi/test_city.png')
    }
    expect(result.details).toMatchObject({
      fileName: 'test_city.png',
      provider: 'openai',
      model: 'dall-e-3',
    })
  })

  it('disambiguates identical model IDs across different providers', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys, 'user-1')

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateImage').mockResolvedValue({
      buffer: Buffer.from('image-bytes'),
      mimeType: 'image/png',
    })

    // Invoke azure:dall-e-3
    await tool.execute(
      'call-azure',
      {
        prompt: 'Azure generation',
        model: 'azure:dall-e-3',
        aspectRatio: null,
        size: null,
        seed: null,
        images: null,
        mask: null,
        outputFileName: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: 'azure',
        modelId: 'dall-e-3',
        apiKey: 'mock-azure-key',
      }),
    )

    // Invoke openai:dall-e-3
    await tool.execute(
      'call-openai',
      {
        prompt: 'OpenAI generation',
        model: 'openai:dall-e-3',
        aspectRatio: null,
        size: null,
        seed: null,
        images: null,
        mask: null,
        outputFileName: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: 'openai',
        modelId: 'dall-e-3',
        apiKey: 'mock-openai-key',
      }),
    )
  })

  it('defaults to first enabled model when model is null', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys, 'user-1')

    const mockBuffer = Buffer.from('fake-image-bytes')
    const generateSpy = vi.spyOn(mediaGenerationService, 'generateImage').mockResolvedValue({
      buffer: mockBuffer,
      mimeType: 'image/png',
    })

    await tool.execute(
      'call-2',
      {
        prompt: 'A cute cat',
        model: null,
        aspectRatio: null,
        size: null,
        seed: null,
        images: null,
        mask: null,
        outputFileName: null,
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        modelId: 'dall-e-3',
      }),
    )
  })

  it('resolves reference images and mask via resolveS3MediaBuffer', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys, 'user-1')

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateImage').mockResolvedValue({
      buffer: Buffer.from('out'),
      mimeType: 'image/jpeg',
    })

    const resolverSpy = vi
      .spyOn(downloadAsset, 'resolveS3MediaBuffer')
      .mockImplementation(async (key: string) => ({
        buffer: Buffer.from(`data-for-${key}`),
        mimeType: 'image/png',
      }))

    await tool.execute(
      'call-3',
      {
        prompt: 'Transform into watercolor',
        model: 'openai:dall-e-3',
        aspectRatio: null,
        size: null,
        seed: null,
        images: ['files/ast-1/ref1.png', 'files/ast-2/ref2.png'],
        mask: 'files/ast-mask/mask.png',
        outputFileName: 'test_watercolor.jpg',
      },
      new AbortController().signal,
    )

    expect(resolverSpy).toHaveBeenCalledWith('files/ast-1/ref1.png', 'user-1')
    expect(resolverSpy).toHaveBeenCalledWith('files/ast-2/ref2.png', 'user-1')
    expect(resolverSpy).toHaveBeenCalledWith('files/ast-mask/mask.png', 'user-1')
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          Buffer.from('data-for-files/ast-1/ref1.png'),
          Buffer.from('data-for-files/ast-2/ref2.png'),
        ],
        mask: Buffer.from('data-for-files/ast-mask/mask.png'),
      }),
    )
  })

  it('fails gracefully when API key is missing', async () => {
    const tool = createGenerateImageTool(enabledModels, {}, 'user-1') // No keys configured

    await expect(
      tool.execute(
        'call-4',
        {
          prompt: 'A sunset',
          model: 'openai:dall-e-3',
          aspectRatio: null,
          size: null,
          seed: null,
          images: null,
          mask: null,
          outputFileName: null,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('API key for provider "openai" is not configured')
  })

  it('fails gracefully when requested model is not enabled', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys, 'user-1')

    await expect(
      tool.execute(
        'call-5',
        {
          prompt: 'A sunset',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: 'non-existent-model' as any,
          aspectRatio: null,
          size: null,
          seed: null,
          images: null,
          mask: null,
          outputFileName: null,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Image model "non-existent-model" is not enabled')
  })
})
