import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCreateFileTool } from './create-file'
import { s3Service } from '@shumai/core/src/s3/s3'
import { executeAgentToolWorkflow } from './utils'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    uploadFileToKey: vi.fn(),
    putObject: vi.fn(),
  },
}))

vi.mock('./utils', () => ({
  executeAgentToolWorkflow: vi.fn().mockResolvedValue({ id: 'file-1', name: 'test', type: 'file' }),
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
    const result = await tool.execute('call-1', { parent: 'folder-1', path: filePath })

    expect(s3Service.uploadFileToKey).toHaveBeenCalledTimes(1)
    expect(s3Service.putObject).not.toHaveBeenCalled()

    const uploadArgs = vi.mocked(s3Service.uploadFileToKey).mock.calls[0]
    const s3Key = uploadArgs[1]
    expect(s3Key).toMatch(/^files\/.+\.md$/)
    expect(uploadArgs[2]).toBe('text/markdown')

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith({
      toolName: 'create_file',
      args: {
        parent: 'folder-1',
        s3Key,
        name: 'create-file-test.md',
        size: Buffer.byteLength('# Hello from disk', 'utf-8'),
        contentType: 'text/markdown',
      },
      userId: 'user-1',
      assetId: 'folder-1',
    })

    expect(result.details).toEqual({ id: 'file-1', name: 'test', type: 'file' })
  })

  it('should throw when the local file does not exist', async () => {
    const tool = createCreateFileTool('user-1')
    await expect(
      tool.execute('call-1', { parent: 'folder-1', path: '/nonexistent/file.md' }),
    ).rejects.toThrow('Local file not found at path: /nonexistent/file.md')
    expect(s3Service.uploadFileToKey).not.toHaveBeenCalled()
    expect(executeAgentToolWorkflow).not.toHaveBeenCalled()
  })

  it('should create a file directly from name and content', async () => {
    const tool = createCreateFileTool('user-1')
    const result = await tool.execute('call-1', {
      parent: 'folder-1',
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

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith({
      toolName: 'create_file',
      args: {
        parent: 'folder-1',
        s3Key,
        name: 'notes.md',
        size: Buffer.byteLength('# Notes\n\nHello', 'utf-8'),
        contentType: 'text/markdown',
      },
      userId: 'user-1',
      assetId: 'folder-1',
    })

    expect(result.details).toEqual({ id: 'file-1', name: 'test', type: 'file' })
  })

  it('should default unknown extensions to text/plain when creating from content', async () => {
    const tool = createCreateFileTool('user-1')
    await tool.execute('call-1', {
      parent: 'folder-1',
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

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({ name: 'my_notes.md' }),
      }),
    )
  })

  it('should throw when neither "path" nor "data" is provided', async () => {
    const tool = createCreateFileTool('user-1')
    await expect(tool.execute('call-1', { parent: 'folder-1' })).rejects.toThrow(
      'Provide exactly one of "path" (a local file) or "data" (name and content).',
    )
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
    expect(executeAgentToolWorkflow).not.toHaveBeenCalled()
  })
})
