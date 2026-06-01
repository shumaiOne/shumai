import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { SearchService } from './search'
import { AssetType } from '@shumai/db'

describe('N-gram Search Integration', () => {
  setupTestDbHooks()

  let searchService: SearchService

  beforeEach(() => {
    searchService = new SearchService()
  })

  it('should automatically populate nameNgram on asset creation', async () => {
    const asset = await prisma.asset.create({
      data: {
        name: 'Apple Pie',
        type: AssetType.file,
        status: 'uploaded',
        sizeByte: 100,
      },
    })

    expect(asset.nameNgram).toContain('app')
    expect(asset.nameNgram).toContain('pie')
    expect(asset.nameNgram).toContain('ple')
  })

  it('should automatically update nameNgram on asset update', async () => {
    const asset = await prisma.asset.create({
      data: {
        name: 'Apple',
        type: AssetType.file,
        status: 'uploaded',
      },
    })

    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: { name: 'Banana' },
    })

    expect(updated.nameNgram).toContain('ban')
    expect(updated.nameNgram).not.toContain('app')
  })

  it('should find assets using n-gram search', async () => {
    const root = await prisma.asset.create({
      data: { name: 'root', type: AssetType.folder, status: 'uploaded' },
    })
    await prisma.asset.create({
      data: { name: '北京大学', type: AssetType.file, status: 'uploaded', parentId: root.id },
    })
    await prisma.asset.create({
      data: { name: '清华大学', type: AssetType.file, status: 'uploaded', parentId: root.id },
    })

    const result = await searchService.search(root.id, {
      operator: 'AND',
      recursively: true,
      isSemantic: false,
      conditions: [
        {
          field: 'name',
          operator: 'contains',
          value: '北京',
        },
      ],
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('北京大学')
  })

  it('should handle false positives correctly using the recheck', async () => {
    const root = await prisma.asset.create({
      data: { name: 'root', type: AssetType.folder, status: 'uploaded' },
    })
    await prisma.asset.create({
      data: { name: 'hello world', type: AssetType.file, status: 'uploaded', parentId: root.id },
    })
    await prisma.asset.create({
      data: { name: 'hellXello', type: AssetType.file, status: 'uploaded', parentId: root.id },
    })

    const result = await searchService.search(root.id, {
      operator: 'AND',
      recursively: true,
      isSemantic: false,
      conditions: [
        {
          field: 'name',
          operator: 'contains',
          value: 'hello',
        },
      ],
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('hello world')
  })

  describe('N-gram Search Matrix', () => {
    let rootId: string

    beforeEach(async () => {
      const root = await prisma.asset.create({
        data: { name: 'matrix-root', type: AssetType.folder, status: 'uploaded' },
      })
      rootId = root.id

      const names = [
        'apple.png',
        'banana_v2.mp4',
        '北京大学-最终版.docx',
        '清华大学-final.pdf',
        'project-2026-05-10',
        '123456789.txt',
        'hellXello',
        'hello world',
        'my-awesome-asset',
        '我的资源',
        'foo-bar',
        'foo bar',
      ]

      for (const name of names) {
        await prisma.asset.create({
          data: {
            name,
            type: AssetType.file,
            status: 'uploaded',
            parentId: rootId,
          },
        })
      }
    })

    it.each([
      { val: 'apple', expected: ['apple.png'] },
      { val: 'v2', expected: ['banana_v2.mp4'] },
      { val: '北京', expected: ['北京大学-最终版.docx'] },
      { val: '大学', expected: ['北京大学-最终版.docx', '清华大学-final.pdf'] },
      { val: 'final', expected: ['清华大学-final.pdf'] },
      { val: '2026', expected: ['project-2026-05-10'] },
      { val: 'hello', expected: ['hello world'] },
      { val: 'awesome', expected: ['my-awesome-asset'] },
      { val: '资源', expected: ['我的资源'] },
      { val: '123', expected: ['123456789.txt'] },
      { val: 'docx', expected: ['北京大学-最终版.docx'] },
      { val: 'none-match', expected: [] },
      // Hyphen/Space sensitivity tests
      { val: 'foo-bar', expected: ['foo-bar'] },
      { val: 'foo bar', expected: ['foo bar'] },
    ])('should match "$val" with names $expected', async ({ val, expected }) => {
      const result = await searchService.search(rootId, {
        operator: 'AND',
        recursively: true,
        isSemantic: false,
        conditions: [
          {
            field: 'name',
            operator: 'contains',
            value: val,
          },
        ],
      })

      const actualNames = result.data.map((a) => a.name).sort()
      expect(actualNames).toEqual(expected.sort())
    })
  })

  describe('Switching Search Probe Logic', () => {
    let rootId: string

    beforeEach(async () => {
      const root = await prisma.asset.create({
        data: { name: 'probe-root', type: AssetType.folder, status: 'uploaded' },
      })
      rootId = root.id
    })

    it('should use GIN index when probe count is less than 10001', async () => {
      const queries: string[] = []
      const mockPrisma = new Proxy(prisma, {
        get(target, prop) {
          if (prop === '$queryRaw') {
            return (prismaSql: unknown) => {
              const sqlStr = (prismaSql as { text?: string })?.text || ''
              if (sqlStr) {
                queries.push(sqlStr)
              }
              let result: { id: string }[] = []
              if (!sqlStr.includes('as "assetId"')) {
                // Probe query: return 5 matches
                result = Array(5).fill({ id: '1' })
              }
              const promise = Promise.resolve(result)
              Object.defineProperty(promise, Symbol.toStringTag, {
                value: 'PrismaPromise',
                configurable: true,
                writable: true,
              })
              return promise as unknown as ReturnType<typeof prisma.$queryRaw>
            }
          }
          const val = Reflect.get(target, prop)
          if (typeof val === 'function') {
            return val.bind(target)
          }
          return val
        },
      })

      const localSearchService = new SearchService(mockPrisma)

      await localSearchService.search(rootId, {
        operator: 'AND',
        recursively: true,
        isSemantic: false,
        conditions: [{ field: 'name', operator: 'contains', value: 'rareterm' }],
      })

      // Verify probe and main query were executed
      expect(queries).toHaveLength(2)
      // Check that main query used GIN index
      const mainQuery = queries.find((q) => q.includes('as "assetId"'))
      expect(mainQuery).toBeDefined()
      expect(mainQuery).toContain('name_ngram @>')
      expect(mainQuery).toContain('name ILIKE')
    })

    it('should fallback to simple ILIKE when probe count is 10001 or more', async () => {
      const queries: string[] = []
      const mockPrisma = new Proxy(prisma, {
        get(target, prop) {
          if (prop === '$queryRaw') {
            return (prismaSql: unknown) => {
              const sqlStr = (prismaSql as { text?: string })?.text || ''
              if (sqlStr) {
                queries.push(sqlStr)
              }
              let result: { id: string }[] = []
              if (!sqlStr.includes('as "assetId"')) {
                // Probe query: return 10001 matches
                result = Array(10001).fill({ id: '1' })
              }
              const promise = Promise.resolve(result)
              Object.defineProperty(promise, Symbol.toStringTag, {
                value: 'PrismaPromise',
                configurable: true,
                writable: true,
              })
              return promise as unknown as ReturnType<typeof prisma.$queryRaw>
            }
          }
          const val = Reflect.get(target, prop)
          if (typeof val === 'function') {
            return val.bind(target)
          }
          return val
        },
      })

      const localSearchService = new SearchService(mockPrisma)

      await localSearchService.search(rootId, {
        operator: 'AND',
        recursively: true,
        isSemantic: false,
        conditions: [{ field: 'name', operator: 'contains', value: 'commonterm' }],
      })

      // Verify probe and main query were executed
      expect(queries).toHaveLength(2)
      // Check that main query did NOT use GIN index but used ILIKE
      const mainQuery = queries.find((q) => q.includes('as "assetId"'))
      expect(mainQuery).toBeDefined()
      expect(mainQuery).not.toContain('name_ngram @>')
      expect(mainQuery).toContain('name ILIKE')
    })
  })
})
