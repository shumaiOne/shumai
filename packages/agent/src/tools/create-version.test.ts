import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCreateVersionTool } from './create-version'
import { fieldsToTypeBoxSchema } from '../index'
import { s3Service } from '@shumai/core/src/s3/s3'
import { executeAgentToolWorkflow } from './utils'
import { Value } from 'typebox/value'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    uploadFileToKey: vi.fn(),
  },
}))

vi.mock('./utils', () => ({
  executeAgentToolWorkflow: vi.fn().mockResolvedValue({ id: 'file-1', name: 'v2', type: 'file' }),
}))

describe('createCreateVersionTool', () => {
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

  it('should upload a local file and create a version via the agent tool workflow', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-version-test.md')

    const tool = createCreateVersionTool('user-1')
    const result = await tool.execute('call-1', { parent: 'file-1', path: filePath })

    expect(s3Service.uploadFileToKey).toHaveBeenCalledTimes(1)
    const uploadArgs = vi.mocked(s3Service.uploadFileToKey).mock.calls[0]
    const s3Key = uploadArgs[1]
    expect(s3Key).toMatch(/^files\/.+\.md$/)
    expect(uploadArgs[2]).toBe('text/markdown')

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith({
      toolName: 'create_version',
      args: {
        parent: 'file-1',
        s3Key,
        name: 'create-version-test.md',
        size: Buffer.byteLength('# Hello from disk', 'utf-8'),
        contentType: 'text/markdown',
      },
      userId: 'user-1',
      assetId: 'file-1',
    })

    expect(result.details).toEqual({ id: 'file-1', name: 'v2', type: 'file' })
  })

  it('should forward the metadata to the agent tool workflow when provided', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-version-metadata.md')
    const metadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
    ])

    const tool = createCreateVersionTool('user-1', metadataSchema)
    await tool.execute('call-1', {
      parent: 'file-1',
      path: filePath,
      metadata: { prompt: 'Generated using gemini' },
    })

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({ metadata: { prompt: 'Generated using gemini' } }),
      }),
    )
  })

  it('should forward select and selectMulti newOption metadata', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-version-new-option.md')
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

    const tool = createCreateVersionTool('user-1', metadataSchema)
    await tool.execute('call-1', {
      parent: 'file-1',
      path: filePath,
      metadata: {
        provider: { newOption: { value: 'Kling' } },
        tags: ['tag1', { newOption: { value: 'Tag 2' } }],
      },
    })

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          metadata: {
            provider: { newOption: { value: 'Kling' } },
            tags: ['tag1', { newOption: { value: 'Tag 2' } }],
          },
        }),
      }),
    )
  })

  it('should not include metadata in args when metadata is null', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-version-no-metadata.md')
    const metadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
    ])

    const tool = createCreateVersionTool('user-1', metadataSchema)
    await tool.execute('call-1', { parent: 'file-1', path: filePath, metadata: null })

    const callArgs = vi.mocked(executeAgentToolWorkflow).mock.calls[0][0].args
    expect(callArgs).not.toHaveProperty('metadata')
  })

  it('should throw when the local file does not exist', async () => {
    const tool = createCreateVersionTool('user-1')
    await expect(
      tool.execute('call-1', { parent: 'file-1', path: '/nonexistent/file.md' }),
    ).rejects.toThrow('Local file not found at path: /nonexistent/file.md')
    expect(s3Service.uploadFileToKey).not.toHaveBeenCalled()
    expect(executeAgentToolWorkflow).not.toHaveBeenCalled()
  })

  it('should expose a strict, all-required (nullable) metadata schema when fields are provided', () => {
    const metadataSchema = fieldsToTypeBoxSchema([
      { id: 'prompt', config: { name: 'Prompt', type: 'text' } },
      { id: 'toggle', config: { name: 'Active', type: 'toggle' } },
    ])

    const tool = createCreateVersionTool('user-1', metadataSchema)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    const meta = (tool.parameters as any).properties.metadata
    // `metadata` is a nullable union: [strict object, null]
    const metaObject = meta.anyOf[0]

    expect(meta).toBeDefined()
    expect(metaObject.required).toEqual(['prompt', 'toggle'])
    expect(metaObject.additionalProperties).toBe(false)
    expect(metaObject.properties.prompt.anyOf[0].type).toBe('string')
    expect(metaObject.properties.prompt.anyOf[1].type).toBe('null')
    expect(metaObject.properties.toggle.anyOf[0].type).toBe('boolean')

    expect(Value.Check(meta, { prompt: 'p', toggle: true })).toBe(true)
    expect(Value.Check(meta, { prompt: null, toggle: null })).toBe(true)
    expect(Value.Check(meta, { prompt: 'p', toggle: null, unknownKey: 'x' })).toBe(false)
  })

  it('should omit the metadata parameter when no schema is provided', () => {
    const tool = createCreateVersionTool('user-1')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting the runtime schema shape of the dynamically-built tool
    expect((tool.parameters as any).properties.metadata).toBeUndefined()
  })
})
