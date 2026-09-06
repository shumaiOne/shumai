import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRenameAssetTool } from './rename-asset'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService } from '@shumai/core/src/authz/authz'
import { AuditAction, type AssetInfo } from '@shumai/dtos'

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: { Edit: 'edit', Read: 'read' },
  ResourceType: { Asset: 'asset' },
}))

vi.mock('@shumai/core/src/asset/asset', () => ({
  assetService: {
    updateAssetName: vi.fn().mockResolvedValue({
      id: 'asset-1',
      name: 'Renamed Asset',
      type: 'file',
      sizeByte: 1024,
      projectId: 'proj-1',
    }),
    getAssetContext: vi.fn().mockResolvedValue({
      teamId: 'team-1',
      projectId: 'proj-1',
    }),
  },
}))

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('createRenameAssetTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks edit permission and calls assetService.updateAssetName', async () => {
    const tool = createRenameAssetTool('user-1')
    const result = await tool.execute('call-1', { assetId: 'asset-1', name: 'Renamed Asset' })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'asset-1',
    })

    expect(assetService.updateAssetName).toHaveBeenCalledWith({
      id: 'asset-1',
      name: 'Renamed Asset',
    })

    expect(result.details).toEqual({})
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      id: 'asset-1',
      name: 'Renamed Asset',
      type: 'file',
      size: 1024,
    })
  })

  it('logs file_update audit action when renaming a file with agentContext', async () => {
    const tool = createRenameAssetTool('user-1', { teamId: 'team-1', agentId: 'agent-1' })
    await tool.execute('call-1', { assetId: 'asset-1', name: 'Renamed File' })

    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.file_update,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: 'proj-1',
      itemId: 'asset-1',
    })
  })

  it('logs folder_update audit action when renaming a folder with agentContext', async () => {
    vi.mocked(assetService.updateAssetName).mockResolvedValueOnce({
      id: 'folder-1',
      name: 'Renamed Folder',
      type: 'folder',
      sizeByte: 0,
      projectId: 'proj-1',
    } as unknown as AssetInfo)

    const tool = createRenameAssetTool('user-1', { teamId: 'team-1', agentId: 'agent-1' })
    await tool.execute('call-1', { assetId: 'folder-1', name: 'Renamed Folder' })

    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.folder_update,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: 'proj-1',
      itemId: 'folder-1',
    })
  })

  it('fails when permission check rejects', async () => {
    vi.mocked(authzService.hasPermission).mockRejectedValueOnce(new Error('Permission denied'))
    const tool = createRenameAssetTool('user-1')

    await expect(tool.execute('call-1', { assetId: 'asset-1', name: 'New' })).rejects.toThrow(
      'Permission denied',
    )
  })
})
