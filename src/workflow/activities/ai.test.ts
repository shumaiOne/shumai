import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateEmbeddingActivity } from './ai'
import { s3Service } from '@/services/s3/s3'

vi.mock('@/services/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn(),
    listObjects: vi.fn(),
  },
}))

vi.mock('@/services/ai/provider/gemini', () => {
  return {
    GeminiProvider: class {
      generateImageEmbedding = vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    },
  }
})

describe('AI Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate image embedding', async () => {
    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('test-image'),
      contentType: 'image/png',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock getObject return value needs broad any casting
    } as any)

    const context = {
      agent: { config: { provider: 'google', model: 'gemini' } },
      asset: { id: 'a1', mediaType: 'image/png', storageKey: { key: 'test.png' } },
      dbProvider: { config: { apiKey: 'key' } },
    }

    const res = await generateEmbeddingActivity({
      teamId: 't1',
      assetId: 'a1',
      context,
    })

    expect(res.embeddings.length).toBe(1)
    expect(res.embeddings[0].embedding).toEqual([0.1, 0.2, 0.3])
    expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'test.png')
  })
})
