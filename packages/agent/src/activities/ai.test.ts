import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateTextEmbeddingActivity,
  extractAiMetadataActivity,
  getEmbeddingContextActivity,
  saveAssetEmbeddingsActivity,
  generateImageEmbeddingActivity,
  generateVideoChunkEmbeddingActivity,
} from './ai'
import { s3Service } from '@shumai/core/src/s3/s3'
import { transcodeService } from '@shumai/core'
import { prisma, AssetType, AssetStatus } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'

vi.mock('fs', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- importOriginal returns the raw fs module, typed dynamically as any here
  const actual = await importOriginal<any>()
  const mockRead = vi.fn((path, options) => {
    if (typeof path === 'string' && (path.includes('video-chunk') || path.includes('out1.webp'))) {
      return Buffer.from('chunk-data')
    }
    return actual.readFileSync(path, options)
  })
  return {
    ...actual,
    writeFileSync: vi.fn(),
    readFileSync: mockRead,
    unlinkSync: vi.fn(),
  }
})

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
    headObject: vi.fn(),
    listObjects: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/transcode/transcode', () => ({
  transcodeService: {
    extractVideoFrames: vi.fn(),
  },
}))

vi.mock('child_process', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock functions dynamically return varying types based on test command calls
  const execFileMock: any = vi.fn((file: any, args: any, cb: any) => {
    cb(null, '120.0\n', '')
  })
  // Setup custom promisify behavior to return { stdout, stderr }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock functions dynamically return varying types based on test command calls
  execFileMock[Symbol.for('nodejs.util.promisify.custom')] = vi.fn(async (file: any) => {
    if (file === 'ffprobe') {
      return { stdout: '120.0\n', stderr: '' }
    }
    return { stdout: '', stderr: '' }
  })
  return {
    execFile: execFileMock,
  }
})

const mockEmbedContent = vi.fn().mockResolvedValue({
  embeddings: [
    {
      values: [0.1, 0.2, 0.3],
    },
  ],
})

vi.mock('@google/genai', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- matches external library GoogleGenAI export naming convention
    GoogleGenAI: class {
      models = {
        embedContent: mockEmbedContent,
      }
    },
  }
})

describe('AI Activities Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('should generate image embedding', async () => {
    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('test-image'),
      contentType: 'image/png',
    } as unknown as { buffer: Buffer; contentType: string })

    const res = await generateImageEmbeddingActivity({
      teamId: 't1',
      assetKey: 'test.png',
      mediaType: 'image/png',
    })

    expect(res.embedding).toEqual([0.1, 0.2, 0.3])
    expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'test.png')
  })

  it('should generate video embedding in chunks', async () => {
    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('test-video'),
      contentType: 'video/mp4',
    } as unknown as { buffer: Buffer; contentType: string })

    const res = await generateVideoChunkEmbeddingActivity({
      teamId: 't1',
      chunkKey: 'files/a1/tmp-embedding-chunks/chunk-0-60.mp4',
    })

    expect(res.embedding).toEqual([0.1, 0.2, 0.3])
    expect(s3Service.getObject).toHaveBeenCalledWith(
      'shumai',
      'files/a1/tmp-embedding-chunks/chunk-0-60.mp4',
    )
  })

  it('should generate text embedding successfully', async () => {
    const res = await generateTextEmbeddingActivity({
      text: 'Search query',
      teamId: 't1',
    })

    expect(res.embedding).toEqual([0.1, 0.2, 0.3])
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-embedding-2',
        contents: [
          expect.objectContaining({
            parts: [{ text: 'Search query' }],
          }),
        ],
      }),
    )
  })

  describe('extractAiMetadataActivity', () => {
    it('should return existing images if they are already in S3 storage', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock returned object cast as any due to partial implementation
      vi.mocked(s3Service.headObject).mockResolvedValue({} as any)
      vi.mocked(s3Service.listObjects).mockResolvedValue([
        'project/ai_metadata/1.webp',
        'project/ai_metadata/2.webp',
      ])

      const res = await extractAiMetadataActivity({
        assetKey: 'project/video.mp4',
        filePath: '/tmp/video.mp4',
        type: 'autofill',
        isImage: false,
      })

      expect(res).toEqual(['project/ai_metadata/1.webp', 'project/ai_metadata/2.webp'])
      expect(s3Service.headObject).toHaveBeenCalledWith('shumai', 'project/ai_metadata/1.webp')
      expect(transcodeService.extractVideoFrames).not.toHaveBeenCalled()
    })

    it('should extract frames and upload to S3 if not already present', async () => {
      vi.mocked(s3Service.headObject).mockRejectedValue(new Error('Not Found'))
      vi.mocked(transcodeService.extractVideoFrames).mockResolvedValue(['/tmp/out1.webp'])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock returned object cast as any due to partial implementation
      vi.mocked(s3Service.putObject).mockResolvedValue({} as any)

      const res = await extractAiMetadataActivity({
        assetKey: 'project/video.mp4',
        filePath: '/tmp/video.mp4',
        type: 'autofill',
        isImage: false,
      })

      expect(res).toEqual(['project/ai_metadata/out1.webp'])
      expect(transcodeService.extractVideoFrames).toHaveBeenCalledWith({
        inputFile: '/tmp/video.mp4',
        outputDir: '/tmp',
        numFrames: 30,
        frameHeight: 720,
        isImage: false,
      })
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'shumai',
        'project/ai_metadata/out1.webp',
        expect.any(Buffer),
        expect.any(Number),
        'image/webp',
      )
    })
  })
})

