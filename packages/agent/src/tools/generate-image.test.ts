import { vi } from 'vitest'

vi.mock('fs')

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createGenerateImageTool, resolveMediaData } from './generate-image'
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
      name: 'DALL-E 3',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'em-2',
      type: 'image',
      provider: 'google',
      modelId: 'imagen-3.0-generate-002',
      name: 'Imagen 3',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]

  const providerKeys = {
    openai: { apiKey: 'mock-openai-key' },
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

  it('creates tool with correct metadata and schema', () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys)
    expect(tool.name).toBe('generate_image')
    expect(tool.label).toBe('Generate Image')
    expect(tool.description).toContain('Generate an image')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tool.parameters as any).properties.model.description).toContain('dall-e-3')
  })

  it('generates an image successfully and writes to .pi directory', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys)

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
        model: 'dall-e-3',
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

  it('defaults to first enabled model when model is null', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys)

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

  it('resolves reference images when provided', async () => {
    const tool = createGenerateImageTool(enabledModels, providerKeys)

    const generateSpy = vi.spyOn(mediaGenerationService, 'generateImage').mockResolvedValue({
      buffer: Buffer.from('out'),
      mimeType: 'image/jpeg',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => p.toString().includes('test_ref.png'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('reference-data') as any)

    await tool.execute(
      'call-3',
      {
        prompt: 'Transform into watercolor',
        model: 'dall-e-3',
        aspectRatio: null,
        size: null,
        seed: null,
        images: ['test_ref.png'],
        mask: null,
        outputFileName: 'test_watercolor.jpg',
      },
      new AbortController().signal,
    )

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [expect.any(Buffer)],
      }),
    )
  })

  it('fails gracefully when API key is missing', async () => {
    const tool = createGenerateImageTool(enabledModels, {}) // No keys configured

    await expect(
      tool.execute(
        'call-4',
        {
          prompt: 'A sunset',
          model: 'dall-e-3',
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
    const tool = createGenerateImageTool(enabledModels, providerKeys)

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

describe('resolveMediaData', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns URL or data URI directly', async () => {
    expect(await resolveMediaData('https://example.com/image.png')).toBe(
      'https://example.com/image.png',
    )
    expect(await resolveMediaData('http://example.com/image.jpg')).toBe(
      'http://example.com/image.jpg',
    )
    expect(await resolveMediaData('data:image/png;base64,1234')).toBe('data:image/png;base64,1234')
  })

  it('reads from direct local path', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) =>
      p.toString().includes('test_local_resolve.txt'),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('hello local') as any)

    const data = await resolveMediaData('.pi/test_local_resolve.txt')
    expect(Buffer.isBuffer(data)).toBe(true)
    expect(data.toString()).toBe('hello local')
  })

  it('throws for unresolvable input', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    await expect(resolveMediaData('nonexistent-path-123456.png')).rejects.toThrow(
      'Could not resolve media input',
    )
  })
})
