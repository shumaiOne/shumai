import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDownloadAssetTool } from './download-asset'
import { prisma, type Asset } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { authzService } from '@shumai/core/src/authz/authz'
import * as fs from 'fs'
import * as path from 'path'

vi.mock('@shumai/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shumai/db')>()
  return {
    ...actual,
    prisma: {
      asset: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  }
})

vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    getObject: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: { Read: 'Read' },
  ResourceType: { Asset: 'asset' },
}))

describe('downloadAssetTool', () => {
  const piDir = path.join(process.cwd(), '.pi')
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

  it('should throw authorization error if user ID is empty', async () => {
    const tool = createDownloadAssetTool('')
    await expect(tool.execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'User ID is required for authorization.',
    )
  })

  it('should throw error if asset not found', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createDownloadAssetTool('user-1')
    await expect(tool.execute('call-1', { assetId: 'asset-1' })).rejects.toThrow(
      'Asset with ID asset-1 not found.',
    )
  })

  it('should download proxy image to .pi directory when imageTranscodes is present', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-img-1',
      name: 'sample_photo.jpg',
      storageKey: { key: 'raw/sample_photo.jpg' },
      media: {
        proxyType: 'image',
        imageTranscodes: [{ key: 'proxy/sample_photo.webp' }],
      },
    } as unknown as Asset)

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-proxy-image-bytes'),
      contentType: 'image/webp',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createDownloadAssetTool('user-1')
    const result = await tool.execute('call-1', { assetId: 'asset-img-1' })

    expect(authzService.hasPermission).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      permission: 'Read',
      type: 'asset',
      id: 'asset-img-1',
    })

    expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'proxy/sample_photo.webp')

    const expectedPath = path.join(piDir, 'asset-img-1_sample_photo.jpg')
    createdFiles.push(expectedPath)

    expect(fs.existsSync(expectedPath)).toBe(true)
    expect(fs.readFileSync(expectedPath, 'utf-8')).toBe('fake-proxy-image-bytes')

    expect(result.details.filePath).toBe(path.join('.pi', 'asset-img-1_sample_photo.jpg'))
    expect(result.details.contentType).toBe('image/webp')
    expect((result.content[0] as { type: 'text'; text: string }).text).toContain(
      'Remember to delete this temporary file when finished.',
    )
  })

  it('should download proxy video to .pi directory when videoTranscodes is present', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-vid-1',
      name: 'video_test.mov',
      storageKey: { key: 'raw/video_test.mov' },
      media: {
        proxyType: 'video',
        videoTranscodes: [{ key: 'proxy/video_test.mp4' }],
      },
    } as unknown as Asset)

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-video-bytes'),
      contentType: 'video/mp4',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createDownloadAssetTool('user-1')
    const result = await tool.execute('call-1', { assetId: 'asset-vid-1' })

    expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'proxy/video_test.mp4')

    const expectedPath = path.join(piDir, 'asset-vid-1_video_test.mov')
    createdFiles.push(expectedPath)

    expect(fs.existsSync(expectedPath)).toBe(true)
    expect(result.details.size).toBe(Buffer.from('fake-video-bytes').length)
  })

  it('should download original file to .pi directory even when pdfTranscode is present', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'asset-md-1',
      name: 'doc.md',
      storageKey: { key: 'raw/doc.md' },
      media: {
        proxyType: 'pdf',
        pdfTranscode: { key: 'proxy/doc.pdf' },
        original: { key: 'raw/doc.md' },
      },
    } as unknown as Asset)

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('# fake markdown bytes'),
      contentType: 'text/markdown',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createDownloadAssetTool('user-1')
    const result = await tool.execute('call-1', { assetId: 'asset-md-1' })

    expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'raw/doc.md')

    const expectedPath = path.join(piDir, 'asset-md-1_doc.md')
    createdFiles.push(expectedPath)

    expect(fs.existsSync(expectedPath)).toBe(true)
    expect(result.details.contentType).toBe('text/markdown')
  })

  it('should resolve version_stack asset to its latest version file', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      id: 'stack-1',
      name: '',
      type: 'version_stack',
      storageKey: null,
      media: null,
    } as unknown as Asset)

    vi.mocked(prisma.asset.findFirst).mockResolvedValue({
      id: 'file-ver-2',
      name: 'banana_pig.png',
      type: 'file',
      storageKey: { key: 'raw/banana_pig.png' },
      media: {
        proxyType: 'image',
        imageTranscodes: [{ key: 'proxy/banana_pig.webp' }],
      },
    } as unknown as Asset)

    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-version-bytes'),
      contentType: 'image/webp',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createDownloadAssetTool('user-1')
    const result = await tool.execute('call-1', { assetId: 'stack-1' })

    expect(prisma.asset.findFirst).toHaveBeenCalledWith({
      where: { parentId: 'stack-1', isDeleted: false },
      orderBy: { sortIndex: 'asc' },
      include: { storageKey: true },
    })

    expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'proxy/banana_pig.webp')

    const expectedPath = path.join(piDir, 'file-ver-2_banana_pig.png')
    createdFiles.push(expectedPath)

    expect(fs.existsSync(expectedPath)).toBe(true)
    expect(result.details.name).toBe('banana_pig.png')
  })
})
