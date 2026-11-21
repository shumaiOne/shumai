import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageEmbeddingService } from './image-embedding'

const embedContent = vi.fn()
vi.mock('@google/genai', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  GoogleGenAI: class {
    models = { embedContent }
  },
}))

async function jpeg(width = 32, height = 24) {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  })
    .jpeg()
    .toBuffer()
  return buffer.toString('base64')
}

describe('ImageEmbeddingService', () => {
  let service: ImageEmbeddingService

  beforeEach(() => {
    vi.stubEnv('EMBEDDING_PROVIDER', undefined)
    vi.stubEnv('GEMINI_API_KEY', 'fake-key')
    embedContent.mockReset()
    service = new ImageEmbeddingService()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('embeds JPEG images with Gemini and caches the result by team and image', async () => {
    const image = await jpeg()
    const embedding = Array<number>(1536).fill(0.02)
    embedContent.mockResolvedValue({ embeddings: [{ values: embedding }] })

    expect(await service.generateEmbedding(image, 'team-a')).toEqual(embedding)
    expect(await service.generateEmbedding(image, 'team-a')).toEqual(embedding)
    expect(embedContent).toHaveBeenCalledTimes(1)
    expect(embedContent).toHaveBeenCalledWith({
      model: 'gemini-embedding-2',
      contents: [{ inlineData: { data: image, mimeType: 'image/jpeg' } }],
      config: { outputDimensionality: 1536, abortSignal: expect.any(AbortSignal) },
    })

    await service.generateEmbedding(image, 'team-b')
    await service.generateEmbedding(await jpeg(18), 'team-a')
    expect(embedContent).toHaveBeenCalledTimes(3)
  })

  it('uses the configured local Gemma endpoint and accepts portrait images', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'gemma-embedding-2-openai')
    vi.stubEnv('GEMMA_EMBEDDING_OPENAI_BASE_URL', 'http://embedding.test/custom/embeddings/')
    const image = await jpeg(720, 1280)
    const embedding = Array<number>(768).fill(0.02)
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [{ embedding }] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await service.generateEmbedding(image, 'team-a')).toEqual(embedding)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://embedding.test/custom/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'embeddinggemma-2',
          input: [
            {
              type: 'image_url',
              // eslint-disable-next-line @typescript-eslint/naming-convention -- OpenAI request field
              image_url: { url: `data:image/jpeg;base64,${image}` },
            },
          ],
        }),
      }),
    )
    expect(embedContent).not.toHaveBeenCalled()
  })

  it('rejects invalid, non-JPEG, and oversized images before contacting the provider', async () => {
    const png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    for (const image of ['aW1hZ2U=', png.toString('base64'), await jpeg(1281, 200)]) {
      await expect(service.generateEmbedding(image, 'team-a')).rejects.toMatchObject({
        status: 400,
      })
    }
    expect(embedContent).not.toHaveBeenCalled()
  })

  it('reports provider errors and allows the image to be retried', async () => {
    const image = await jpeg()
    const embedding = Array<number>(1536).fill(0.02)
    embedContent
      .mockRejectedValueOnce(new Error('Provider failed'))
      .mockResolvedValueOnce({ embeddings: [{ values: [1, 2, 3] }] })
      .mockResolvedValueOnce({ embeddings: [{ values: embedding }] })

    await expect(service.generateEmbedding(image, 'team-a')).rejects.toMatchObject({ status: 502 })
    await expect(service.generateEmbedding(image, 'team-a')).rejects.toMatchObject({ status: 502 })
    expect(await service.generateEmbedding(image, 'team-a')).toEqual(embedding)
    expect(embedContent).toHaveBeenCalledTimes(3)
  })
})
