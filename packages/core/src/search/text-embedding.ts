import { GoogleGenAI } from '@google/genai'
import { LruTtlCache } from '@shumai/core/src/cache/lru-ttl-cache'
import { logger } from '@shumai/core/src/logger'

export interface TextEmbeddingUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

export interface TextEmbeddingResult {
  embedding: number[]
  usage?: TextEmbeddingUsage
  cached?: boolean
}

export interface GenerateTextEmbeddingOptions {
  provider?: string
  model?: string
  signal?: AbortSignal
  teamId?: string
  skipCache?: boolean
}

export class TextEmbeddingService {
  private cache: LruTtlCache<string, number[]>

  constructor(
    cacheCapacity: number = 500,
    private defaultTtlMs: number = 3600 * 1000,
  ) {
    this.cache = new LruTtlCache<string, number[]>(cacheCapacity, 50)
  }

  /**
   * Generates a text embedding vector directly using the configured provider.
   * If a cached embedding exists for the text, provider, and model, it is returned immediately.
   */
  async generateEmbedding(
    text: string,
    options?: GenerateTextEmbeddingOptions,
  ): Promise<TextEmbeddingResult> {
    const trimmedText = text.trim()
    if (!trimmedText) {
      throw new Error('Text to embed must not be empty')
    }

    const provider = options?.provider || process.env.EMBEDDING_PROVIDER || 'gemini-embedding-2'
    const model =
      options?.model ||
      (provider === 'gemma-embedding-2-openai' ? 'embeddinggemma-2' : 'gemini-embedding-2')

    const cacheKey = `${provider}:${model}:${trimmedText.toLowerCase()}`
    if (!options?.skipCache) {
      const cachedVector = this.cache.get(cacheKey)
      if (cachedVector) {
        logger.debug({ provider, model, key: cacheKey }, 'Cache hit for text embedding')
        return {
          embedding: cachedVector,
          usage: { model, inputTokens: 0, outputTokens: 0 },
          cached: true,
        }
      }
    }

    const signal = options?.signal ?? AbortSignal.timeout(5000)

    let result: TextEmbeddingResult
    if (provider === 'gemma-embedding-2-openai') {
      result = await this.callGemmaEmbeddingServer(trimmedText, model, signal)
    } else {
      result = await this.callGeminiEmbedding(trimmedText, model, signal)
    }

    if (!options?.skipCache) {
      this.cache.set(cacheKey, result.embedding, this.defaultTtlMs)
    }
    return result
  }

  private async callGeminiEmbedding(
    text: string,
    model: string,
    signal: AbortSignal,
  ): Promise<TextEmbeddingResult> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured')
    }

    if (signal.aborted) {
      throw signal.reason ?? new Error('Embedding generation aborted or timed out')
    }

    const resolvedApiKey = process.env[apiKey] || apiKey
    const ai = new GoogleGenAI({ apiKey: resolvedApiKey })

    const embedPromise = ai.models.embedContent({
      model,
      contents: [
        {
          parts: [{ text }],
          role: 'user',
        },
      ],
      config: {
        outputDimensionality: 1536,
      },
    })

    const abortPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(signal.reason ?? new Error('Embedding generation aborted or timed out'))
        return
      }
      signal.addEventListener(
        'abort',
        () => {
          reject(signal.reason ?? new Error('Embedding generation aborted or timed out'))
        },
        { once: true },
      )
    })

    const response = await Promise.race([embedPromise, abortPromise])
    const values = response.embeddings?.[0]?.values
    if (!values || !Array.isArray(values)) {
      throw new Error(`No embedding values returned from ${model}`)
    }

    return {
      embedding: values,
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
      },
    }
  }

  private async callGemmaEmbeddingServer(
    text: string,
    model: string,
    signal: AbortSignal,
  ): Promise<TextEmbeddingResult> {
    const rawBaseUrl = process.env.GEMMA_EMBEDDING_OPENAI_BASE_URL || 'http://localhost:9379/v1'
    const normalized = rawBaseUrl.replace(/\/+$/, '')
    const endpoint = normalized.endsWith('/embeddings')
      ? normalized
      : normalized.endsWith('/v1')
        ? `${normalized}/embeddings`
        : `${normalized}/v1/embeddings`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: `task: search query | text: ${text}`,
      }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Embedding server returned status ${response.status}: ${errorText}`)
    }

    const json = (await response.json()) as {
      model?: string
      data?: Array<{ embedding?: number[] }>
      // eslint-disable-next-line @typescript-eslint/naming-convention
      usage?: { prompt_tokens?: number }
    }

    const embedding = json.data?.[0]?.embedding
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding returned from embedding server')
    }

    return {
      embedding,
      usage: {
        model: json.model || model,
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: 0,
      },
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const textEmbeddingService = new TextEmbeddingService()
