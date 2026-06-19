import { describe, expect, it, beforeEach, vi } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { SearchService } from './search'
import { SearchConditionOperator } from '@shumai/dtos'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { workflowService } from '@shumai/workflow-core'

import { AssetType } from '@shumai/db'

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
      {
        field: 'text',
        op: 'neq',
        val: 'apple',
        expected: [
          'str-banana',
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

      // Mock the embedding generation workflow task.
      // Our query vector points along the first dimension [1, 0, 0...]
      const queryVector = Array(1536).fill(0)
      queryVector[0] = 1.0
      const mockExecuteWait = vi
        .spyOn(workflowService, 'executeWait')
        .mockImplementation(async (task) => {
          return {
            ...task,
            status: 'completed',
            output: {
              embedding: queryVector,
            },
          } as unknown as typeof task
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

      // 2nd: Chunk B1
      expect(result.data[1].id).toBe(videoAssetB.id)
      expect(result.data[1].startTime).toBe(5)
      expect(result.data[1].endTime).toBe(15)

      // 3rd: Chunk A2
      expect(result.data[2].id).toBe(videoAssetA.id)
      expect(result.data[2].startTime).toBe(10)
      expect(result.data[2].endTime).toBe(20)

      mockExecuteWait.mockRestore()
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
})
