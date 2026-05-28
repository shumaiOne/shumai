import { describe, expect, it, beforeEach } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { SearchService } from './search'
import { SearchConditionOperator } from '@/dtos/search'
import { metadataService } from '@/services/metadata/metadata'

import { AssetType } from '@/generated/prisma/client.ts'

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
        searchMode: 'name',
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
      searchMode: 'name',
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
      searchMode: 'name',
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
      searchMode: 'name',
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
      searchMode: 'name',
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
      searchMode: 'name',
    })
    expect(resultAsc.data[0].name).toBe('file1')
    expect(resultAsc.data[1].name).toBe('file2')

    const resultDesc = await searchService.search(rootFolder.id, {
      sort: { field: 'createdAt', order: 'desc' },
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      searchMode: 'name',
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
      searchMode: 'name',
    })
    expect(resultAsc.data[0].sizeByte).toBe(100)
    expect(resultAsc.data[1].sizeByte).toBe(200)

    const resultDesc = await searchService.search(rootFolder.id, {
      sort: { field: 'sizeByte', order: 'desc' },
      recursively: true,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      searchMode: 'name',
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
      searchMode: 'name',
    })
    expect(resultNormal.data.find((a) => a.id === symlink.id)).toBeUndefined()

    // Search with showSymlink
    const resultWithSymlink = await searchService.search(rootFolder.id, {
      recursively: false,
      assetType: 'file',
      operator: 'AND',
      conditions: [],
      showSymlink: true,
      searchMode: 'name',
    })
    expect(resultWithSymlink.data.find((a) => a.id === symlink.id)).toBeDefined()
  })
})
