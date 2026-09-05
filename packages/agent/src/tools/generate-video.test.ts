import { vi } from 'vitest'

vi.mock('fs')

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createGenerateVideoTool } from './generate-video'
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
      provider: 'google',
      modelId: 'veo-2.0-generate-001',
      name: 'Veo 2',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]

  const providerKeys = {
    klingai: { apiKey: 'mock-kling-key' },
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
    const tool = createGenerateVideoTool(enabledModels, providerKeys)
    expect(tool.name).toBe('generate_video')
    expect(tool.label).toBe('Generate Video')
    expect(tool.description).toContain('Generate a video')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tool.parameters as any).properties.model.description).toContain('kling-v1-standard')
  })

  it('generates text_to_video successfully', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys)

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
        model: 'kling-v1-standard',
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

  it('generates image_to_video successfully with resolved image input', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys)

    const mockBuffer = Buffer.from('fake-mp4-video-bytes')
    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: mockBuffer,
      mimeType: 'video/mp4',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) =>
      p.toString().includes('test_start.png'),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('start-frame-bytes') as any)

    await tool.execute(
      'call-vid-2',
      {
        mode: 'image_to_video',
        model: 'kling-v1-standard',
        outputFileName: null,
        textToVideoConfig: null,
        imageToVideoConfig: {
          image: 'test_start.png',
          prompt: 'Camera zooms in slowly',
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

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'klingai',
        modelId: 'kling-v1-standard',
        mode: 'image_to_video',
        image: expect.any(Buffer),
        prompt: 'Camera zooms in slowly',
      }),
    )
  })

  it('generates first_last_frame successfully', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys)

    const mockBuffer = Buffer.from('fake-transition-video')
    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: mockBuffer,
      mimeType: 'video/mp4',
    })

    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
      if (String(p).includes('test_first.png')) return Buffer.from('first-bytes')
      if (String(p).includes('test_last.png')) return Buffer.from('last-bytes')
      return Buffer.from('')
    })

    await tool.execute(
      'call-vid-3',
      {
        mode: 'first_last_frame',
        model: 'kling-v1-standard',
        outputFileName: null,
        textToVideoConfig: null,
        imageToVideoConfig: null,
        firstLastFrameConfig: {
          firstFrame: 'test_first.png',
          lastFrame: 'test_last.png',
          prompt: 'Smooth transition between scenes',
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
        firstFrame: expect.any(Buffer),
        lastFrame: expect.any(Buffer),
        prompt: 'Smooth transition between scenes',
      }),
    )
  })

  it('generates reference_to_video successfully', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys)

    const mockBuffer = Buffer.from('fake-ref-video')
    const generateSpy = vi.spyOn(mediaGenerationService, 'generateVideo').mockResolvedValue({
      buffer: mockBuffer,
      mimeType: 'video/mp4',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) =>
      p.toString().includes('test_ref1.png'),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('ref1-bytes') as any)

    await tool.execute(
      'call-vid-4',
      {
        mode: 'reference_to_video',
        model: 'kling-v1-standard',
        outputFileName: null,
        textToVideoConfig: null,
        imageToVideoConfig: null,
        firstLastFrameConfig: null,
        referenceToVideoConfig: {
          references: ['test_ref1.png'],
          prompt: 'Character walking in park',
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
        inputReferences: [expect.any(Buffer)],
        prompt: 'Character walking in park',
      }),
    )
  })

  it('throws error when mode configuration is missing', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys)

    await expect(
      tool.execute(
        'call-vid-err',
        {
          mode: 'text_to_video',
          model: 'kling-v1-standard',
          outputFileName: null,
          textToVideoConfig: null, // missing!
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
    ).rejects.toThrow('textToVideoConfig')
  })

  it('throws error when model is not enabled', async () => {
    const tool = createGenerateVideoTool(enabledModels, providerKeys)

    await expect(
      tool.execute(
        'call-vid-err-model',
        {
          mode: 'text_to_video',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: 'unknown-video-model' as any,
          outputFileName: null,
          textToVideoConfig: { prompt: 'hi' },
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
    ).rejects.toThrow('Video model "unknown-video-model" is not enabled')
  })
})
