import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCreateFolderTool } from './create-folder'
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
    createAsset: vi.fn().mockResolvedValue({
      id: 'folder-1',
      name: 'New Folder',
      type: 'folder',
      sizeByte: 0,
    }),
  },
}))

describe('createCreateFolderTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks edit permission and calls assetService.createAsset with folder type', async () => {
    const tool = createCreateFolderTool('user-1')
    const result = await tool.execute('call-1', { parent: 'root-folder', name: 'New Folder' })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'root-folder',
    })

    expect(assetService.createAsset).toHaveBeenCalledWith({
      name: 'New Folder',
      parentId: 'root-folder',
      type: 'folder',
      creatorId: 'user-1',
    })

    expect(result.details).toEqual({
      id: 'folder-1',
      name: 'New Folder',
      type: 'folder',
      size: 0,
    })
  })
})
