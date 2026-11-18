import { validateToolArguments } from '@earendil-works/pi-ai'
import { invokeTool } from '@shumai/core/src/agent/tool-test-utils'
import { assetService } from '@shumai/core/src/asset/asset'
import { auditLogService } from '@shumai/core/src/auditLog/auditLog'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'
import { metadataService } from '@shumai/core/src/metadata/metadata'
import { getOperation } from '@shumai/core/src/operations'
import { runnerService } from '@shumai/core/src/runner'
import { s3Service } from '@shumai/core/src/s3/s3'
import { AuditAction, type AssetInfo } from '@shumai/dtos'
import { Value } from 'typebox/value'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fieldsToTypeBoxSchema } from '../index'
import { toAgentTool, type AgentToolOptions } from '../operation-tools'
import './upload'

const ctx = {
  userId: 'user-1',
  agentId: 'agent-1',
  teamId: 'team-1',
  projectId: 'proj-1',
  runnerId: null,
}
const bucket = process.env.S3_BUCKET || 'shumai'

function tool(name: 'create_file' | 'create_version', options: AgentToolOptions = {}) {
  return toAgentTool(getOperation(name)!, ctx, options)
}

function assetInfo(overrides: Partial<AssetInfo>): AssetInfo {
  return {
    id: 'file-1',
    name: 'test',
    sizeByte: 100,
    fileCount: 0,
    type: 'file',
    status: 'uploaded',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectId: 'proj-1',
    ...overrides,
  }
}

function outputOf(result: { content: unknown[] }) {
  return JSON.parse((result.content[0] as { text: string }).text) as unknown
}

const promptField = {
  field: {
    id: 'f1',
    key: 'prompt',
    scope: 'PROJECT',
    readOnly: false,
    description: '',
    config: { name: 'Prompt', type: 'text', autofillSource: 'CREATION_CONTEXT' },
  },
  visible: true,
}

