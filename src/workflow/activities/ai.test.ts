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

const mockEmbedContent = vi.fn().mockResolvedValue({
  embeddings: [
    {
      values: [0.1, 0.2, 0.3],
    },
  ],
})

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

describe('AI Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
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
