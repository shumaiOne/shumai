import { describe, expect, it, beforeEach, vi } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { SearchService } from './search'
import { AssetType, Prisma } from '@/generated/prisma/client.ts'

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
      // Mock count to return a rare count
      const countSpy = vi.spyOn(prisma.asset, 'count').mockResolvedValue(5)
      const findManySpy = vi.spyOn(prisma.asset, 'findMany').mockResolvedValue([])

      await searchService.search(rootId, {
        operator: 'AND',
        recursively: true,
        conditions: [{ field: 'name', operator: 'contains', value: 'rareterm' }],
      })

      // Check that findMany was called with nameNgram condition
      const findManyArgs = findManySpy.mock.calls[0][0] as Prisma.AssetFindManyArgs
      const where = findManyArgs.where as Prisma.AssetWhereInput
      expect(where).toHaveProperty('nameNgram')
      expect(where.nameNgram).toHaveProperty('hasEvery')

      countSpy.mockRestore()
      findManySpy.mockRestore()
    })

    it('should fallback to simple ILIKE when probe count is 10001 or more', async () => {
      // Mock count to return a common count for the probe, and again for the full count
      const countSpy = vi.spyOn(prisma.asset, 'count').mockResolvedValue(10001)
      const findManySpy = vi.spyOn(prisma.asset, 'findMany').mockResolvedValue([])

      await searchService.search(rootId, {
        operator: 'AND',
        recursively: true,
        conditions: [{ field: 'name', operator: 'contains', value: 'commonterm' }],
      })

      // Check that findMany was called WITHOUT nameNgram condition, and WITH name contains
      const findManyArgs = findManySpy.mock.calls[0][0] as Prisma.AssetFindManyArgs
      const where = findManyArgs.where as Prisma.AssetWhereInput
      expect(where).not.toHaveProperty('nameNgram')
      expect(where).toHaveProperty('name')
      expect(where.name).toHaveProperty('contains', 'commonterm')

      countSpy.mockRestore()
      findManySpy.mockRestore()
    })
  })
})
