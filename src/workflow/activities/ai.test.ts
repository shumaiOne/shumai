import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { getAssetActivity, generateEmbeddingActivity, getCommentActivity } from './ai'
import { aiService } from '@/services/ai/ai'

vi.mock('@/services/ai/ai', () => ({
  aiService: {
    generateAssetEmbeddings: vi.fn(),
  },
}))

describe('AI Activities', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should get asset with project and team', async () => {
    const team = await prisma.team.create({ data: { name: 'Team A' } })
    const project = await prisma.project.create({
      data: { name: 'Proj A', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test.png',
        storageKey: { create: { key: 'test.png' } },
        status: 'uploaded',
        type: 'file',
        project: { connect: { id: project.id } },
      },
    })

    const result = await getAssetActivity(asset.id)
    expect(result?.project?.team?.id).toBe(team.id)
  })

  it('should call generateAssetEmbeddings', async () => {
    vi.mocked(aiService.generateAssetEmbeddings).mockResolvedValue({
      inputTokens: 1,
      outputTokens: 1,
      model: 'clip',
    })

    await generateEmbeddingActivity({ teamId: 't1', assetId: 'a1' })
    expect(aiService.generateAssetEmbeddings).toHaveBeenCalledWith('t1', 'a1')
  })

  it('should get and update comments', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', email: 'test-ai@example.com', password: 'pw' },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'test.png',
        storageKey: { create: { key: 'test.png' } },
        status: 'uploaded',
        type: 'file',
      },
    })

    const comment = await prisma.assetComment.create({
      data: {
        assetId: asset.id,
        creatorId: user.id,
        message: 'Original',
      },
    })

    const fetched = await getCommentActivity(comment.id)
    expect(fetched?.message).toBe('Original')
  })
})
