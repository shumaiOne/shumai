import { AssetType, prisma, Prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { imageSearchRequestSchema } from '@shumai/dtos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { s3Service } from '@shumai/core/src/s3/s3'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
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
  sprite?: PrismaJson.VideoChunkSprite,
) {
  const column = embedding.length === 768 ? Prisma.sql`embedding_768` : Prisma.sql`embedding`
  await prisma.$executeRaw`
    INSERT INTO asset_embeddings (id, asset_id, ${column}, start_time, end_time, sprite, created_at, updated_at)
    VALUES (gen_random_uuid()::text, ${assetId}, ${JSON.stringify(embedding)}::vector,
      ${startTime}, ${endTime}, ${sprite ? JSON.stringify(sprite) : null}::jsonb, NOW(), NOW())
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
  return { team, user, agent, project, root, subfolder, source, file }
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

  it('finds images and video segments across the project using the stored image vector', async () => {
    const { root, source, file } = await createProjectAssets()
    const image = await file('result.jpg', 'image/jpeg')
    const video = await file('result.mp4', 'video/mp4')
    const deleted = await file('deleted.jpg', 'image/jpeg')
    const audio = await file('audio.mp3', 'audio/mpeg')
    await prisma.asset.update({ where: { id: deleted.id }, data: { isDeleted: true } })

    await insertEmbedding(source.id, vector(1536, 1))
    const firstSprite = { key: 'files/video/chunk-4-12.webp', columns: 5, rows: 2, frameCount: 8 }
    const secondSprite = { ...firstSprite, key: 'files/video/chunk-12-20.webp' }
    await insertEmbedding(video.id, vector(1536, 1), 4, 12, firstSprite)
    await insertEmbedding(video.id, vector(1536, 0, 1), 12, 20, secondSprite)
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
      matchedSprite: { url: expect.stringContaining(firstSprite.key) },
    })
    expect(first.data[1].matchedSprite).toBeUndefined()
    expect(first.pageInfo).toMatchObject({ total: 3, cursor: expect.any(String) })
    const next = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ ...request, first: 2, after: first.pageInfo.cursor }),
    )
    expect(next.data).toMatchObject([
      {
        id: video.id,
        startTime: 12,
        endTime: 20,
        matchedSprite: { url: expect.stringContaining(secondSprite.key) },
      },
    ])
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

  it.each([
    { startTime: 0, endTime: 10, stored: true, useFullSprite: true },
    { startTime: 0, endTime: 10, stored: false, useFullSprite: false },
    { startTime: 0, endTime: 5, stored: true, useFullSprite: false },
    { startTime: 5, endTime: 10, stored: true, useFullSprite: false },
  ])(
    'picks the preview for $startTime–$endTime when full sprite availability is $stored',
    async ({ startTime, endTime, stored, useFullSprite }) => {
      const { root, source, file } = await createProjectAssets()
      const video = await file('result.mp4', 'video/mp4')
      const bucket = process.env.S3_BUCKET || 'shumai'
      const fullKey = `files/${video.id}/sprite.webp`
      const chunkKey = `files/${video.id}/chunk.webp`
      await prisma.asset.update({
        where: { id: video.id },
        data: {
          media: {
            duration: 10,
            proxyType: 'video',
            sprite: { key: fullKey, frames: 100, tileX: 10, tileY: 10 },
          } as PrismaJson.MediaInfo,
        },
      })
      if (stored) await s3Service.putObject(bucket, fullKey, 'sprite', 6, 'image/webp')
      try {
        await insertEmbedding(source.id, vector(1536, 1))
        await insertEmbedding(video.id, vector(1536, 1), startTime, endTime, {
          key: chunkKey,
          columns: 5,
          rows: 2,
          frameCount: 10,
        })

        const result = await searchService.searchByImage(
          root.id,
          imageSearchRequestSchema.parse({ sourceAssetId: source.id }),
        )
        expect(result.data).toHaveLength(1)
        expect(result.data[0]).toMatchObject({
          startTime,
          endTime,
          preview: { spriteUrl: expect.stringContaining(fullKey) },
        })
        if (useFullSprite) {
          expect(result.data[0].matchedSprite).toBeUndefined()
        } else {
          expect(result.data[0].matchedSprite?.url).toContain(chunkKey)
        }
      } finally {
        if (stored) await s3Service.deleteObject(bucket, fullKey)
      }
    },
  )

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

  it('matches only latest versions in version stacks for image search and find similar', async () => {
    const { user, project, root, subfolder, file } = await createProjectAssets()

    const firstStackFiles = await Promise.all([
      file('stack-a-v5.jpg', 'image/jpeg', root.id),
      file('stack-a-v4.jpg', 'image/jpeg', root.id),
      file('stack-a-v3.jpg', 'image/jpeg', root.id),
      file('stack-a-v2.jpg', 'image/jpeg', root.id),
      file('stack-a-v1.jpg', 'image/jpeg', root.id),
    ])
    const stackA = await versionStackService.createVersionStack({
      fileIds: firstStackFiles.map((f) => f.id),
      projectId: project.id,
      creatorId: user.id,
    })

    const secondStackFiles = await Promise.all([
      file('stack-b-v5.jpg', 'image/jpeg', subfolder.id),
      file('stack-b-v4.jpg', 'image/jpeg', subfolder.id),
      file('stack-b-v3.jpg', 'image/jpeg', subfolder.id),
      file('stack-b-v2.jpg', 'image/jpeg', subfolder.id),
      file('stack-b-v1.jpg', 'image/jpeg', subfolder.id),
    ])
    const stackB = await versionStackService.createVersionStack({
      fileIds: secondStackFiles.map((f) => f.id),
      projectId: project.id,
      creatorId: user.id,
    })

    // Stack C has an embedding ONLY on an older version, not its latest version -> should never match
    const thirdStackFiles = await Promise.all([
      file('stack-c-v2.jpg', 'image/jpeg', root.id),
      file('stack-c-v1.jpg', 'image/jpeg', root.id),
    ])
    await versionStackService.createVersionStack({
      fileIds: thirdStackFiles.map((f) => f.id),
      projectId: project.id,
      creatorId: user.id,
    })

    // Give every version of stackA and stackB an embedding, plus older version of stackC
    await insertEmbedding(firstStackFiles[0].id, vector(1536, 1, 0))
    for (const f of firstStackFiles.slice(1)) {
      await insertEmbedding(f.id, vector(1536, 1, 0))
    }
    await insertEmbedding(secondStackFiles[0].id, vector(1536, 1, 1))
    for (const f of secondStackFiles.slice(1)) {
      await insertEmbedding(f.id, vector(1536, 1, 0))
    }
    await insertEmbedding(thirdStackFiles[1].id, vector(1536, 1, 0))

    // 1) Uploaded-image search returns 2 version stacks, not 11 separate files
    vi.spyOn(imageEmbeddingService, 'generateEmbedding').mockResolvedValue(vector(1536, 1, 0))
    const byImage = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ image: 'aW1hZ2U=' }),
    )
    expect(byImage.pageInfo.total).toBe(2)
    expect(byImage.data.map((d) => d.id)).toEqual([stackA.id, stackB.id])
    expect(byImage.data[0].type).toBe(AssetType.version_stack)
    expect(byImage.data[0].name).toBe('stack-a-v5.jpg')
    expect(byImage.data[0].versionStack?.versions).toHaveLength(5)
    expect(byImage.data[1].type).toBe(AssetType.version_stack)
    expect(byImage.data[1].name).toBe('stack-b-v5.jpg')
    expect(byImage.data[1].versionStack?.versions).toHaveLength(5)

    // 2) Find similar on stackA's latest version excludes stackA completely (all 5 versions)
    const similarFromLatest = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ sourceAssetId: firstStackFiles[0].id }),
    )
    expect(similarFromLatest.pageInfo.total).toBe(1)
    expect(similarFromLatest.data.map((d) => d.id)).toEqual([stackB.id])
    expect(similarFromLatest.data[0].versionStack?.versions).toHaveLength(5)

    // 3) Find similar on an older version ID of stackA also excludes stackA completely
    const similarFromOlder = await searchService.searchByImage(
      root.id,
      imageSearchRequestSchema.parse({ sourceAssetId: firstStackFiles[4].id }),
    )
    expect(similarFromOlder.pageInfo.total).toBe(1)
    expect(similarFromOlder.data.map((d) => d.id)).toEqual([stackB.id])
  })

  it('reuses full stored video sprite for full-range match on a video version stack', async () => {
    const { user, project, root, source, file } = await createProjectAssets()
    const v2 = await file('clip-v2.mp4', 'video/mp4')
    const v1 = await file('clip-v1.mp4', 'video/mp4')
    const stack = await versionStackService.createVersionStack({
      fileIds: [v2.id, v1.id],
      projectId: project.id,
      creatorId: user.id,
    })

    const bucket = process.env.S3_BUCKET || 'shumai'
    const fullKey = `files/${v2.id}/sprite.webp`
    const chunkKey = `files/${v2.id}/chunk.webp`
    await prisma.asset.update({
      where: { id: v2.id },
      data: {
        media: {
          duration: 10,
          proxyType: 'video',
          sprite: { key: fullKey, frames: 100, tileX: 10, tileY: 10 },
        } as PrismaJson.MediaInfo,
      },
    })
    await s3Service.putObject(bucket, fullKey, 'sprite', 6, 'image/webp')
    try {
      await insertEmbedding(source.id, vector(1536, 1))
      await insertEmbedding(v2.id, vector(1536, 1), 0, 10, {
        key: chunkKey,
        columns: 5,
        rows: 2,
        frameCount: 10,
      })
      await insertEmbedding(v1.id, vector(1536, 1), 0, 10)

      const result = await searchService.searchByImage(
        root.id,
        imageSearchRequestSchema.parse({ sourceAssetId: source.id }),
      )
      expect(result.pageInfo.total).toBe(1)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe(stack.id)
      expect(result.data[0].type).toBe(AssetType.version_stack)
      expect(result.data[0].versionStack?.versions).toHaveLength(2)
      expect(result.data[0].preview?.spriteUrl).toContain(fullKey)
      expect(result.data[0].matchedSprite).toBeUndefined()
    } finally {
      await s3Service.deleteObject(bucket, fullKey)
    }
  })
})