describe('AI Database Activities Integration', () => {
  setupTestDbHooks()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variables hold Prisma model output types that are difficult to type explicitly in tests
  let team: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variables hold Prisma model output types that are difficult to type explicitly in tests
  let user: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variables hold Prisma model output types that are difficult to type explicitly in tests
  let asset: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variables hold Prisma model output types that are difficult to type explicitly in tests
  let storageKey: any

  beforeEach(async () => {
    vi.restoreAllMocks()

    team = await prisma.team.create({
      data: { name: 'AI Team' },
    })

    user = await prisma.user.create({
      data: {
        name: 'AI Agent User',
        email: 'aiagent@shumai.ai',
        type: 'agent',
      },
    })

    // Add user as a member of the team
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: 'editor',
      },
    })

    storageKey = await prisma.storageKey.create({
      data: {
        key: 'media/video.mp4',
      },
    })

    asset = await prisma.asset.create({
      data: {
        name: 'video.mp4',
        type: AssetType.file,
        status: AssetStatus.uploaded,
        mediaType: 'video/mp4',
        storageKeyId: storageKey.id,
      },
    })
  })

  describe('getEmbeddingContextActivity', () => {
    it('should retrieve embedding context and throw if embedding agent not configured/enabled', async () => {
      // Expect throw since agent not created yet
      await expect(
        getEmbeddingContextActivity({ teamId: team.id, assetId: asset.id }),
      ).rejects.toThrow('embedding feature is disabled or agent not found')

      // Create embedding agent
      await prisma.agent.create({
        data: {
          id: user.id, // match user.id
          teamId: team.id,
          type: 'embedding',
          enabled: true,
          config: {
            provider: 'openai',
            model: 'gpt-4',
          },
        },
      })

      const ctx = await getEmbeddingContextActivity({
        teamId: team.id,
        assetId: asset.id,
      })

      expect(ctx.agent.id).toBe(user.id)
      expect(ctx.asset.id).toBe(asset.id)
      expect(ctx.asset.mediaType).toBe('video/mp4')
    })

    it('should parse valid positive chunk duration and fallback on invalid or negative ones', async () => {
      // Create embedding agent if not already present
      const existingAgent = await prisma.agent.findUnique({ where: { id: user.id } })
      if (!existingAgent) {
        await prisma.agent.create({
          data: {
            id: user.id,
            teamId: team.id,
            type: 'embedding',
            enabled: true,
            config: {
              provider: 'openai',
              model: 'gpt-4',
            },
          },
        })
      }

      // Test default/fallback
      delete process.env.EMBEDDING_CHUNK_DURATION
      let ctx = await getEmbeddingContextActivity({
        teamId: team.id,
        assetId: asset.id,
      })
      expect(ctx.chunkDuration).toBe(60.0)
      expect(ctx.chunkOverlap).toBe(5.0)

      // Test valid positive
      process.env.EMBEDDING_CHUNK_DURATION = '45.5'
      process.env.EMBEDDING_CHUNK_OVERLAP = '10.0'
      ctx = await getEmbeddingContextActivity({
        teamId: team.id,
        assetId: asset.id,
      })
      expect(ctx.chunkDuration).toBe(45.5)
      expect(ctx.chunkOverlap).toBe(10.0)

      // Test negative/invalid for overlap
      process.env.EMBEDDING_CHUNK_OVERLAP = '-5.0'
      ctx = await getEmbeddingContextActivity({
        teamId: team.id,
        assetId: asset.id,
      })
      expect(ctx.chunkOverlap).toBe(5.0)

      process.env.EMBEDDING_CHUNK_OVERLAP = 'invalid'
      ctx = await getEmbeddingContextActivity({
        teamId: team.id,
        assetId: asset.id,
      })
      expect(ctx.chunkOverlap).toBe(5.0)

      // Cleanup env
      delete process.env.EMBEDDING_CHUNK_DURATION
      delete process.env.EMBEDDING_CHUNK_OVERLAP
    })
  })

  describe('saveAssetEmbeddingsActivity', () => {
    it('should save embeddings with start and end times to the database', async () => {
      const embeddings = [
        {
          embedding: Array(1536).fill(0.01),
          startTime: 0.0,
          endTime: 60.0,
        },
        {
          embedding: Array(1536).fill(0.02),
        },
      ]

      await saveAssetEmbeddingsActivity({
        assetId: asset.id,
        embeddings,
      })

      // Query raw embeddings from DB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- db query output is a raw postgres result array typed as any
      const dbEmbeddings: any[] = await prisma.$queryRaw`
        SELECT id, asset_id as "assetId", start_time as "startTime", end_time as "endTime"
        FROM asset_embeddings
        WHERE asset_id = ${asset.id}
        ORDER BY start_time ASC NULLS LAST
      `

      expect(dbEmbeddings.length).toBe(2)
      expect(dbEmbeddings[0].startTime).toBe(0.0)
      expect(dbEmbeddings[0].endTime).toBe(60.0)
      expect(dbEmbeddings[1].startTime).toBeNull()
    })
  })
})
