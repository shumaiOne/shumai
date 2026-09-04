import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCreateFolderTool } from './create-folder'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService } from '@shumai/core/src/authz/authz'
import { AuditAction } from '@shumai/dtos'

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

vi.mock('@shumai/core/src/auditLog/auditLog', () => ({
  auditLogService: {
    logAction: vi.fn().mockResolvedValue(undefined),
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
      agentId: undefined,
    })

    expect(result.details).toEqual({})
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      id: 'folder-1',
      name: 'New Folder',
      type: 'folder',
      size: 0,
    })
  })

  it('passes agentId and logs audit action when agentContext is provided', async () => {
    const tool = createCreateFolderTool('user-1', { teamId: 'team-1', agentId: 'agent-1' })
    await tool.execute('call-1', { parent: 'root-folder', name: 'New Folder' })

    expect(assetService.createAsset).toHaveBeenCalledWith({
      name: 'New Folder',
      parentId: 'root-folder',
      type: 'folder',
      creatorId: 'user-1',
      agentId: 'agent-1',
    })

    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.folder_create,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: undefined,
      itemId: 'folder-1',
    })
  })
})
