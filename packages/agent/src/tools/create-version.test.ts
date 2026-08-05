import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCreateVersionTool } from './create-version'
import { s3Service } from '@shumai/core/src/s3/s3'
import { executeAgentToolWorkflow } from './utils'
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

  it('should forward the optional context to the agent tool workflow when provided', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-version-context.md')

    const tool = createCreateVersionTool('user-1')
    await tool.execute('call-1', {
      parent: 'file-1',
      path: filePath,
      context: 'Generated using gemini',
    })

    expect(executeAgentToolWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({ context: 'Generated using gemini' }),
      }),
    )
  })

  it('should not include context in args when not provided', async () => {
    const filePath = createTempFile('# Hello from disk', 'create-version-no-context.md')

    const tool = createCreateVersionTool('user-1')
    await tool.execute('call-1', { parent: 'file-1', path: filePath })

    const callArgs = vi.mocked(executeAgentToolWorkflow).mock.calls[0][0].args
    expect(callArgs).not.toHaveProperty('context')
  })

  it('should throw when the local file does not exist', async () => {
    const tool = createCreateVersionTool('user-1')
    await expect(
      tool.execute('call-1', { parent: 'file-1', path: '/nonexistent/file.md' }),
    ).rejects.toThrow('Local file not found at path: /nonexistent/file.md')
    expect(s3Service.uploadFileToKey).not.toHaveBeenCalled()
    expect(executeAgentToolWorkflow).not.toHaveBeenCalled()
  })
})
