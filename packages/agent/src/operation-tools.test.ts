import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Value } from 'typebox/value'
import { validateToolArguments } from '@earendil-works/pi-ai'
import { type AgentTool } from '@earendil-works/pi-agent-core'
import { AuditAction, type AssetInfo, type ProjectInfo } from '@shumai/dtos'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { projectService } from '@shumai/core/src/project/project'
import { buildOperationTools } from './operation-tools'

const ctx = { userId: 'user-1', agentId: 'agent-1', teamId: 'team-1', projectId: 'proj-1' }

function assetInfo(overrides: Partial<AssetInfo>): AssetInfo {
  return {
    id: 'asset-1',
    name: 'Asset',
    sizeByte: 0,
    fileCount: 0,
    type: 'file',
    status: 'uploaded',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectId: 'proj-1',
    ...overrides,
  }
}

function getTool(name: string): AgentTool {
  const tool = buildOperationTools(ctx).find((t) => t.name === name)
  if (!tool) throw new Error(`tool ${name} not built`)
  return tool
}

async function run(name: string, params: Record<string, unknown>) {
  const result = await getTool(name).execute('call-1', params as never)
  return { result, output: JSON.parse((result.content[0] as { text: string }).text) as unknown }
}

function editCheck(id: string) {
  return {
    user: { id: 'user-1' },
    permission: Permission.Edit,
    type: ResourceType.Asset,
    id,
  }
}

