import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCreateFileTool } from './create-file'
import { fieldsToTypeBoxSchema } from '../index'
import { s3Service } from '@shumai/core/src/s3/s3'
import { assetService } from '@shumai/core/src/asset/asset'
import { authzService } from '@shumai/core/src/authz/authz'
import { Value } from 'typebox/value'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    uploadFileToKey: vi.fn(),
    putObject: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn().mockResolvedValue(undefined),
  },
  Permission: { Edit: 'edit', Read: 'read' },
  ResourceType: { Asset: 'asset' },
}))

vi.mock('@shumai/core/src/asset/asset', () => ({
  assetService: {
    createFile: vi
      .fn()
      .mockResolvedValue({ id: 'file-1', name: 'test', type: 'file', sizeByte: 100 }),
  },
}))

describe('createCreateFileTool', () => {
  const createdFiles: string[] = []

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    for (const f of createdFiles) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f)
      }
    }
    createdFiles.length = 0
  })

  const createTempFile = (content: string | Buffer, filename: string): string => {
    const filePath = path.join(os.tmpdir(), filename)
    fs.writeFileSync(filePath, content)
    createdFiles.push(filePath)
    return filePath
  }

  it('should upload a local file when "path" is provided', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-file-test.md')

    const tool = createCreateFileTool('user-1')
    const result = await tool.execute('call-1', { parent: 'folder-1', path: filePath, data: null })

    expect(s3Service.uploadFileToKey).toHaveBeenCalledTimes(1)
    expect(s3Service.putObject).not.toHaveBeenCalled()

    const uploadArgs = vi.mocked(s3Service.uploadFileToKey).mock.calls[0]
    const s3Key = uploadArgs[1]
    expect(s3Key).toMatch(/^files\/.+\.md$/)
    expect(uploadArgs[2]).toBe('text/markdown')

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'edit',
      type: 'asset',
      id: 'folder-1',
    })

    expect(assetService.createFile).toHaveBeenCalledWith({
      parentId: 'folder-1',
      name: 'create-file-test.md',
      key: s3Key,
      sizeByte: Buffer.byteLength('# Hello from disk', 'utf-8'),
      contentType: 'text/markdown',
      creatorId: 'user-1',
      metadata: undefined,
    })

    expect(result.details).toEqual({})
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      id: 'file-1',
      name: 'test',
      type: 'file',
      size: 100,
    })
  })

  it('should forward the metadata to assetService.createFile when provided', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-file-metadata.md')
    const metadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
    ])

    const tool = createCreateFileTool('user-1', metadataSchema)
    await tool.execute('call-1', {
      parent: 'folder-1',
      path: filePath,
      data: null,
      metadata: { prompt: 'Generated using gemini' },
    })

    expect(assetService.createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { prompt: 'Generated using gemini' },
      }),
    )
  })

  it('should forward select and selectMulti newOption metadata', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-file-new-option.md')
    const metadataSchema = fieldsToTypeBoxSchema([
      {
        id: 'provider',
        config: {
          name: 'Provider',
          type: 'select',
          select: { options: [{ id: 'openai', displayName: 'OpenAI', color: '#f43f5e' }] },
        },
      },
      {
        id: 'tags',
        config: {
          name: 'Tags',
          type: 'selectMulti',
          selectMulti: { options: [{ id: 'tag1', displayName: 'Tag 1', color: '#3b82f6' }] },
        },
      },
    ])

    const tool = createCreateFileTool('user-1', metadataSchema)
    await tool.execute('call-1', {
      parent: 'folder-1',
      path: filePath,
      data: null,
      metadata: {
        provider: { newOption: { value: 'Kling' } },
        tags: ['tag1', { newOption: { value: 'Tag 2' } }],
      },
    })

    expect(assetService.createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          provider: { newOption: { value: 'Kling' } },
          tags: ['tag1', { newOption: { value: 'Tag 2' } }],
        },
      }),
    )
  })

  it('should not include metadata when metadata is null', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-file-no-metadata.md')
    const metadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
    ])

    const tool = createCreateFileTool('user-1', metadataSchema)
    await tool.execute('call-1', {
      parent: 'folder-1',
      path: filePath,
      data: null,
      metadata: null,
    })

    const callArgs = vi.mocked(assetService.createFile).mock.calls[0][0]
    expect(callArgs.metadata).toBeUndefined()
  })

  it('should throw when the local file does not exist', async () => {
    const tool = createCreateFileTool('user-1')
    await expect(
      tool.execute('call-1', { parent: 'folder-1', path: '/nonexistent/file.md', data: null }),
    ).rejects.toThrow('Local file not found at path: /nonexistent/file.md')
    expect(s3Service.uploadFileToKey).not.toHaveBeenCalled()
    expect(assetService.createFile).not.toHaveBeenCalled()
  })

  it('should create a file directly from name and content', async () => {
    const tool = createCreateFileTool('user-1')
    const result = await tool.execute('call-1', {
      parent: 'folder-1',
      path: null,
      data: { name: 'notes.md', content: '# Notes\n\nHello' },
    })

    expect(s3Service.putObject).toHaveBeenCalledTimes(1)
    expect(s3Service.uploadFileToKey).not.toHaveBeenCalled()

    const [bucket, s3Key, body, size, contentType] = vi.mocked(s3Service.putObject).mock
      .calls[0] as unknown as [string, string, Buffer, number, string]

    expect(bucket).toBe(process.env.S3_BUCKET || 'shumai')
    expect(s3Key).toMatch(/^files\/.+notes\.md$/)
    expect(body.toString('utf-8')).toBe('# Notes\n\nHello')
    expect(size).toBe(Buffer.byteLength('# Notes\n\nHello', 'utf-8'))
    expect(contentType).toBe('text/markdown')

    expect(assetService.createFile).toHaveBeenCalledWith({
      parentId: 'folder-1',
      name: 'notes.md',
      key: s3Key,
      sizeByte: Buffer.byteLength('# Notes\n\nHello', 'utf-8'),
      contentType: 'text/markdown',
      creatorId: 'user-1',
      metadata: undefined,
    })

    expect(result.details).toEqual({})
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      id: 'file-1',
      name: 'test',
      type: 'file',
      size: 100,
    })
  })

  it('should default unknown extensions to text/plain when creating from content', async () => {
    const tool = createCreateFileTool('user-1')
    await tool.execute('call-1', {
      parent: 'folder-1',
      path: null,
      data: { name: 'script.ts', content: 'const x = 1' },
    })

    const [, , , , contentType] = vi.mocked(s3Service.putObject).mock.calls[0] as unknown as [
      string,
      string,
      Buffer,
      number,
      string,
    ]
    expect(contentType).toBe('text/plain')
  })

  it('should sanitize the name when creating from content', async () => {
    const tool = createCreateFileTool('user-1')
    await tool.execute('call-1', {
      parent: 'folder-1',
      path: null,
      data: { name: 'my/notes.md', content: 'hello' },
    })

    const [, s3Key] = vi.mocked(s3Service.putObject).mock.calls[0] as unknown as [
      string,
      string,
      Buffer,
      number,
      string,
    ]
    expect(s3Key).toContain('my_notes.md')

    expect(assetService.createFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my_notes.md' }),
    )
  })

  it('should throw when neither "path" nor "data" is provided', async () => {
    const tool = createCreateFileTool('user-1')
    await expect(
      tool.execute('call-1', { parent: 'folder-1', path: null, data: null }),
    ).rejects.toThrow('Provide exactly one of "path" (a local file) or "data" (name and content).')
  })

  it('should throw when both "path" and "data" are provided', async () => {
    const tool = createCreateFileTool('user-1')
    await expect(
      tool.execute('call-1', {
        parent: 'folder-1',
        path: '/some/file.md',
        data: { name: 'notes.md', content: 'hello' },
      }),
    ).rejects.toThrow('Provide exactly one of "path" (a local file) or "data" (name and content).')
    expect(s3Service.uploadFileToKey).not.toHaveBeenCalled()
    expect(s3Service.putObject).not.toHaveBeenCalled()
    expect(assetService.createFile).not.toHaveBeenCalled()
  })

  it('should expose a strict, all-required (nullable) metadata schema when fields are provided', () => {
    const metadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
      {
        id: 'source',
        config: {
          name: 'Source',
          type: 'select',
          select: { options: [{ id: 'gemini', displayName: 'Gemini', color: '#ffffff' }] },
        },
      },
      { id: 'rating', config: { name: 'Rating', type: 'rating' } },
    ])

    const tool = createCreateFileTool('user-1', metadataSchema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    const meta = (tool.parameters as any).properties.metadata
    // `metadata` is a nullable union: [strict object, null]
    const metaObject = meta.anyOf[0]

    expect(meta).toBeDefined()
    expect(metaObject.required).toEqual(['prompt', 'source', 'rating'])
    expect(metaObject.additionalProperties).toBe(false)
    expect(metaObject.properties.prompt.anyOf[0].type).toBe('string')
    expect(metaObject.properties.prompt.anyOf[1].type).toBe('null')
    expect(metaObject.properties.source.anyOf[0].anyOf[0].enum).toEqual(['gemini'])
    expect(metaObject.properties.rating.anyOf[0].type).toBe('number')

    // Every field must be present (use null when unknown); unknown keys and bad enums are rejected
    expect(Value.Check(meta, { prompt: 'hello', source: 'gemini', rating: 5 })).toBe(true)
    expect(
      Value.Check(meta, {
        prompt: 'hello',
        source: { newOption: { value: 'kling' } },
        rating: 5,
      }),
    ).toBe(true)
    expect(Value.Check(meta, { prompt: null, source: null, rating: null })).toBe(true)
    expect(Value.Check(meta, { prompt: 'hello', source: null, rating: null })).toBe(true)
    expect(Value.Check(meta, { prompt: 'hello' })).toBe(false)
    expect(
      Value.Check(meta, { prompt: 'hello', source: 'gemini', rating: 5, unknownKey: 'x' }),
    ).toBe(false)
    expect(Value.Check(meta, { prompt: 'hello', source: 'not-an-option', rating: null })).toBe(
      false,
    )
  })

  it('should omit the metadata parameter when no schema is provided', () => {
    const tool = createCreateFileTool('user-1')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    expect((tool.parameters as any).properties.metadata).toBeUndefined()
  })
})
