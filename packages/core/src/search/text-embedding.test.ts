import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TextEmbeddingService } from './text-embedding'
import { logger } from '@shumai/core/src/logger'

const mockEmbedContent = vi.fn()

vi.mock('@google/genai', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    GoogleGenAI: class {
      models = {
        embedContent: mockEmbedContent,
      }
    },
  }
})

describe('TextEmbeddingService', () => {
  const originalEnv = { ...process.env }
  let service: TextEmbeddingService

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    delete process.env.EMBEDDING_PROVIDER
    delete process.env.GEMMA_EMBEDDING_OPENAI_BASE_URL
    mockEmbedContent.mockReset()
    service = new TextEmbeddingService(500, 3600 * 1000)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('throws an error if text is empty or whitespace', async () => {
    await expect(service.generateEmbedding('')).rejects.toThrow('Text to embed must not be empty')
    await expect(service.generateEmbedding('   ')).rejects.toThrow(
      'Text to embed must not be empty',
    )
  })

  it('generates Gemini embedding (1536d) by default', async () => {
    const dummyEmbedding = Array(1536).fill(0.05)
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: dummyEmbedding }],
    })

    const result = await service.generateEmbedding('beautiful sunset')

    expect(result.embedding).toEqual(dummyEmbedding)
    expect(result.usage?.model).toBe('gemini-embedding-2')
    expect(result.cached).toBeUndefined()
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-embedding-2',
        contents: [
          expect.objectContaining({
            parts: [{ text: 'beautiful sunset' }],
          }),
        ],
        config: {
          outputDimensionality: 1536,
        },
      }),
    )
  })

  it('returns cached result on repeated call without re-invoking the provider', async () => {
    const dummyEmbedding = Array(1536).fill(0.05)
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: dummyEmbedding }],
    })

    const first = await service.generateEmbedding('ocean breeze')
    expect(first.embedding).toEqual(dummyEmbedding)
    expect(mockEmbedContent).toHaveBeenCalledTimes(1)

    // Second call with same text and extra whitespace
    const second = await service.generateEmbedding('  ocean breeze  ')
    expect(second.embedding).toEqual(dummyEmbedding)
    expect(second.cached).toBe(true)
    expect(mockEmbedContent).toHaveBeenCalledTimes(1)
  })

  it('preserves case distinctions in cache keys', async () => {
    const dummyApple = Array(1536).fill(0.1)
    const dummyLowerApple = Array(1536).fill(0.2)
    mockEmbedContent
      .mockResolvedValueOnce({
        embeddings: [{ values: dummyApple }],
      })
      .mockResolvedValueOnce({
        embeddings: [{ values: dummyLowerApple }],
      })

    const upper = await service.generateEmbedding('Apple')
    expect(upper.embedding).toEqual(dummyApple)
    expect(mockEmbedContent).toHaveBeenCalledTimes(1)

    const lower = await service.generateEmbedding('apple')
    expect(lower.embedding).toEqual(dummyLowerApple)
    expect(lower.cached).toBeUndefined()
    expect(mockEmbedContent).toHaveBeenCalledTimes(2)
  })

  it('does not log raw query text on cache hits', async () => {
    const dummyEmbedding = Array(1536).fill(0.05)
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: dummyEmbedding }],
    })
    const debugSpy = vi.spyOn(logger, 'debug')

    await service.generateEmbedding('confidential search query')
    await service.generateEmbedding('confidential search query')

    expect(debugSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({
        key: expect.anything(),
        text: expect.anything(),
      }),
      'Cache hit for text embedding',
    )
  })

  it('clears cache when clearCache is called', async () => {
    const dummyEmbedding = Array(1536).fill(0.05)
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: dummyEmbedding }],
    })

    await service.generateEmbedding('query')
    expect(mockEmbedContent).toHaveBeenCalledTimes(1)

    service.clearCache()

    await service.generateEmbedding('query')
    expect(mockEmbedContent).toHaveBeenCalledTimes(2)
  })

  it('throws if GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY
    await expect(service.generateEmbedding('test')).rejects.toThrow(
      'GEMINI_API_KEY environment variable is not configured',
    )
  })

  it('throws if Gemini returns empty embedding values', async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: null }],
    })
    await expect(service.generateEmbedding('test')).rejects.toThrow(
      'No embedding values returned from gemini-embedding-2',
    )
  })

  it('generates Gemma embedding (768d) when provider is gemma-embedding-2-openai', async () => {
    const dummyEmbedding = Array(768).fill(0.12)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'embeddinggemma-2',
        data: [{ embedding: dummyEmbedding }],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        usage: { prompt_tokens: 12 },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await service.generateEmbedding('drone footage', {
      provider: 'gemma-embedding-2-openai',
    })

    expect(result.embedding).toEqual(dummyEmbedding)
    expect(result.usage?.model).toBe('embeddinggemma-2')
    expect(result.usage?.inputTokens).toBe(12)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9379/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'embeddinggemma-2',
          input: 'task: search query | text: drone footage',
        }),
      }),
    )
  })

  it('respects GEMMA_EMBEDDING_OPENAI_BASE_URL without /v1 suffix', async () => {
    process.env.GEMMA_EMBEDDING_OPENAI_BASE_URL = 'http://custom-host:9379'
    const dummyEmbedding = Array(768).fill(0.12)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: dummyEmbedding }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await service.generateEmbedding('test query', {
      provider: 'gemma-embedding-2-openai',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://custom-host:9379/v1/embeddings',
      expect.anything(),
    )
  })

  it('throws descriptive error when Gemma server returns non-ok status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      service.generateEmbedding('test query', {
        provider: 'gemma-embedding-2-openai',
      }),
    ).rejects.toThrow('Embedding server returned status 503: Service Unavailable')
  })

  it('throws error when abort signal is triggered', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Operation cancelled by user'))

    await expect(
      service.generateEmbedding('test query', {
        signal: controller.signal,
      }),
    ).rejects.toThrow('Operation cancelled by user')
  })
})
