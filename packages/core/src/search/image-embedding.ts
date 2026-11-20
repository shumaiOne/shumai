import { createHash } from 'node:crypto'
import { GoogleGenAI } from '@google/genai'
import { LruTtlCache } from '@shumai/core/src/cache/lru-ttl-cache'
import { logger } from '@shumai/core/src/logger'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { getGemmaEmbeddingEndpoint } from './gemma-embedding-endpoint'

export function getImageEmbeddingDimensions(): 768 | 1536 {
  return process.env.EMBEDDING_PROVIDER === 'gemma-embedding-2-openai' ? 768 : 1536
}

export class ImageEmbeddingService {
  private readonly cache = new LruTtlCache<string, number[]>(100)

  async generateEmbedding(image: string, teamId: string): Promise<number[]> {
    const dimensions = getImageEmbeddingDimensions()
    const digest = createHash('sha256').update(image).digest('hex')
    const cacheKey = `${teamId}:${dimensions}:${digest}`
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const buffer = Buffer.from(image, 'base64')
    const metadata = await sharp(buffer, { limitInputPixels: 1280 * 720 })
      .metadata()
      .catch(() => null)
    if (
      metadata?.format !== 'jpeg' ||
      Math.max(metadata.width, metadata.height) > 1280 ||
      Math.min(metadata.width, metadata.height) > 720
    ) {
      throw new HTTPException(400, { message: 'Provide a JPEG image resized to 720p.' })
    }

    let embedding: number[] | undefined
    try {
      const signal = AbortSignal.timeout(15000)
      embedding =
        dimensions === 768
          ? await this.embedWithGemma(image, signal)
          : await this.embedWithGemini(image, signal)
      if (
        !embedding ||
        embedding.length !== dimensions ||
        !embedding.every(Number.isFinite) ||
        !embedding.some((value) => value !== 0)
      ) {
        throw new Error('Invalid image embedding returned by provider')
      }
    } catch (err) {
      logger.warn(
        { teamId, dimensions, errorName: err instanceof Error ? err.name : undefined },
        'Failed to generate image search embedding',
      )
      throw new HTTPException(502, { message: 'Failed to generate image search embedding.' })
    }

    this.cache.set(cacheKey, embedding, 10 * 60 * 1000)
    return embedding
  }

  private async embedWithGemini(image: string, signal: AbortSignal) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not configured')

    const ai = new GoogleGenAI({ apiKey: process.env[apiKey] || apiKey })
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: [{ inlineData: { data: image, mimeType: 'image/jpeg' } }],
      config: { outputDimensionality: 1536, abortSignal: signal },
    })

    return response.embeddings?.[0]?.values
  }

  private async embedWithGemma(image: string, signal: AbortSignal) {
    const response = await fetch(getGemmaEmbeddingEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      signal,
    })
    if (!response.ok) throw new Error(`Embedding server returned status ${response.status}`)

    const result = (await response.json()) as { data?: { embedding?: number[] }[] }
    return result.data?.[0]?.embedding
  }
}

export const imageEmbeddingService = new ImageEmbeddingService()
