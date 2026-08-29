import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createListAssetsTool } from './list-assets'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService } from '@shumai/core/src/authz/authz'

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: { Edit: 'edit', Read: 'read' },
  ResourceType: { Asset: 'asset' },
}))

vi.mock('@shumai/core/src/asset/asset', () => ({
  assetService: {
    listChildren: vi.fn().mockResolvedValue({
      data: [
        { id: '01M2FILE2', name: 'file2.txt', type: 'file', sizeByte: 200 },
        { id: '01M1FILE1', name: 'file1.txt', type: 'file', sizeByte: 100 },
      ],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, cursor: 'abc' },
    }),
  },
}))

describe('createListAssetsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks read permissions and invokes assetService.listChildren with default all and id desc ordering', async () => {
    const tool = createListAssetsTool('user-1')
    const result = await tool.execute('call-1', { parent: 'folder-1' })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'read',
      type: 'asset',
      id: 'folder-1',
    })

    expect(assetService.listChildren).toHaveBeenCalledWith({
      assetId: 'folder-1',
      assetType: 'all',
      sort: 'createdAt',
      order: 'desc',
      first: 20,
      after: undefined,
    })

    expect(result.details).toEqual({
      assets: [
        { id: '01M2FILE2', name: 'file2.txt', type: 'file', size: 200 },
        { id: '01M1FILE1', name: 'file1.txt', type: 'file', size: 100 },
      ],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, cursor: 'abc' },
    })
  })

  it('passes explicit pagination and type filter options to assetService.listChildren', async () => {
    const tool = createListAssetsTool('user-1')
    await tool.execute('call-1', {
      parent: 'folder-1',
      page: 2,
      pageSize: 10,
      type: 'folder',
    })

    expect(assetService.listChildren).toHaveBeenCalledWith({
      assetId: 'folder-1',
      assetType: 'folder',
      sort: 'createdAt',
      order: 'desc',
      first: 10,
      after: expect.any(String),
    })
  })
})
