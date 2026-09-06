import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMoveAssetsTool } from './move-assets'
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
    reparentAssets: vi.fn().mockResolvedValue(undefined),
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

describe('createMoveAssetsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks permissions on destination and all assets, and calls reparentAssets', async () => {
    const tool = createMoveAssetsTool('user-1')
    const result = await tool.execute('call-1', {
      assetIds: ['asset-1', 'asset-2'],
      newParentId: 'folder-dest',
    })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'folder-dest',
    })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'asset-1',
    })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'asset-2',
    })

    expect(assetService.reparentAssets).toHaveBeenCalledWith({
      assetIds: ['asset-1', 'asset-2'],
      newParentId: 'folder-dest',
      creatorId: 'user-1',
    })

    expect(result.details).toEqual({})
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      success: true,
      movedAssetIds: ['asset-1', 'asset-2'],
      newParentId: 'folder-dest',
    })
  })

  it('logs asset_reparent for each asset when agentContext is provided', async () => {
    const tool = createMoveAssetsTool('user-1', { teamId: 'team-1', agentId: 'agent-1' })
    await tool.execute('call-1', {
      assetIds: ['asset-1', 'asset-2'],
      newParentId: 'folder-dest',
    })

    expect(auditLogService.logAction).toHaveBeenCalledTimes(2)
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.asset_reparent,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: 'proj-1',
      itemId: 'asset-1',
    })
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.asset_reparent,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: 'proj-1',
      itemId: 'asset-2',
    })
  })

  it('fails when permission check on target folder fails', async () => {
    vi.mocked(authzService.hasPermission).mockRejectedValueOnce(
      new Error('Access denied to destination'),
    )
    const tool = createMoveAssetsTool('user-1')

    await expect(
      tool.execute('call-1', {
        assetIds: ['asset-1'],
        newParentId: 'folder-dest',
      }),
    ).rejects.toThrow('Access denied to destination')
  })
})
