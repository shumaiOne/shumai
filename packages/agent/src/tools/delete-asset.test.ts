import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDeleteAssetTool } from './delete-asset'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService } from '@shumai/core/src/authz/authz'
import { prisma } from '@shumai/db'
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
    deleteAssets: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@shumai/db', () => ({
  prisma: {
    asset: {
      findUnique: vi.fn(),
    },
  },
}))

describe('createDeleteAssetTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks edit permission, deletes asset, and returns success for a file', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      type: 'file',
      projectId: 'proj-1',
    } as unknown as never)

    const tool = createDeleteAssetTool('user-1')
    const result = await tool.execute('call-1', { assetId: 'asset-1' })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'asset-1',
    })

    expect(assetService.deleteAssets).toHaveBeenCalledWith(['asset-1'])
    expect(result.details).toEqual({})
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      success: true,
      deletedAssetId: 'asset-1',
    })
  })

  it('logs file_delete audit action when deleting a file with agentContext', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-1',
      type: 'file',
      projectId: 'proj-1',
    } as unknown as never)

    const tool = createDeleteAssetTool('user-1', { teamId: 'team-1', agentId: 'agent-1' })
    await tool.execute('call-1', { assetId: 'asset-1' })

    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.file_delete,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: 'proj-1',
      itemId: 'asset-1',
    })
  })

  it('logs folder_delete audit action when deleting a folder with agentContext', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'folder-1',
      type: 'folder',
      projectId: 'proj-1',
    } as unknown as never)

    const tool = createDeleteAssetTool('user-1', { teamId: 'team-1', agentId: 'agent-1' })
    await tool.execute('call-1', { assetId: 'folder-1' })

    expect(auditLogService.logAction).toHaveBeenCalledWith({
      action: AuditAction.folder_delete,
      teamId: 'team-1',
      userId: 'user-1',
      agentId: 'agent-1',
      projectId: 'proj-1',
      itemId: 'folder-1',
    })
  })

  it('throws when asset is not found', async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createDeleteAssetTool('user-1')
    await expect(tool.execute('call-1', { assetId: 'missing-asset' })).rejects.toThrow(
      'Asset not found',
    )
  })

  it('fails when permission check fails', async () => {
    vi.mocked(authzService.hasPermission).mockRejectedValueOnce(new Error('Permission denied'))
    const tool = createDeleteAssetTool('user-1')

    await expect(tool.execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'Permission denied',
    )
  })
})