describe('create_file and create_version agent tools', () => {
  beforeEach(() => {
    vi.spyOn(authzService, 'hasPermission').mockResolvedValue(undefined)
    vi.spyOn(auditLogService, 'logAction').mockResolvedValue(null)
    vi.spyOn(assetService, 'getAssetContext').mockResolvedValue({
      teamId: 'team-1',
      projectId: 'proj-1',
    })
    vi.spyOn(assetService, 'getAssetMeta').mockImplementation(async (id) => ({
      id,
      name: id,
      type: id.startsWith('folder') ? 'folder' : 'file',
      parentId: 'root',
      teamId: 'team-1',
      projectId: 'proj-1',
    }))
    vi.spyOn(assetService, 'findAssetByStorageKey').mockResolvedValue(null)
    vi.spyOn(assetService, 'createFile').mockResolvedValue(assetInfo({}))
    vi.spyOn(assetService, 'createVersion').mockResolvedValue(assetInfo({ name: 'v2' }))
    vi.spyOn(metadataService, 'listProjectFields').mockResolvedValue([promptField] as never)
    vi.spyOn(s3Service, 'presign').mockResolvedValue('https://storage.example/upload')
    vi.spyOn(s3Service, 'putObject').mockImplementation(async (_bucket, _key, body) => {
      if (body && typeof body === 'object' && Symbol.asyncIterator in body) {
        for await (const chunk of body as AsyncIterable<unknown>) void chunk
      }
    })
    vi.spyOn(s3Service, 'headObject').mockImplementation(async (_bucket, key) => ({
      key,
      size: 17,
      lastModified: new Date(),
      contentType: 'text/markdown',
      eTag: '',
    }))
    vi.spyOn(s3Service, 'getObject').mockResolvedValue({
      buffer: Buffer.from('# Generated content'),
      contentType: 'text/markdown',
    })
    vi.spyOn(runnerService, 'requireOnlineRunner').mockResolvedValue({
      id: 'runner-1',
      teamId: 'team-1',
      name: 'Local Mac Mini',
      keyPrefix: 'shm_rn_12345678',
      isDefault: true,
      status: 'connected',
      createdAt: '2026-11-14T00:00:00.000Z',
      updatedAt: '2026-11-14T00:00:00.000Z',
    })
    vi.spyOn(runnerService, 'statOnRunner').mockResolvedValue({
      type: 'file.stat.result',
      executionId: 'exec-stat-1',
      ok: true,
      exists: true,
      isFile: true,
      size: 17,
      mimeType: 'text/markdown',
    })
    vi.spyOn(runnerService, 'uploadFromRunner').mockResolvedValue({
      type: 'file.upload.result',
      executionId: 'exec-ul-1',
      ok: true,
      size: 17,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create_file', () => {
    it('uploads a file from the runner to storage and creates the file as the agent', async () => {
      const result = await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: '.pi/agent-create-file.md',
      } as never)

      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: Permission.Edit,
        type: ResourceType.Asset,
        id: 'folder-1',
      })
      expect(runnerService.requireOnlineRunner).toHaveBeenCalledWith('team-1', null)
      expect(runnerService.statOnRunner).toHaveBeenCalledWith(
        'runner-1',
        '.pi/agent-create-file.md',
      )
      expect(runnerService.uploadFromRunner).toHaveBeenCalledWith('runner-1', {
        srcPath: '.pi/agent-create-file.md',
        url: 'https://storage.example/upload',
        contentType: 'text/markdown',
      })

      expect(assetService.createFile).toHaveBeenCalledWith({
        parentId: 'folder-1',
        name: 'agent-create-file.md',
        key: expect.stringMatching(/^files\/.+\/agent-create-file\.md$/),
        sizeByte: 17,
        contentType: 'text/markdown',
        creatorId: 'user-1',
        agentId: 'agent-1',
        metadata: undefined,
      })
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.file_create,
          teamId: 'team-1',
          projectId: 'proj-1',
          userId: 'user-1',
          agentId: 'agent-1',
          itemId: 'file-1',
          via: 'agent',
        }),
      )
      expect(result.details).toEqual({})
      expect(outputOf(result)).toEqual({
        id: 'file-1',
        name: 'test',
        type: 'file',
        size: 100,
        projectId: 'proj-1',
      })
    })

    it('falls back to temporary S3 storage when no runner is configured for .pi/generated/', async () => {
      vi.mocked(runnerService.requireOnlineRunner).mockRejectedValueOnce(
        new Error('No Runner is configured for this team.'),
      )

      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: '.pi/generated/gen123/poster.png',
      } as never)

      expect(runnerService.statOnRunner).not.toHaveBeenCalled()
      expect(s3Service.getObject).toHaveBeenCalledWith(bucket, 'temp/generated/gen123/poster.png')
      expect(s3Service.putObject).toHaveBeenCalled()
      expect(assetService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'folder-1',
          name: 'poster.png',
        }),
      )
    })

    it('falls back to temporary S3 storage when .pi/generated/ file is not staged on the online runner', async () => {
      vi.mocked(runnerService.statOnRunner).mockResolvedValueOnce({
        type: 'file.stat.result',
        executionId: 'exec-stat-missing',
        ok: true,
        exists: false,
      })

      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: '.pi/generated/gen123/unstaged.png',
      } as never)

      expect(runnerService.statOnRunner).toHaveBeenCalledWith(
        'runner-1',
        '.pi/generated/gen123/unstaged.png',
      )
      expect(s3Service.getObject).toHaveBeenCalledWith(bucket, 'temp/generated/gen123/unstaged.png')
      expect(runnerService.uploadFromRunner).not.toHaveBeenCalled()
    })

    it('prefers uploading edited or newly created .pi/generated/ files from the runner over S3', async () => {
      vi.mocked(s3Service.headObject).mockImplementation(async (_bucket, key) => {
        if (key === 'temp/generated/gen123/edited.png') {
          throw new Error('NotFound')
        }
        return {
          key,
          size: 17,
          lastModified: new Date(),
          contentType: 'text/markdown',
          eTag: '',
        }
      })

      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: '.pi/generated/gen123/edited.png',
      } as never)

      expect(runnerService.statOnRunner).toHaveBeenCalledWith(
        'runner-1',
        '.pi/generated/gen123/edited.png',
      )
      expect(runnerService.uploadFromRunner).toHaveBeenCalledWith('runner-1', {
        srcPath: '.pi/generated/gen123/edited.png',
        url: 'https://storage.example/upload',
        contentType: 'text/markdown',
      })
      expect(s3Service.getObject).not.toHaveBeenCalled()
    })

    it('reads explicit temp/generated/ paths directly from S3 without touching the runner', async () => {
      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: 'temp/generated/gen123/direct.png',
      } as never)

      expect(runnerService.requireOnlineRunner).not.toHaveBeenCalled()
      expect(runnerService.statOnRunner).not.toHaveBeenCalled()
      expect(s3Service.getObject).toHaveBeenCalledWith(bucket, 'temp/generated/gen123/direct.png')
    })

    it('creates a text file from name and content', async () => {
      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        name: 'notes.md',
        content: '# Notes\n\nHello',
      } as never)

      const [, key, body, size, contentType] = vi.mocked(s3Service.putObject).mock.calls[0]
      expect(key).toMatch(/^files\/.+\/notes\.md$/)
      expect((body as Buffer).toString('utf-8')).toBe('# Notes\n\nHello')
      expect(size).toBe(Buffer.byteLength('# Notes\n\nHello'))
      expect(contentType).toBe('text/markdown')
      expect(assetService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'notes.md', contentType: 'text/markdown' }),
      )
    })

    it('defaults unknown extensions to text/plain when creating from content', async () => {
      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        name: 'script.ts',
        content: 'const x = 1',
      } as never)

      expect(vi.mocked(s3Service.putObject).mock.calls[0][4]).toBe('text/plain')
      expect(assetService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'text/plain' }),
      )
    })

    it('sanitizes the name', async () => {
      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        name: 'my/notes.md',
        content: 'hello',
      } as never)

      expect(vi.mocked(s3Service.putObject).mock.calls[0][1]).toContain('my_notes.md')
      expect(assetService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'my_notes.md' }),
      )
    })

    it('forwards Creation Context metadata, including new select options', async () => {
      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: '.pi/agent-create-file-meta.md',
        metadata: { prompt: { newOption: { value: 'Kling' } } },
      } as never)

      expect(assetService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { prompt: { newOption: { value: 'Kling' } } } }),
      )
    })

    it('treats null metadata as omitted', async () => {
      await invokeTool(tool('create_file'), 'call-1', {
        parent: 'folder-1',
        path: '.pi/agent-create-file-null.md',
        metadata: null,
      } as never)

      expect(vi.mocked(assetService.createFile).mock.calls[0][0].metadata).toBeUndefined()
    })

    it('rejects metadata keys that are not Creation Context fields before uploading', async () => {
      await expect(
        invokeTool(tool('create_file'), 'call-1', {
          parent: 'folder-1',
          path: '.pi/agent-create-file-bad-meta.md',
          metadata: { status: 'approved' },
        } as never),
      ).rejects.toThrow(/not allowed: status/)

      expect(runnerService.uploadFromRunner).not.toHaveBeenCalled()
      expect(assetService.createFile).not.toHaveBeenCalled()
    })

    it('rejects a call with neither or both of "path" and "content"', async () => {
      await expect(
        invokeTool(tool('create_file'), 'call-1', { parent: 'folder-1' } as never),
      ).rejects.toThrow('Provide exactly one of "path" (a local file) or "content" (with "name").')
      await expect(
        invokeTool(tool('create_file'), 'call-1', {
          parent: 'folder-1',
          path: '/some/file.md',
          name: 'notes.md',
          content: 'hello',
        } as never),
      ).rejects.toThrow('Provide exactly one of')
      expect(s3Service.putObject).not.toHaveBeenCalled()
    })

    it('requires a name with "content"', async () => {
      await expect(
        invokeTool(tool('create_file'), 'call-1', { parent: 'folder-1', content: 'x' } as never),
      ).rejects.toThrow('"name" is required')
    })

    it('fails when the file does not exist on the runner, without touching storage', async () => {
      vi.mocked(runnerService.statOnRunner).mockResolvedValue({
        type: 'file.stat.result',
        executionId: 'exec-stat-2',
        ok: true,
        exists: false,
      })
      await expect(
        invokeTool(tool('create_file'), 'call-1', {
          parent: 'folder-1',
          path: '.pi/nonexistent.md',
        } as never),
      ).rejects.toThrow('Local file not found at path: .pi/nonexistent.md')
      expect(runnerService.uploadFromRunner).not.toHaveBeenCalled()
      expect(assetService.createFile).not.toHaveBeenCalled()
    })

    it('does not write to storage when the user lacks Edit permission', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValue(
        new Error('User is not a member of the team'),
      )

      await expect(
        invokeTool(tool('create_file'), 'call-1', {
          parent: 'folder-1',
          path: '.pi/agent-create-file-denied.md',
        } as never),
      ).rejects.toThrow('User is not a member of the team')
      await expect(
        invokeTool(tool('create_file'), 'call-1', {
          parent: 'folder-1',
          name: 'notes.md',
          content: 'x',
        } as never),
      ).rejects.toThrow('User is not a member of the team')

      expect(s3Service.putObject).not.toHaveBeenCalled()
      expect(s3Service.presign).not.toHaveBeenCalled()
      expect(runnerService.uploadFromRunner).not.toHaveBeenCalled()
      expect(assetService.createFile).not.toHaveBeenCalled()
    })

    it('passes harness validation with only one source set', async () => {
      const t = tool('create_file')
      const validated = validateToolArguments(
        { name: t.name, description: '', parameters: t.parameters } as Parameters<
          typeof validateToolArguments
        >[0],
        {
          type: 'toolCall',
          id: 'call-1',
          name: t.name,
          arguments: { parent: 'folder-1', name: 'random.txt', content: 'hello' },
        } as Parameters<typeof validateToolArguments>[1],
      )

      await invokeTool(t, 'call-1', validated as never)
      expect(assetService.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'random.txt' }),
      )
    })

    it('shows the agent its own parameters', () => {
      const properties = Object.keys(
        (tool('create_file').parameters as unknown as { properties: object }).properties,
      )
      expect(properties.sort()).toEqual(['content', 'name', 'parent', 'path'])
    })
  })

  describe('create_version', () => {
    it('uploads a file from the runner and creates a version as the agent', async () => {
      const result = await invokeTool(tool('create_version'), 'call-1', {
        parent: 'file-1',
        path: '.pi/agent-create-version.md',
      } as never)

      expect(runnerService.uploadFromRunner).toHaveBeenCalledWith('runner-1', {
        srcPath: '.pi/agent-create-version.md',
        url: 'https://storage.example/upload',
        contentType: 'text/markdown',
      })
      expect(assetService.createVersion).toHaveBeenCalledWith({
        parentId: 'file-1',
        name: 'agent-create-version.md',
        key: expect.stringMatching(/^files\/.+\/agent-create-version\.md$/),
        sizeByte: 17,
        contentType: 'text/markdown',
        creatorId: 'user-1',
        agentId: 'agent-1',
        metadata: undefined,
      })
      expect(outputOf(result)).toMatchObject({ id: 'file-1', name: 'v2' })
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.file_create, agentId: 'agent-1' }),
      )
    })

    it('forwards Creation Context metadata', async () => {
      await invokeTool(tool('create_version'), 'call-1', {
        parent: 'file-1',
        path: '.pi/agent-create-version-meta.md',
        metadata: { prompt: 'Generated using gemini' },
      } as never)

      expect(assetService.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { prompt: 'Generated using gemini' } }),
      )
    })

    it('does not upload when the user lacks Edit permission', async () => {
      vi.mocked(authzService.hasPermission).mockRejectedValueOnce(
        new Error('User is not a member of the team'),
      )

      await expect(
        invokeTool(tool('create_version'), 'call-1', {
          parent: 'file-1',
          path: '.pi/agent-create-version-denied.md',
        } as never),
      ).rejects.toThrow('User is not a member of the team')
      expect(runnerService.uploadFromRunner).not.toHaveBeenCalled()
      expect(assetService.createVersion).not.toHaveBeenCalled()
    })

    it('fails when the local file does not exist', async () => {
      vi.mocked(runnerService.statOnRunner).mockResolvedValue({
        type: 'file.stat.result',
        executionId: 'exec-stat-3',
        ok: true,
        exists: false,
      })
      await expect(
        invokeTool(tool('create_version'), 'call-1', {
          parent: 'file-1',
          path: '.pi/nonexistent.md',
        } as never),
      ).rejects.toThrow('Local file not found at path: .pi/nonexistent.md')
      expect(runnerService.uploadFromRunner).not.toHaveBeenCalled()
    })

    it('shows the agent its own parameters', () => {
      const properties = Object.keys(
        (tool('create_version').parameters as unknown as { properties: object }).properties,
      )
      expect(properties.sort()).toEqual(['parent', 'path'])
    })
  })

  describe('Creation Context metadata parameter', () => {
    const creationMetadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
      {
        id: 'source',
        config: {
          name: 'Source',
          type: 'select',
          select: { options: [{ id: 'gemini', displayName: 'Gemini', color: '#ffffff' }] },
        },
      },
    ])

    it.each(['create_file', 'create_version'] as const)(
      '%s exposes the project schema as a strict, nullable metadata parameter',
      (name) => {
        const parameters = tool(name, { creationMetadataSchema }).parameters as unknown as {
          properties: { metadata: { anyOf: [{ required: string[] }, { type: string }] } }
        }
        const meta = parameters.properties.metadata
        expect(meta.anyOf[0].required).toEqual(['prompt', 'source'])
        expect(meta.anyOf[1].type).toBe('null')

        expect(Value.Check(meta, { prompt: 'hello', source: 'gemini' })).toBe(true)
        expect(Value.Check(meta, { prompt: null, source: null })).toBe(true)
        expect(Value.Check(meta, null)).toBe(true)
        expect(Value.Check(meta, { prompt: 'hello' })).toBe(false)
        expect(Value.Check(meta, { prompt: 'x', source: 'gemini', other: 1 })).toBe(false)
        expect(Value.Check(meta, { prompt: 'x', source: 'not-an-option' })).toBe(false)
      },
    )

    it('keeps null values inside metadata through harness validation', () => {
      const t = tool('create_file', {
        creationMetadataSchema: fieldsToTypeBoxSchema([
          { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
        ]),
      })
      const validated = validateToolArguments(
        { name: t.name, description: '', parameters: t.parameters } as Parameters<
          typeof validateToolArguments
        >[0],
        {
          type: 'toolCall',
          id: 'call-1',
          name: t.name,
          arguments: { parent: 'folder-1', name: 'a.md', content: 'x', metadata: { prompt: null } },
        } as Parameters<typeof validateToolArguments>[1],
      ) as { metadata?: unknown }

      expect(validated.metadata).toEqual({ prompt: null })
    })
  })
})
