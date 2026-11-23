import { describe, expect, it, beforeEach, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { SearchService } from './search'
import { SearchConditionOperator } from '@shumai/dtos'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { textEmbeddingService } from './text-embedding'

import { AssetStatus, AssetType } from '@shumai/db'
import { assetService } from '@shumai/core/src/asset/asset'
import { versionStackService } from '@shumai/core/src/versionStack/versionStack'
import { s3Service } from '@shumai/core/src/s3/s3'

describe('SearchService', () => {
  setupTestDbHooks()

  let searchService: SearchService

  beforeEach(() => {
    searchService = new SearchService()
  })

  const setupBasicAssets = async () => {
    const user = await prisma.user.create({
      data: { name: 'test-user-search', email: 'search-user@example.com', type: 'human' },
    })

    const team = await prisma.team.create({
      data: { name: 'test-team' },
    })

    const project = await prisma.project.create({
      data: { name: 'test-project', teamId: team.id },
    })

    const rootFolder = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.folder,
        projectId: project.id,
        creatorId: user.id,
        sizeByte: 0,
        status: 'uploaded',
      },
    })

    const subFolder = await prisma.asset.create({
      data: {
        name: 'subfolder',
        type: AssetType.folder,
        projectId: project.id,
        parentId: rootFolder.id,
        creatorId: user.id,
        sizeByte: 0,
        status: 'uploaded',
      },
    })

    const file1 = await prisma.asset.create({
      data: {
        name: 'file1',
        type: AssetType.file,
        projectId: project.id,
        parentId: rootFolder.id,
        creatorId: user.id,
        sizeByte: 100,
        status: 'uploaded',
        createdAt: new Date('2023-01-01T00:00:00Z'),
      },
    })

    const file2 = await prisma.asset.create({
      data: {
        name: 'file2',
        type: AssetType.file,
        projectId: project.id,
        parentId: subFolder.id,
        creatorId: user.id,
        sizeByte: 200,
        status: 'uploaded',
        createdAt: new Date('2023-01-01T00:00:01Z'),
      },
    })

    await prisma.assetMetadataValue.create({
      data: {
        assetId: file2.id,
        fieldKey: 'status',
        stringValue: 'approved',
      },
    })

    return { rootFolder, subFolder, file1, file2 }
  }

  const setupMatrixAssets = async () => {
    const user = await prisma.user.create({
      data: { name: 'matrix-user', email: 'matrix@example.com', type: 'human' },
    })
    const team = await prisma.team.create({ data: { name: 'matrix-team' } })
    const project = await prisma.project.create({ data: { name: 'matrix-proj', teamId: team.id } })
    const root = await prisma.asset.create({
      data: {
        name: 'matrix-root',
        type: AssetType.folder,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    const createWithMeta = async (name: string, meta: Record<string, unknown>) => {
      const asset = await prisma.asset.create({
        data: {
          name,
          type: AssetType.file,
          projectId: project.id,
          parentId: root.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 100,
        },
      })
      const reqs = Object.entries(meta).map(([key, value]) => ({ key, value }))
      await metadataService.updateAssetMetadata(asset.id, reqs)
      return asset
    }

    // String fields
    await createWithMeta('str-apple', { text: 'apple' })
    await createWithMeta('str-banana', { text: 'banana' })
    await createWithMeta('sku-1-2', { sku: '1-2' })

    // Number fields
    await createWithMeta('num-10', { num: 10 })
    await createWithMeta('num-20', { num: 20 })

    // Bool fields
    await createWithMeta('bool-true', { bool: true })
    await createWithMeta('bool-false', { bool: false })

    // SelectMulti
    await createWithMeta('multi-a-b', { multi: ['a', 'b'] })
    await createWithMeta('multi-b-c', { multi: ['b', 'c'] })

    // Date
    await createWithMeta('date-today', { date: new Date().toISOString() })
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await createWithMeta('date-yesterday', { date: yesterday.toISOString() })

    // Name field specific tests
    await createWithMeta('name-contains-test', {})

    // One with nothing
    await prisma.asset.create({
      data: {
        name: 'nothing',
        type: AssetType.file,
        projectId: project.id,
        parentId: root.id,
        creatorId: user.id,
        status: 'uploaded',
        sizeByte: 100,
      },
    })

    return { root }
  }

  describe('Exhaustive Operator Matrix', () => {
    let rootId: string
    beforeEach(async () => {
      const { root } = await setupMatrixAssets()
      rootId = root.id
    })

    it.each([
      // Name field (System)
      { field: 'name', op: 'eq', val: 'str-apple', expected: ['str-apple'] },
      {
        field: 'name',
        op: 'neq',
        val: 'str-apple',
        expected: [
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      { field: 'name', op: 'contains', val: 'apple', expected: ['str-apple'] },
      {
        field: 'name',
        op: 'notContains',
        val: 'apple',
        expected: [
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      { field: 'name', op: 'isEmpty', val: '', expected: [] }, // name is never empty in this setup
      {
        field: 'name',
        op: 'isNotEmpty',
        val: '',
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },

      // String Metadata
      { field: 'text', op: 'eq', val: 'apple', expected: ['str-apple'] },
      { field: 'sku', op: 'eq', val: '1-2', expected: ['sku-1-2'] },
      {
        field: 'text',
        op: 'neq',
        val: 'apple',
        expected: [
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      {
        field: 'text',
        op: 'isEmpty',
        val: null,
        expected: [
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      { field: 'text', op: 'isNotEmpty', val: null, expected: ['str-apple', 'str-banana'] },

      // Number Metadata
      { field: 'num', op: 'eq', val: 10, expected: ['num-10'] },
      {
        field: 'num',
        op: 'neq',
        val: 10,
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      { field: 'num', op: 'gt', val: 15, expected: ['num-20'] },
      { field: 'num', op: 'gt', val: 100, expected: [] },
      { field: 'num', op: 'lt', val: 15, expected: ['num-10'] },
      { field: 'num', op: 'gte', val: 20, expected: ['num-20'] },
      { field: 'num', op: 'lte', val: 10, expected: ['num-10'] },

      // Boolean Metadata
      { field: 'bool', op: 'eq', val: true, expected: ['bool-true'] },
      { field: 'bool', op: 'eq', val: false, expected: ['bool-false'] },

      // SelectMulti Metadata
      { field: 'multi', op: 'hasAny', val: ['a'], expected: ['multi-a-b'] },
      { field: 'multi', op: 'hasAny', val: ['b'], expected: ['multi-a-b', 'multi-b-c'] },
      { field: 'multi', op: 'hasAny', val: ['a', 'c'], expected: ['multi-a-b', 'multi-b-c'] },
      { field: 'multi', op: 'hasAll', val: ['a', 'b'], expected: ['multi-a-b'] },
      { field: 'multi', op: 'hasAll', val: ['a', 'c'], expected: [] },
      {
        field: 'multi',
        op: 'hasNone',
        val: ['a'],
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      {
        field: 'multi',
        op: 'hasNone',
        val: ['a', 'c'],
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      { field: 'multi', op: 'eq', val: ['a', 'b'], expected: ['multi-a-b'] },

      // Date Metadata
      { field: 'date', op: 'eq', val: 'today', expected: ['date-today'] },
      { field: 'date', op: 'lte', val: 'today', expected: ['date-today', 'date-yesterday'] },
      { field: 'date', op: 'isWithin', val: 'today', expected: ['date-today'] },
      { field: 'date', op: 'lt', val: 'today', expected: ['date-yesterday'] },
      { field: 'date', op: 'gt', val: 'yesterday', expected: ['date-today'] },

      // System Fields (native columns)
      {
        field: 'sizeByte',
        op: 'gt',
        val: 50,
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      { field: 'name', op: 'contains', val: 'apple', expected: ['str-apple'] },
      {
        field: 'createdAt',
        op: 'gt',
        val: 'one week ago',
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      {
        field: 'createdAt',
        op: 'eq',
        val: 'today',
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
      {
        field: 'createdAt',
        op: 'lte',
        val: 'today',
        expected: [
          'str-apple',
          'str-banana',
          'sku-1-2',
          'num-10',
          'num-20',
          'bool-true',
          'bool-false',
          'multi-a-b',
          'multi-b-c',
          'date-today',
          'date-yesterday',
          'name-contains-test',
          'nothing',
        ],
      },
    ])('filters $field with $op $val', async ({ field, op, val, expected }) => {
      const result = await searchService.search(rootId, {
        conditions: [{ field, operator: op as SearchConditionOperator, value: val }],
        recursively: true,
        assetType: 'file',
        operator: 'AND',
        isSemantic: false,
      })
      const names = result.data.map((a) => a.name).sort()
      expect(names).toEqual(expected.sort())
    })
  })

  it('searches for assets by name (equals)', async () => {
    const { rootFolder, file1 } = await setupBasicAssets()

    const result = await searchService.search(rootFolder.id, {
      conditions: [{ field: 'name', operator: 'eq', value: 'file1' }],
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      isSemantic: false,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(file1.id)
  })

  it('searches for assets by name (contains)', async () => {
    const { rootFolder, file1, file2 } = await setupBasicAssets()

    const result = await searchService.search(rootFolder.id, {
      conditions: [{ field: 'name', operator: 'contains', value: 'file' }],
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      isSemantic: false,
    })

    expect(result.data).toHaveLength(2)
    const ids = result.data.map((a) => a.id)
    expect(ids).toContain(file1.id)
    expect(ids).toContain(file2.id)
  })

  it('searches for assets by metadata (equals)', async () => {
    const { rootFolder, file2 } = await setupBasicAssets()

    const result = await searchService.search(rootFolder.id, {
      conditions: [{ field: 'status', operator: 'eq', value: 'approved' }],
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      isSemantic: false,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(file2.id)
  })

  it('searches only in the specified folder if recursively is false', async () => {
    const { rootFolder, file1 } = await setupBasicAssets()

    const result = await searchService.search(rootFolder.id, {
      conditions: [{ field: 'name', operator: 'contains', value: 'file' }],
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      isSemantic: false,
    })

    // Should only find file1, as file2 is in subfolder
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(file1.id)
  })

  it('sorts by createdAt', async () => {
    const { rootFolder } = await setupBasicAssets()

    // file1 was created before file2, but file2 is in subfolder.
    // wait, I need to be sure about the creation order.
    // setupBasicAssets creates file1 then file2.

    const resultAsc = await searchService.search(rootFolder.id, {
      sort: { field: 'createdAt', order: 'asc' },
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })
    expect(resultAsc.data[0].name).toBe('file1')
    expect(resultAsc.data[1].name).toBe('file2')

    const resultDesc = await searchService.search(rootFolder.id, {
      sort: { field: 'createdAt', order: 'desc' },
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })
    expect(resultDesc.data[0].name).toBe('file2')
    expect(resultDesc.data[1].name).toBe('file1')
  })

  it('sorts by sizeByte', async () => {
    const { rootFolder } = await setupBasicAssets()

    // file1 size 100, file2 size 200
    const resultAsc = await searchService.search(rootFolder.id, {
      sort: { field: 'sizeByte', order: 'asc' },
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })
    expect(resultAsc.data[0].sizeByte).toBe(100)
    expect(resultAsc.data[1].sizeByte).toBe(200)

    const resultDesc = await searchService.search(rootFolder.id, {
      sort: { field: 'sizeByte', order: 'desc' },
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })
    expect(resultDesc.data[0].sizeByte).toBe(200)
    expect(resultDesc.data[1].sizeByte).toBe(100)
  })

  it('includes symlinks when showSymlink is true', async () => {
    const { rootFolder, file1 } = await setupBasicAssets()

    // Create a symlink in the root folder pointing to file2
    const symlink = await prisma.asset.create({
      data: {
        name: 'symlink-to-file2',
        type: AssetType.symlink,
        projectId: file1.projectId,
        parentId: rootFolder.id,
        targetId: file1.id, // Pointing to file1 for simplicity
        status: 'uploaded',
      },
    })

    // Search without showSymlink
    const resultNormal = await searchService.search(rootFolder.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })
    expect(resultNormal.data.find((a) => a.id === symlink.id)).toBeUndefined()

    // Search with showSymlink
    const resultWithSymlink = await searchService.search(rootFolder.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      showSymlink: true,
      isSemantic: false,
    })
    expect(resultWithSymlink.data.find((a) => a.id === symlink.id)).toBeDefined()
  })

  it('excludes soft-deleted (trashed) files from latestChildren when searching folders', async () => {
    const { rootFolder } = await setupBasicAssets()

    const subfolder = await prisma.asset.create({
      data: {
        name: 'subfolder',
        type: AssetType.folder,
        projectId: rootFolder.projectId,
        parentId: rootFolder.id,
        status: 'uploaded',
      },
    })

    const childFile1 = await prisma.asset.create({
      data: {
        name: 'child1.txt',
        type: AssetType.file,
        projectId: rootFolder.projectId,
        parentId: subfolder.id,
        status: 'uploaded',
        sortIndex: 'a0',
      },
    })

    await prisma.asset.create({
      data: {
        name: 'child2.txt',
        type: AssetType.file,
        projectId: rootFolder.projectId,
        parentId: subfolder.id,
        status: 'uploaded',
        sortIndex: 'a1',
      },
    })

    await assetService.deleteAssets([childFile1.id])

    const result = await searchService.search(rootFolder.id, {
      recursively: false,
      assetType: 'folder',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })

    const searchedSubfolder = result.data.find((a) => a.id === subfolder.id)
    expect(searchedSubfolder).toBeDefined()

    expect(searchedSubfolder?.latestChildren?.length).toBe(1)
  })

  describe('Semantic Search with multiple chunks and distance ordering', () => {
    it('returns multiple matching segments from the same asset and orders by distance', async () => {
      const user = await prisma.user.create({
        data: { name: 'semantic-user', email: 'semantic-user@example.com', type: 'human' },
      })

      const team = await prisma.team.create({
        data: { name: 'semantic-team' },
      })

      const project = await prisma.project.create({
        data: { name: 'semantic-project', teamId: team.id },
      })

      // We need an embedding agent that is enabled for semantic search to be allowed
      const botUser = await prisma.user.create({
        data: { name: 'Embedding Bot', email: 'emb@example.com', type: 'agent' },
      })
      const provider = await prisma.provider.create({
        data: {
          name: 'google',
          teamId: team.id,
          config: { api: 'google', apiKey: 'key' } as unknown as PrismaJson.ProviderConfig,
        },
      })
      const model = await prisma.model.create({
        data: {
          modelId: 'gemini',
          name: 'Gemini',
          providerId: provider.id,
          config: {
            reasoning: false,
            input: ['text'],
            contextWindow: 1000,
            maxTokens: 1000,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          } as unknown as PrismaJson.ModelConfig,
        },
      })
      await prisma.agent.create({
        data: {
          id: botUser.id,
          teamId: team.id,
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: { provider: 'google', model: 'gemini' },
        },
      })

      const rootFolder = await prisma.asset.create({
        data: {
          name: 'root',
          type: AssetType.folder,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const videoAssetA = await prisma.asset.create({
        data: {
          name: 'videoA.mp4',
          type: AssetType.file,
          projectId: project.id,
          parentId: rootFolder.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const videoAssetB = await prisma.asset.create({
        data: {
          name: 'videoB.mp4',
          type: AssetType.file,
          projectId: project.id,
          parentId: rootFolder.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      // Insert embedding chunks:
      // We will insert 2 chunks for videoAssetA and 1 chunk for videoAssetB.
      // Vector size is 1536. We use unit vectors to ensure distinct cosine distances:
      // Chunk A1: startTime = 0.0, endTime = 10.0, embedding = [1, 0, 0...] (cosine similarity = 1.0, distance = 0.0)
      // Chunk B1: startTime = 5.0, endTime = 15.0, embedding = [1, 1, 0...] (cosine similarity = 0.707, distance = 0.293)
      // Chunk A2: startTime = 10.0, endTime = 20.0, embedding = [0, 1, 0...] (cosine similarity = 0.0, distance = 1.0)

      const arrA1 = Array(1536).fill(0)
      arrA1[0] = 1.0
      const vectorA1 = JSON.stringify(arrA1)

      const arrB1 = Array(1536).fill(0)
      arrB1[0] = 1.0
      arrB1[1] = 1.0
      const vectorB1 = JSON.stringify(arrB1)

      const arrA2 = Array(1536).fill(0)
      arrA2[1] = 1.0
      const vectorA2 = JSON.stringify(arrA2)

      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, created_at, updated_at)
        VALUES (
          'chunk-a1', 
          ${videoAssetA.id}, 
          ${vectorA1}::vector, 
          0.0, 
          10.0, 
          NOW(), 
          NOW()
        )
      `
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, created_at, updated_at)
        VALUES (
          'chunk-a2', 
          ${videoAssetA.id}, 
          ${vectorA2}::vector, 
          10.0, 
          20.0, 
          NOW(), 
          NOW()
        )
      `
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, created_at, updated_at)
        VALUES (
          'chunk-b1', 
          ${videoAssetB.id}, 
          ${vectorB1}::vector, 
          5.0, 
          15.0, 
          NOW(), 
          NOW()
        )
      `

      const sprite = { key: 'files/video-a/chunk-0-10.webp', columns: 5, rows: 2, frameCount: 7 }
      await prisma.assetEmbedding.update({ where: { id: 'chunk-a1' }, data: { sprite } })
      const unsignedKey = 'files/video-b/chunk-5-15.webp'
      await prisma.assetEmbedding.update({
        where: { id: 'chunk-b1' },
        data: { sprite: { ...sprite, key: unsignedKey } },
      })
      const presign = s3Service.presign.bind(s3Service)
      const signSprite = vi
        .spyOn(s3Service, 'presign')
        .mockImplementation((bucket, key, method) =>
          key === unsignedKey
            ? Promise.reject(new Error('Signing failed'))
            : presign(bucket, key, method),
        )

      // Mock the embedding generation
      // Our query vector points along the first dimension [1, 0, 0...]
      const queryVector = Array(1536).fill(0)
      queryVector[0] = 1.0
      const mockGenerateEmbedding = vi
        .spyOn(textEmbeddingService, 'generateEmbedding')
        .mockResolvedValue({
          embedding: queryVector,
        })

      // Search using semantic mode
      const result = await searchService.search(rootFolder.id, {
        recursively: true,
        assetType: 'file',
        operator: 'AND',
        conditions: [],
        query: 'find some cute cat video segments',
        isSemantic: true,
      })

      // We expect 3 distinct results because videoAssetA matches twice and videoAssetB matches once:
      // Sorting should be based on vector distance:
      // Distance from query (0.2) to:
      // - Chunk A1 (0.1): |0.2 - 0.1| = 0.1 -> closest (1st)
      // - Chunk B1 (0.5): |0.2 - 0.5| = 0.3 -> medium (2nd)
      // - Chunk A2 (0.9): |0.2 - 0.9| = 0.7 -> farthest (3rd)

      expect(result.data).toHaveLength(3)

      // 1st: Chunk A1
      expect(result.data[0].id).toBe(videoAssetA.id)
      expect(result.data[0].startTime).toBe(0)
      expect(result.data[0].endTime).toBe(10)
      expect(result.data[0].matchedSprite).toEqual({
        url: expect.stringContaining(sprite.key),
        columns: 5,
        rows: 2,
        frameCount: 7,
      })

      // 2nd: Chunk B1
      expect(result.data[1].id).toBe(videoAssetB.id)
      expect(result.data[1].startTime).toBe(5)
      expect(result.data[1].endTime).toBe(15)
      expect(result.data[1].matchedSprite).toBeUndefined()

      // 3rd: Chunk A2
      expect(result.data[2].id).toBe(videoAssetA.id)
      expect(result.data[2].startTime).toBe(10)
      expect(result.data[2].endTime).toBe(20)
      expect(result.data[2].matchedSprite).toBeUndefined()

      signSprite.mockRestore()
      mockGenerateEmbedding.mockRestore()
    })

    it('matches and sorts 768-dimensional embeddings using embedding_768 column', async () => {
      const user = await prisma.user.create({
        data: { name: 'semantic-user-768', email: 'semantic-user-768@example.com', type: 'human' },
      })

      const team = await prisma.team.create({
        data: { name: 'semantic-team-768' },
      })

      const project = await prisma.project.create({
        data: { name: 'semantic-project-768', teamId: team.id },
      })

      const botUser = await prisma.user.create({
        data: { name: 'Embedding Bot 768', email: 'emb-768@example.com', type: 'agent' },
      })
      const provider = await prisma.provider.create({
        data: {
          name: 'gemma',
          teamId: team.id,
          config: { api: 'openai', apiKey: 'key' } as unknown as PrismaJson.ProviderConfig,
        },
      })
      const model = await prisma.model.create({
        data: {
          modelId: 'embeddinggemma-2',
          name: 'EmbeddingGemma 2',
          providerId: provider.id,
          config: {
            reasoning: false,
            input: ['text'],
            contextWindow: 1000,
            maxTokens: 1000,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          } as unknown as PrismaJson.ModelConfig,
        },
      })
      await prisma.agent.create({
        data: {
          id: botUser.id,
          teamId: team.id,
          type: 'embedding',
          enabled: true,
          providerId: provider.id,
          modelId: model.id,
          config: { provider: 'gemma-embedding-2-openai', model: 'embeddinggemma-2' },
        },
      })

      const rootFolder = await prisma.asset.create({
        data: {
          name: 'root-768',
          type: AssetType.folder,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const videoAssetA = await prisma.asset.create({
        data: {
          name: 'VideoA_768.mp4',
          type: AssetType.file,
          mediaType: 'video/mp4',
          projectId: project.id,
          parentId: rootFolder.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const videoAssetB = await prisma.asset.create({
        data: {
          name: 'VideoB_768.mp4',
          type: AssetType.file,
          mediaType: 'video/mp4',
          projectId: project.id,
          parentId: rootFolder.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const arrA1 = Array(768).fill(0)
      arrA1[0] = 1.0
      const vectorA1 = JSON.stringify(arrA1)

      const arrB1 = Array(768).fill(0)
      arrB1[0] = 1.0
      arrB1[1] = 1.0
      const vectorB1 = JSON.stringify(arrB1)

      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding_768, start_time, end_time, created_at, updated_at)
        VALUES (
          'chunk-768-a1', 
          ${videoAssetA.id}, 
          ${vectorA1}::vector, 
          0.0, 
          10.0, 
          NOW(), 
          NOW()
        )
      `
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding_768, start_time, end_time, created_at, updated_at)
        VALUES (
          'chunk-768-b1', 
          ${videoAssetB.id}, 
          ${vectorB1}::vector, 
          5.0, 
          15.0, 
          NOW(), 
          NOW()
        )
      `

      // Query vector with 768 dims pointing along dimension 0
      const queryVector = Array(768).fill(0)
      queryVector[0] = 1.0
      const mockGenerateEmbedding = vi
        .spyOn(textEmbeddingService, 'generateEmbedding')
        .mockResolvedValue({
          embedding: queryVector,
        })

      const result = await searchService.search(rootFolder.id, {
        recursively: true,
        assetType: 'file',
        operator: 'AND',
        conditions: [],
        query: 'find 768 dim match',
        isSemantic: true,
      })

      expect(result.data.length).toBeGreaterThanOrEqual(2)
      expect(result.data[0].id).toBe(videoAssetA.id)
      expect(result.data[1].id).toBe(videoAssetB.id)

      mockGenerateEmbedding.mockRestore()
    })

    it('throws 502 if embedding generation fails during semantic search', async () => {
      const user = await prisma.user.create({
        data: { name: 'semantic-user-fail', email: 'semantic-fail@example.com', type: 'human' },
      })
      const team = await prisma.team.create({
        data: { name: 'semantic-team-fail' },
      })
      const project = await prisma.project.create({
        data: { name: 'semantic-project-fail', teamId: team.id },
      })
      const botUser = await prisma.user.create({
        data: { name: 'Embedding Bot Fail', email: 'emb-fail@example.com', type: 'agent' },
      })
      await prisma.agent.create({
        data: {
          id: botUser.id,
          teamId: team.id,
          type: 'embedding',
          enabled: true,
          config: { provider: 'gemini-embedding-2', model: 'gemini-embedding-2' },
        },
      })
      const rootFolder = await prisma.asset.create({
        data: {
          name: 'root-fail',
          type: AssetType.folder,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      const mockGenerateEmbedding = vi
        .spyOn(textEmbeddingService, 'generateEmbedding')
        .mockRejectedValue(new Error('Rate limit exceeded'))

      await expect(
        searchService.search(rootFolder.id, {
          recursively: true,
          assetType: 'file',
          operator: 'AND',
          conditions: [],
          query: 'fail query',
          isSemantic: true,
        }),
      ).rejects.toThrow('Failed to generate query embedding: Rate limit exceeded')

      mockGenerateEmbedding.mockRestore()
    })

    it('rejects semantic search when ENABLE_EMBEDDING_AGENT is false', async () => {
      const user = await prisma.user.create({
        data: { name: 'u-emb-false', email: 'u-emb-false@example.com', type: 'human' },
      })
      const team = await prisma.team.create({ data: { name: 't-emb-false' } })
      const project = await prisma.project.create({
        data: { name: 'p-emb-false', teamId: team.id },
      })
      const rootFolder = await prisma.asset.create({
        data: {
          name: 'root-false',
          type: AssetType.folder,
          projectId: project.id,
          creatorId: user.id,
          status: 'uploaded',
        },
      })

      // Even if an embedding agent is enabled in db
      const bot = await prisma.user.create({
        data: { name: 'Bot', email: 'b-emb-false@example.com', password: 'pw', type: 'agent' },
      })
      await prisma.agent.create({
        data: {
          id: bot.id,
          teamId: team.id,
          type: 'embedding',
          enabled: true,
          config: { provider: '', model: '' },
        },
      })

      process.env.ENABLE_EMBEDDING_AGENT = 'false'
      try {
        await expect(
          searchService.search(rootFolder.id, {
            recursively: true,
            assetType: 'file',
            operator: 'AND',
            conditions: [],
            query: 'test query',
            isSemantic: true,
          }),
        ).rejects.toThrow('Embedding agent not configured or disabled for this team.')
      } finally {
        delete process.env.ENABLE_EMBEDDING_AGENT
      }
    })
  })

  describe('totalSize calculation', () => {
    it('calculates the true total size of matching files when total count < 2000', async () => {
      const { rootFolder } = await setupBasicAssets()

      // Search files recursively
      const resultRecursive = await searchService.search(rootFolder.id, {
        conditions: [],
        recursively: true,
        assetType: 'file',
        operator: 'AND',
        isSemantic: false,
      })

      expect(resultRecursive.pageInfo.total).toBe(2)
      expect(resultRecursive.pageInfo.totalSize).toBe(300) // file1 (100) + file2 (200)

      // Search files non-recursively
      const resultNonRecursive = await searchService.search(rootFolder.id, {
        conditions: [],
        recursively: false,
        assetType: 'file',
        operator: 'AND',
        isSemantic: false,
      })

      expect(resultNonRecursive.pageInfo.total).toBe(1)
      expect(resultNonRecursive.pageInfo.totalSize).toBe(100) // file1 (100)
    })

    it('returns -1 for totalSize when total count is >= 2000', async () => {
      // Mock prismaClient.$queryRaw for the count query to return 2500
      const mockPrisma = new Proxy(prisma, {
        get(target, prop) {
          if (prop === '$queryRaw') {
            return async (prismaSql: unknown) => {
              const sqlStr = (prismaSql as { text?: string })?.text || ''
              if (sqlStr.includes('COUNT(*)')) {
                return [{ count: 2500n }]
              }
              // For main query, just run it or return mock
              // We must cast to any because we are proxying the raw sql parameter
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return target.$queryRaw(prismaSql as any)
            }
          }
          const val = Reflect.get(target, prop)
          if (typeof val === 'function') {
            return val.bind(target)
          }
          return val
        },
      })

      // We must cast mockPrisma proxy as any because the type signature of SearchService
      // expects a full PrismaClient instance, whereas we only mocked $queryRaw.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localSearchService = new SearchService(mockPrisma as any)
      const { rootFolder } = await setupBasicAssets()

      const result = await localSearchService.search(rootFolder.id, {
        conditions: [],
        recursively: true,
        assetType: 'file',
        operator: 'AND',
        isSemantic: false,
      })

      expect(result.pageInfo.total).toBe(2500)
      expect(result.pageInfo.totalSize).toBe(-1)
    })
  })
})

describe('SearchService — natural sort by name', () => {
  setupTestDbHooks()

  let searchService: SearchService

  beforeEach(() => {
    searchService = new SearchService()
  })

  const setupSearchNaturalSortAssets = async (names: string[]) => {
    const user = await prisma.user.create({
      data: {
        name: 'search-natural-sort-user',
        email: `search-natural-sort-${Date.now()}@example.com`,
        type: 'human',
      },
    })
    const team = await prisma.team.create({ data: { name: 'search-natural-sort-team' } })
    const project = await prisma.project.create({
      data: { name: 'search-natural-sort-proj', teamId: team.id },
    })
    const root = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.folder,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })
    for (const name of names) {
      await prisma.asset.create({
        data: {
          name,
          type: AssetType.file,
          projectId: project.id,
          parentId: root.id,
          creatorId: user.id,
          status: 'uploaded',
          sizeByte: 0,
        },
      })
    }
    return { root }
  }

  it('returns results in natural name order (asc) via raw-SQL sort path', async () => {
    const { root } = await setupSearchNaturalSortAssets(['clip10', 'clip2', 'clip20', 'clip1'])

    const result = await searchService.search(root.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'name', order: 'asc' },
    })

    expect(result.data.map((a) => a.name)).toEqual(['clip1', 'clip2', 'clip10', 'clip20'])
  })

  it('returns results in natural name order (desc) via raw-SQL sort path', async () => {
    const { root } = await setupSearchNaturalSortAssets(['clip10', 'clip2', 'clip20', 'clip1'])

    const result = await searchService.search(root.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'name', order: 'desc' },
    })

    expect(result.data.map((a) => a.name)).toEqual(['clip20', 'clip10', 'clip2', 'clip1'])
  })

  it('sorts mixed alpha-numeric names naturally via search', async () => {
    const { root } = await setupSearchNaturalSortAssets([
      'scene 100',
      'scene 9',
      'scene 10',
      'scene 2',
    ])

    const result = await searchService.search(root.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'name', order: 'asc' },
    })

    expect(result.data.map((a) => a.name)).toEqual(['scene 2', 'scene 9', 'scene 10', 'scene 100'])
  })

  it('forwards previewFormat to listAssetsByIds during search', async () => {
    const { root } = await setupSearchNaturalSortAssets(['file1'])
    const spy = vi.spyOn(assetService, 'listAssetsByIds')

    await searchService.search(root.id, {
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      previewFormat: 'jpeg',
    })

    expect(spy).toHaveBeenCalledWith(expect.any(Array), 'jpeg')
    spy.mockRestore()
  })
})

describe('SearchService — version stacks', () => {
  setupTestDbHooks()

  let searchService: SearchService

  beforeEach(() => {
    searchService = new SearchService()
  })

  const setupVersionStacks = async () => {
    const user = await prisma.user.create({
      data: { name: 'stack-user', email: 'stack-search-user@example.com', type: 'human' },
    })
    const team = await prisma.team.create({ data: { name: 'stack-search-team' } })
    const project = await prisma.project.create({
      data: { name: 'stack-search-proj', teamId: team.id },
    })
    const rootFolder = await prisma.asset.create({
      data: {
        name: 'root',
        type: AssetType.root,
        projectId: project.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })
    await prisma.project.update({
      where: { id: project.id },
      data: { rootFolderId: rootFolder.id },
    })
    const subFolder = await prisma.asset.create({
      data: {
        name: 'subfolder',
        type: AssetType.folder,
        projectId: project.id,
        parentId: rootFolder.id,
        creatorId: user.id,
        status: 'uploaded',
      },
    })

    const createFile = (data: {
      name: string
      parentId: string
      sizeByte: number
      createdAt: Date
      status?: AssetStatus
      mediaType?: string
    }) =>
      prisma.asset.create({
        data: {
          name: data.name,
          type: AssetType.file,
          projectId: project.id,
          parentId: data.parentId,
          creatorId: user.id,
          sizeByte: data.sizeByte,
          createdAt: data.createdAt,
          status: data.status ?? AssetStatus.processed,
          mediaType: data.mediaType ?? 'image/png',
        },
      })

    // Stack A (in rootFolder): 5 versions, v5 is latest (index 0)
    const firstStackFiles = [
      await createFile({
        name: 'hero_final.png',
        parentId: rootFolder.id,
        sizeByte: 500,
        createdAt: new Date('2026-05-10T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_draft_4.png',
        parentId: rootFolder.id,
        sizeByte: 400,
        createdAt: new Date('2026-05-04T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_draft_3.png',
        parentId: rootFolder.id,
        sizeByte: 300,
        createdAt: new Date('2026-05-03T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_draft_2.png',
        parentId: rootFolder.id,
        sizeByte: 200,
        createdAt: new Date('2026-05-02T10:00:00Z'),
      }),
      await createFile({
        name: 'old_only_keyword.png',
        parentId: rootFolder.id,
        sizeByte: 100,
        createdAt: new Date('2026-05-01T10:00:00Z'),
        status: AssetStatus.archived,
      }),
    ]
    const stackA = await versionStackService.createVersionStack({
      fileIds: firstStackFiles.map((f) => f.id),
      projectId: project.id,
      creatorId: user.id,
    })

    // Stack B (in subFolder): 5 versions, v5 is latest (index 0)
    const secondStackFiles = [
      await createFile({
        name: 'hero_banner.png',
        parentId: subFolder.id,
        sizeByte: 800,
        createdAt: new Date('2026-05-12T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_old_4.png',
        parentId: subFolder.id,
        sizeByte: 200,
        createdAt: new Date('2026-05-04T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_old_3.png',
        parentId: subFolder.id,
        sizeByte: 200,
        createdAt: new Date('2026-05-03T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_old_2.png',
        parentId: subFolder.id,
        sizeByte: 200,
        createdAt: new Date('2026-05-02T10:00:00Z'),
      }),
      await createFile({
        name: 'hero_old_1.png',
        parentId: subFolder.id,
        sizeByte: 200,
        createdAt: new Date('2026-05-01T10:00:00Z'),
      }),
    ]
    const stackB = await versionStackService.createVersionStack({
      fileIds: secondStackFiles.map((f) => f.id),
      projectId: project.id,
      creatorId: user.id,
    })

    const standalone = await createFile({
      name: 'standalone.png',
      parentId: rootFolder.id,
      sizeByte: 50,
      createdAt: new Date('2026-05-05T10:00:00Z'),
    })

    // Metadata on latest versions vs older versions
    await metadataService.updateAssetMetadata(stackA.id, [{ key: 'status', value: 'approved' }])
    await metadataService.updateAssetMetadata(stackB.id, [{ key: 'status', value: 'approved' }])
    await metadataService.updateAssetMetadata(firstStackFiles[4].id, [
      { key: 'tag', value: 'legacy' },
    ])

    return {
      user,
      team,
      project,
      rootFolder,
      subFolder,
      stackA,
      firstStackFiles,
      stackB,
      secondStackFiles,
      standalone,
    }
  }

  it('returns 2 version stacks instead of 10 individual versions in recursive and non-recursive search', async () => {
    const { rootFolder, stackA, stackB, standalone } = await setupVersionStacks()

    const recursive = await searchService.search(rootFolder.id, {
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })

    expect(recursive.pageInfo.total).toBe(3)
    expect(recursive.pageInfo.totalSize).toBe(500 + 800 + 50)
    expect(recursive.data.map((a) => a.id).sort()).toEqual(
      [stackA.id, stackB.id, standalone.id].sort(),
    )

    const returnedA = recursive.data.find((a) => a.id === stackA.id)!
    const returnedB = recursive.data.find((a) => a.id === stackB.id)!
    expect(returnedA.type).toBe(AssetType.version_stack)
    expect(returnedA.name).toBe('hero_final.png')
    expect(returnedA.versionStack?.id).toBe(stackA.id)
    expect(returnedA.versionStack?.versions).toHaveLength(5)
    expect(returnedB.type).toBe(AssetType.version_stack)
    expect(returnedB.name).toBe('hero_banner.png')
    expect(returnedB.versionStack?.versions).toHaveLength(5)

    const nonRecursive = await searchService.search(rootFolder.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      isSemantic: false,
    })

    expect(nonRecursive.pageInfo.total).toBe(2)
    expect(nonRecursive.pageInfo.totalSize).toBe(500 + 50)
    expect(nonRecursive.data.map((a) => a.id).sort()).toEqual([stackA.id, standalone.id].sort())
  })

  it('matches name contains (n-gram) against latest version only and updates when latest version changes', async () => {
    const { rootFolder, stackA, firstStackFiles, stackB } = await setupVersionStacks()

    const heroSearch = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'name', operator: 'contains', value: 'hero' }],
      isSemantic: false,
    })
    expect(heroSearch.pageInfo.total).toBe(2)
    expect(heroSearch.pageInfo.totalSize).toBe(500 + 800)
    expect(heroSearch.data.map((a) => a.id).sort()).toEqual([stackA.id, stackB.id].sort())
    expect(heroSearch.data.every((a) => a.type === AssetType.version_stack)).toBe(true)

    // Non-recursive name filter matches stackA in rootFolder
    const rootOnlyHero = await searchService.search(rootFolder.id, {
      recursively: false,
      operator: 'AND',
      conditions: [{ field: 'name', operator: 'contains', value: 'hero' }],
      isSemantic: false,
    })
    expect(rootOnlyHero.data.map((a) => a.id)).toEqual([stackA.id])

    // Keyword present only on older version v1 does NOT match
    const oldOnly = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'name', operator: 'contains', value: 'old_only_keyword' }],
      isSemantic: false,
    })
    expect(oldOnly.pageInfo.total).toBe(0)
    expect(oldOnly.data).toHaveLength(0)

    // Promote v1 to latest version -> now stackA matches
    await versionStackService.changeStackFileVersion({
      stackId: stackA.id,
      fileId: firstStackFiles[4].id,
      beforeId: firstStackFiles[0].id,
    })
    const promoted = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'name', operator: 'contains', value: 'old_only_keyword' }],
      isSemantic: false,
    })
    expect(promoted.pageInfo.total).toBe(1)
    expect(promoted.data).toHaveLength(1)
    expect(promoted.data[0].id).toBe(stackA.id)
    expect(promoted.data[0].type).toBe(AssetType.version_stack)
    expect(promoted.data[0].name).toBe('old_only_keyword.png')
  })

  it('evaluates metadata, isArchived, sizeByte, createdAt filters and sorting against latest version only', async () => {
    const { rootFolder, stackA, firstStackFiles, stackB, standalone } = await setupVersionStacks()

    // Metadata on latest version matches both stacks once
    const approved = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'status', operator: 'eq', value: 'approved' }],
      isSemantic: false,
    })
    expect(approved.pageInfo.total).toBe(2)
    expect(approved.data.map((a) => a.id).sort()).toEqual([stackA.id, stackB.id].sort())

    // Metadata only on older version does not match
    const legacy = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'tag', operator: 'eq', value: 'legacy' }],
      isSemantic: false,
    })
    expect(legacy.pageInfo.total).toBe(0)

    // isArchived = true: only v1 of stackA is archived, not latest v5 -> 0 matches
    const archivedBefore = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'isArchived', operator: 'eq', value: true }],
      isSemantic: false,
    })
    expect(archivedBefore.pageInfo.total).toBe(0)

    // Archive latest version of stackA -> returns stackA once (not both stack and child file)
    await prisma.asset.update({
      where: { id: firstStackFiles[0].id },
      data: { status: AssetStatus.archived },
    })
    const archivedAfter = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'isArchived', operator: 'eq', value: true }],
      isSemantic: false,
    })
    expect(archivedAfter.pageInfo.total).toBe(1)
    expect(archivedAfter.data.map((a) => a.id)).toEqual([stackA.id])

    // sizeByte evaluates latest version (stackA latest = 500, cumulative = 1500; stackB latest = 800)
    const largeFiles = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'sizeByte', operator: 'gt', value: 600 }],
      isSemantic: false,
    })
    expect(largeFiles.data.map((a) => a.id)).toEqual([stackB.id])

    // createdAt evaluates latest version
    const recentFiles = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'createdAt', operator: 'gte', value: '2026-05-11' }],
      isSemantic: false,
    })
    expect(recentFiles.data.map((a) => a.id)).toEqual([stackB.id])

    // Sort by name asc uses latest version name
    const byName = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'name', order: 'asc' },
    })
    expect(byName.data.map((a) => a.name)).toEqual([
      'hero_banner.png',
      'hero_final.png',
      'standalone.png',
    ])

    // Sort by sizeByte desc uses latest version size
    const bySize = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'sizeByte', order: 'desc' },
    })
    expect(bySize.data.map((a) => a.id)).toEqual([stackB.id, stackA.id, standalone.id])

    // Sort by createdAt desc uses latest version createdAt
    const byCreatedAt = await searchService.search(rootFolder.id, {
      recursively: true,
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'createdAt', order: 'desc' },
    })
    expect(byCreatedAt.data.map((a) => a.id)).toEqual([stackB.id, stackA.id, standalone.id])
  })

  it('semantic text search matches latest version embeddings only and returns version_stack items', async () => {
    const { team, rootFolder, stackA, firstStackFiles, stackB, secondStackFiles } =
      await setupVersionStacks()

    const botUser = await prisma.user.create({
      data: { name: 'Stack Emb Bot', email: 'stack-emb@example.com', type: 'agent' },
    })
    await prisma.agent.create({
      data: {
        id: botUser.id,
        teamId: team.id,
        type: 'embedding',
        enabled: true,
        config: { provider: 'google', model: 'gemini' },
      },
    })

    const vec = (x: number, y: number) => {
      const arr = Array<number>(1536).fill(0)
      arr[0] = x
      arr[1] = y
      return JSON.stringify(arr)
    }

    // Insert embeddings for ALL 5 versions of stackA (older version v1 has exact match [1,0], latest v5 has [1,1])
    await prisma.$executeRaw`
      INSERT INTO asset_embeddings (id, asset_id, embedding, created_at, updated_at)
      VALUES ('sa-v5', ${firstStackFiles[0].id}, ${vec(1, 1)}::vector, NOW(), NOW())
    `
    for (let i = 1; i < firstStackFiles.length; i++) {
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, created_at, updated_at)
        VALUES (${`sa-v${5 - i}`}, ${firstStackFiles[i].id}, ${vec(1, 0)}::vector, NOW(), NOW())
      `
    }

    // Insert 2 video chunk embeddings on stackB's latest version + 1 embedding on an older version
    await prisma.$executeRaw`
      INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, created_at, updated_at)
      VALUES ('sb-v5-c1', ${secondStackFiles[0].id}, ${vec(1, 0)}::vector, 5, 15, NOW(), NOW())
    `
    await prisma.$executeRaw`
      INSERT INTO asset_embeddings (id, asset_id, embedding, start_time, end_time, created_at, updated_at)
      VALUES ('sb-v5-c2', ${secondStackFiles[0].id}, ${vec(0, 1)}::vector, 20, 30, NOW(), NOW())
    `
    for (let i = 1; i < secondStackFiles.length; i++) {
      await prisma.$executeRaw`
        INSERT INTO asset_embeddings (id, asset_id, embedding, created_at, updated_at)
        VALUES (${`sb-v${5 - i}`}, ${secondStackFiles[i].id}, ${vec(1, 0)}::vector, NOW(), NOW())
      `
    }

    const queryVec = Array<number>(1536).fill(0)
    queryVec[0] = 1
    const mockEmb = vi
      .spyOn(textEmbeddingService, 'generateEmbedding')
      .mockResolvedValue({ embedding: queryVec })

    try {
      const result = await searchService.search(rootFolder.id, {
        recursively: true,
        operator: 'AND',
        conditions: [],
        query: 'hero shot',
        isSemantic: true,
      })

      // Expect 3 results total: stackB chunk 1 (dist 0), stackA latest (dist 0.293), stackB chunk 2 (dist 1.0)
      // None of the 8 older versions should appear
      expect(result.pageInfo.total).toBe(3)
      expect(result.data).toHaveLength(3)
      expect(
        result.data.map((d) => ({ id: d.id, startTime: d.startTime, endTime: d.endTime })),
      ).toEqual([
        { id: stackB.id, startTime: 5, endTime: 15 },
        { id: stackA.id, startTime: null, endTime: null },
        { id: stackB.id, startTime: 20, endTime: 30 },
      ])
      expect(result.data[0].type).toBe(AssetType.version_stack)
      expect(result.data[0].versionStack?.versions).toHaveLength(5)
      expect(result.data[1].type).toBe(AssetType.version_stack)
      expect(result.data[1].versionStack?.versions).toHaveLength(5)
    } finally {
      mockEmb.mockRestore()
    }
  })
})
