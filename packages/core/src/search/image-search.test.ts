import { prisma, Prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { imageSearchRequestSchema } from '@shumai/dtos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageEmbeddingService } from './image-embedding'
import { searchService } from './search'

function vector(dimensions: number, x: number, y = 0): number[] {
  return [x, y, ...Array<number>(dimensions - 2).fill(0)]
}

async function insertEmbedding(
  assetId: string,
  embedding: number[],
  startTime: number | null = null,
  endTime: number | null = null,
) {
  const column = embedding.length === 768 ? Prisma.sql`embedding_768` : Prisma.sql`embedding`
  await prisma.$executeRaw`
    INSERT INTO asset_embeddings (id, asset_id, ${column}, start_time, end_time, created_at, updated_at)
    VALUES (gen_random_uuid()::text, ${assetId}, ${JSON.stringify(embedding)}::vector,
      ${startTime}, ${endTime}, NOW(), NOW())
  `
}

async function createProjectAssets() {
  const team = await prisma.team.create({ data: { name: 'Image search team' } })
  const user = await prisma.user.create({
    data: { name: 'Embedding agent', email: 'visual-search-agent@example.com', type: 'agent' },
  })
  const agent = await prisma.agent.create({
    data: {
      id: user.id,
      teamId: team.id,
      type: 'embedding',
      config: { provider: 'google', model: 'gemini-embedding-2' },
    },
  })
  const project = await prisma.project.create({ data: { name: 'Visual search', teamId: team.id } })
  const root = await prisma.asset.create({
    data: { name: 'Root', type: 'root', status: 'processed', projectId: project.id },
  })
  await prisma.project.update({ where: { id: project.id }, data: { rootFolderId: root.id } })
  const subfolder = await prisma.asset.create({
    data: {
      name: 'Subfolder',
      type: 'folder',
      status: 'uploaded',
      projectId: project.id,
      parentId: root.id,
    },
  })
  const file = (name: string, mediaType: string, parentId = root.id) =>
    prisma.asset.create({
      data: { name, mediaType, parentId, projectId: project.id, type: 'file', status: 'processed' },
    })
  const source = await file('source.jpg', 'image/jpeg', subfolder.id)
  return { team, agent, root, subfolder, source, file }
}

describe('image search', () => {
  setupTestDbHooks()

  beforeEach(() => {
    vi.stubEnv('ENABLE_EMBEDDING_AGENT', undefined)
    vi.stubEnv('EMBEDDING_PROVIDER', 'gemini-embedding-2')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses the source sprite for a full match when duration is stored on the media record', async () => {
    const { root, source, file } = await createProjectAssets()
    const video = await file('short.mp4', 'video/mp4')
    await prisma.asset.update({
      where: { id: video.id },
      data: { media: { proxyType: 'video', duration: 60 } as PrismaJson.MediaInfo },
    })
    await insertEmbedding(source.id, vector(1536, 1))
    await insertEmbedding(video.id, vector(1536, 1), 0, 60)
    const results = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ sourceAssetId: source.id }),
    )
    expect(results.data).toMatchObject([
      { id: video.id, preview: { duration: 60 }, startTime: 0, endTime: 60 },
    ])
    expect(results.data[0].chunkPreview).toBeUndefined()
  })

  it('finds images and video segments across the project using the stored image vector', async () => {
    const { root, source, file } = await createProjectAssets()
    const image = await file('result.jpg', 'image/jpeg')
    const video = await file('result.mp4', 'video/mp4')
    const deleted = await file('deleted.jpg', 'image/jpeg')
    const audio = await file('audio.mp3', 'audio/mpeg')
    await prisma.asset.update({ where: { id: deleted.id }, data: { isDeleted: true } })

    await insertEmbedding(source.id, vector(1536, 1))
    await insertEmbedding(video.id, vector(1536, 1), 4, 12)
    await insertEmbedding(video.id, vector(1536, 0, 1), 12, 20)
    await prisma.asset.update({
      where: { id: video.id },
      data: {
        media: {
          duration: 1200,
          frames: 36_000,
          filesize: 100,
          proxyType: 'video',
          videoTranscodes: [],
          imageTranscodes: [],
          metadata: null,
          original: null,
          finishedAt: new Date().toISOString(),
          chunkPreviews: {
            '[4,12]': {
              posterKey: 'files/video/chunk-previews/poster.webp',
              spriteKey: 'files/video/chunk-previews/sprite.webp',
              columns: 2,
              rows: 1,
              frameWidth: 320,
              frameHeight: 180,
              timestamps: [4, 8],
            },
          },
        },
      },
    })
    await insertEmbedding(image.id, vector(1536, 1, 1))
    await insertEmbedding(deleted.id, vector(1536, 1))
    await insertEmbedding(audio.id, vector(1536, 1))

    const provider = vi.spyOn(imageEmbeddingService, 'generateEmbedding')
    const request = { sourceAssetId: source.id }
    const first = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ ...request, first: 2 }),
    )
    expect(first.data.map((item) => item.id)).toEqual([video.id, image.id])
    expect(first.data[0]).toMatchObject({
      startTime: 4,
      endTime: 12,
      chunkPreview: {
        posterUrl: expect.any(String),
        spriteUrl: expect.any(String),
        timestamps: [4, 8],
      },
    })
    expect(first.data[0].media).not.toHaveProperty('chunkPreviews')
    expect(first.data[1].chunkPreview).toBeUndefined()
    expect(first.pageInfo).toMatchObject({ total: 3, cursor: expect.any(String) })
    const next = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ ...request, first: 2, after: first.pageInfo.cursor }),
    )
    expect(next.data).toMatchObject([{ id: video.id, startTime: 12, endTime: 20 }])
    expect(next.data[0].chunkPreview).toBeUndefined()
    expect(next.pageInfo.cursor).toBeUndefined()

    const images = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ ...request, mediaType: 'image' }),
    )
    const videos = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ ...request, mediaType: 'video' }),
    )
    expect(images.data.map((item) => item.id)).toEqual([image.id])
    expect(videos.data.map((item) => item.startTime)).toEqual([4, 12])
    expect(provider).not.toHaveBeenCalled()
  })

  it('uses the active provider vector column and reports when an image needs indexing', async () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'gemma-embedding-2-openai')
    const { root, source, file } = await createProjectAssets()
    const image = await file('result.jpg', 'image/jpeg')
    const req = imageSearchRequestSchema.parse({ sourceAssetId: source.id })
    await insertEmbedding(source.id, vector(1536, 1))
    await expect(searchService.searchByImage(root.id, req)).rejects.toMatchObject({ status: 409 })

    await insertEmbedding(source.id, vector(768, 1))
    await insertEmbedding(image.id, vector(768, 1))
    const result = await searchService.searchByImage(root.id, req)
    expect(result.data.map((item) => item.id)).toEqual([image.id])
  })

  it('limits an uploaded-image search to the folder and applies metadata filters', async () => {
    const { team, subfolder, source, file } = await createProjectAssets()
    const match = await file('approved.png', 'image/png', subfolder.id)
    const outside = await file('outside.png', 'image/png')
    for (const asset of [match, source, outside]) {
      await insertEmbedding(asset.id, vector(1536, 1))
    }
    for (const asset of [match, outside]) {
      await prisma.assetMetadataValue.create({
        data: { assetId: asset.id, fieldKey: 'status', stringValue: 'approved' },
      })
    }
    const provider = vi
      .spyOn(imageEmbeddingService, 'generateEmbedding')
      .mockResolvedValue(vector(1536, 1))
    const image = 'aW1hZ2U='
    const result = await searchService.searchByImage(
      subfolder.id,
      imageSearchRequestSchema.parse({
        image,
        conditions: [{ field: 'status', operator: 'eq', value: 'approved' }],
      }),
    )
    expect(provider).toHaveBeenCalledWith(image, team.id)
    expect(result.data.map((item) => item.id)).toEqual([match.id])
  })

  it('requires a readable image from the project root scope', async () => {
    const { team, root, subfolder, source, file } = await createProjectAssets()
    const video = await file('video.mp4', 'video/mp4')
    const other = await prisma.project.create({ data: { name: 'Other project', teamId: team.id } })
    const otherImage = await prisma.asset.create({
      data: {
        name: 'other.jpeg',
        mediaType: 'image/jpeg',
        projectId: other.id,
        type: 'file',
        status: 'processed',
      },
    })
    for (const id of [video.id, otherImage.id]) {
      const req = imageSearchRequestSchema.parse({ sourceAssetId: id })
      await expect(searchService.searchByImage(root.id, req)).rejects.toMatchObject({ status: 404 })
    }
    const req = imageSearchRequestSchema.parse({ sourceAssetId: source.id })
    await expect(searchService.searchByImage(subfolder.id, req)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rejects both forms of image search when the agent is disabled', async () => {
    const { agent, root, source } = await createProjectAssets()
    vi.stubEnv('ENABLE_EMBEDDING_AGENT', 'false')
    await expect(
      searchService.searchByImage(
        root.id,
        imageSearchRequestSchema.parse({ sourceAssetId: source.id }),
      ),
    ).rejects.toMatchObject({ status: 422 })
    vi.stubEnv('ENABLE_EMBEDDING_AGENT', undefined)
    await prisma.agent.update({ where: { id: agent.id }, data: { enabled: false } })
    const provider = vi.spyOn(imageEmbeddingService, 'generateEmbedding')
    await expect(
      searchService.searchByImage(root.id, imageSearchRequestSchema.parse({ image: 'aW1hZ2U=' })),
    ).rejects.toMatchObject({ status: 422 })
    expect(provider).not.toHaveBeenCalled()
  })
})