describe('operation-backed agent tools', () => {
  beforeEach(() => {
    vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)
    vi.spyOn(auditLogService, 'logAction').mockResolvedValue(null)
    vi.spyOn(assetService, 'getAssetContext').mockResolvedValue({
      teamId: 'team-1',
      projectId: 'proj-1',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('tool definitions', () => {
    it('keeps the existing tool names and adds the newer Operations', () => {
      expect(
        buildOperationTools(ctx)
          .map((t) => t.name)
          .sort(),
      ).toEqual([
        'copy_assets',
        'create_comment',
        'create_file',
        'create_folder',
        'create_version',
        'create_version_stack',
        'delete_asset',
        'download_asset',
        'get_asset_render',
        'get_folder_instructions',
        'list_assets',
        'list_comments',
        'list_metadata_fields',
        'list_projects',
        'list_versions',
        'move_assets',
        'read_asset',
        'remove_version',
        'rename_asset',
        'resolve_comment',
        'search_assets',
        'update_asset_metadata',
      ])
    })

    it('does not give the agent complete_upload: its create tools finish uploads themselves', () => {
      expect(buildOperationTools(ctx).map((t) => t.name)).not.toContain('complete_upload')
    })

    it('keeps the existing parameter names', () => {
      const params = (name: string) =>
        Object.keys((getTool(name).parameters as unknown as { properties: object }).properties)
      expect(params('create_folder')).toEqual(['parent', 'name'])
      expect(params('rename_asset')).toEqual(['assetId', 'name'])
      expect(params('move_assets')).toEqual(['assetIds', 'newParentId'])
      expect(params('delete_asset')).toEqual(['assetId'])
      expect(params('list_assets')).toEqual(['parent', 'type', 'first', 'after'])
    })

    it('exposes JSON Schema parameters the harness can validate', () => {
      const tool = getTool('move_assets')
      expect(tool.parameters).not.toHaveProperty('$schema')
      expect(Value.Check(tool.parameters, { assetIds: ['a'], newParentId: 'b' })).toBe(true)
      expect(Value.Check(tool.parameters, { assetIds: 'a', newParentId: 'b' })).toBe(false)
      const description = (
        tool.parameters as unknown as { properties: { assetIds: { description: string } } }
      ).properties.assetIds.description
      expect(description).toContain('same parent folder')
    })

    it('passes harness validation with null optional parameters', async () => {
      vi.spyOn(assetService, 'listChildren').mockResolvedValue({
        data: [],
        pageInfo: { total: 0 },
      })
      const tool = getTool('list_assets')
      const validated = validateToolArguments(
        { name: tool.name, description: '', parameters: tool.parameters } as Parameters<
          typeof validateToolArguments
        >[0],
        {
          type: 'toolCall',
          id: 'call-1',
          name: tool.name,
          arguments: { parent: 'folder-1' },
        } as Parameters<typeof validateToolArguments>[1],
      )
      await expect(tool.execute('call-1', validated as never)).resolves.toBeDefined()
    })
  })

  describe('list_assets', () => {
    beforeEach(() => {
      vi.spyOn(assetService, 'listChildren').mockResolvedValue({
        data: [
          assetInfo({ id: '01M2FILE2', name: 'file2.txt', sizeByte: 200 }),
          assetInfo({ id: '01M1FILE1', name: 'file1.txt', sizeByte: 100 }),
        ],
        pageInfo: { cursor: 'next-cursor', total: 5 },
      })
    })

    it('checks read permission and lists all types with the default page size', async () => {
      const { result, output } = await run('list_assets', { parent: 'folder-1' })

      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: Permission.Read,
        type: ResourceType.Asset,
        id: 'folder-1',
      })
      expect(assetService.listChildren).toHaveBeenCalledWith({
        assetId: 'folder-1',
        assetType: 'all',
        first: 20,
        after: undefined,
      })
      expect(result.details).toEqual({})
      expect(output).toEqual({
        data: [
          { id: '01M2FILE2', name: 'file2.txt', type: 'file', size: 200, projectId: 'proj-1' },
          { id: '01M1FILE1', name: 'file1.txt', type: 'file', size: 100, projectId: 'proj-1' },
        ],
        pageInfo: { hasNextPage: true, endCursor: 'next-cursor' },
        total: 5,
      })
    })

    it('passes cursor pagination and the type filter through', async () => {
      await run('list_assets', { parent: 'folder-1', first: 10, after: 'cur', type: 'folder' })

      expect(assetService.listChildren).toHaveBeenCalledWith({
        assetId: 'folder-1',
        assetType: 'folder',
        first: 10,
        after: 'cur',
      })
    })

    it('treats null optional parameters as omitted', async () => {
      await run('list_assets', { parent: 'folder-1', type: null, first: null, after: null })

      expect(assetService.listChildren).toHaveBeenCalledWith({
        assetId: 'folder-1',
        assetType: 'all',
        first: 20,
        after: undefined,
      })
    })

    it('rejects a null required parameter', async () => {
      await expect(run('list_assets', { parent: null })).rejects.toMatchObject({ status: 400 })
      expect(assetService.listChildren).not.toHaveBeenCalled()
    })
  })

  describe('create_folder', () => {
    beforeEach(() => {
      vi.spyOn(assetService, 'createAsset').mockResolvedValue(
        assetInfo({ id: 'folder-1', name: 'New Folder', type: 'folder' }),
      )
    })

    it('checks edit permission and creates a folder attributed to the user and agent', async () => {
      const { result, output } = await run('create_folder', {
        parent: 'root-folder',
        name: 'New Folder',
      })

      expect(authzService.hasPermission).toHaveBeenCalledWith(editCheck('root-folder'))
      expect(assetService.createAsset).toHaveBeenCalledWith({
        name: 'New Folder',
        parentId: 'root-folder',
        type: 'folder',
        creatorId: 'user-1',
        agentId: 'agent-1',
      })
      expect(result.details).toEqual({})
      expect(output).toEqual({
        id: 'folder-1',
        name: 'New Folder',
        type: 'folder',
        size: 0,
        projectId: 'proj-1',
      })
    })

    it('logs folder_create with the agent and via agent', async () => {
      await run('create_folder', { parent: 'root-folder', name: 'New Folder' })

      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.folder_create,
        teamId: 'team-1',
        userId: 'user-1',
        agentId: 'agent-1',
        projectId: 'proj-1',
        itemId: 'folder-1',
        via: 'agent',
      })
    })
  })

  describe('rename_asset', () => {
    it('checks edit permission and renames', async () => {
      vi.spyOn(assetService, 'updateAssetName').mockResolvedValue(
        assetInfo({ id: 'asset-1', name: 'Renamed Asset', sizeByte: 1024 }),
      )

      const { output } = await run('rename_asset', { assetId: 'asset-1', name: 'Renamed Asset' })

      expect(authzService.hasPermission).toHaveBeenCalledWith(editCheck('asset-1'))
      expect(assetService.updateAssetName).toHaveBeenCalledWith({
        id: 'asset-1',
        name: 'Renamed Asset',
      })
      expect(output).toEqual({
        id: 'asset-1',
        name: 'Renamed Asset',
        type: 'file',
        size: 1024,
        projectId: 'proj-1',
      })
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.file_update, itemId: 'asset-1' }),
      )
    })

    it('logs folder_update when renaming a folder', async () => {
      vi.spyOn(assetService, 'updateAssetName').mockResolvedValue(
        assetInfo({ id: 'folder-1', name: 'Renamed Folder', type: 'folder' }),
      )

      await run('rename_asset', { assetId: 'folder-1', name: 'Renamed Folder' })

      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: AuditAction.folder_update,
        teamId: 'team-1',
        userId: 'user-1',
        agentId: 'agent-1',
        projectId: 'proj-1',
        itemId: 'folder-1',
        via: 'agent',
      })
    })

    it('fails without renaming when the permission check rejects', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValueOnce(new Error('Permission denied'))
      const update = vi.spyOn(assetService, 'updateAssetName')

      await expect(run('rename_asset', { assetId: 'asset-1', name: 'New' })).rejects.toThrow(
        'Permission denied',
      )
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('move_assets', () => {
    beforeEach(() => {
      vi.spyOn(assetService, 'reparentAssets').mockResolvedValue(undefined)
    })

    it('checks permissions on the destination and every asset, then reparents', async () => {
      const { output } = await run('move_assets', {
        assetIds: ['asset-1', 'asset-2'],
        newParentId: 'folder-dest',
      })

      expect(vi.mocked(authzService.hasPermission).mock.calls.map(([req]) => req)).toEqual([
        editCheck('folder-dest'),
        editCheck('asset-1'),
        editCheck('asset-2'),
      ])
      expect(assetService.reparentAssets).toHaveBeenCalledWith({
        assetIds: ['asset-1', 'asset-2'],
        newParentId: 'folder-dest',
        creatorId: 'user-1',
      })
      expect(output).toEqual({ movedAssetIds: ['asset-1', 'asset-2'], newParentId: 'folder-dest' })
    })

    it('logs asset_reparent for each asset', async () => {
      await run('move_assets', { assetIds: ['asset-1', 'asset-2'], newParentId: 'folder-dest' })

      expect(assetService.getAssetContext).toHaveBeenCalledWith('folder-dest')
      expect(auditLogService.logAction).toHaveBeenCalledTimes(2)
      for (const itemId of ['asset-1', 'asset-2']) {
        expect(auditLogService.logAction).toHaveBeenCalledWith({
          action: AuditAction.asset_reparent,
          teamId: 'team-1',
          userId: 'user-1',
          agentId: 'agent-1',
          projectId: 'proj-1',
          itemId,
          via: 'agent',
        })
      }
    })

    it('fails without moving when the destination permission check rejects', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValueOnce(
        new Error('Access denied to destination'),
      )

      await expect(
        run('move_assets', { assetIds: ['asset-1'], newParentId: 'folder-dest' }),
      ).rejects.toThrow('Access denied to destination')
      expect(assetService.reparentAssets).not.toHaveBeenCalled()
    })
  })

  describe('delete_asset', () => {
    beforeEach(() => {
      vi.spyOn(assetService, 'deleteAssets').mockResolvedValue(undefined)
    })

    it.each([
      ['file', AuditAction.file_delete],
      ['folder', AuditAction.folder_delete],
    ] as const)('deletes a %s and logs %s', async (type, action) => {
      vi.spyOn(assetService, 'getAssetMeta').mockResolvedValue({
        id: 'asset-1',
        name: 'x',
        type,
        parentId: null,
        teamId: 'team-1',
        projectId: 'proj-1',
      })

      const { output } = await run('delete_asset', { assetId: 'asset-1' })

      expect(authzService.hasPermission).toHaveBeenCalledWith(editCheck('asset-1'))
      expect(assetService.deleteAssets).toHaveBeenCalledWith(['asset-1'])
      expect(output).toEqual({ deletedAssetId: 'asset-1' })
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action,
        teamId: 'team-1',
        userId: 'user-1',
        agentId: 'agent-1',
        projectId: 'proj-1',
        itemId: 'asset-1',
        via: 'agent',
      })
    })

    it('fails without deleting when the asset is not found', async () => {
      vi.spyOn(assetService, 'getAssetMeta').mockRejectedValue(new Error('Asset not found'))

      await expect(run('delete_asset', { assetId: 'missing' })).rejects.toThrow('Asset not found')
      expect(assetService.deleteAssets).not.toHaveBeenCalled()
    })

    it('fails without deleting when the permission check rejects', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValueOnce(new Error('Permission denied'))

      await expect(run('delete_asset', { assetId: 'asset-1' })).rejects.toThrow('Permission denied')
      expect(assetService.deleteAssets).not.toHaveBeenCalled()
    })
  })

  describe('list_projects', () => {
    it("lists the user's projects", async () => {
      const project: ProjectInfo = {
        id: 'proj-1',
        name: 'Project',
        teamId: 'team-1',
        rootFolder: 'root-1',
        enableNotification: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      vi.spyOn(projectService, 'getUserProjects').mockResolvedValue([project])

      const { output } = await run('list_projects', {})

      expect(projectService.getUserProjects).toHaveBeenCalledWith('user-1', 200)
      expect(output).toEqual({
        data: [{ id: 'proj-1', name: 'Project', teamId: 'team-1', rootFolderId: 'root-1' }],
      })
    })
  })
})
