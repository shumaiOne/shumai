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
    await expect(tool.execute('call-1', { assetId: 'asset-1', key: null })).rejects.toThrow(
      'User ID is required for authorization.',
    )
  })

  it('should throw error if both assetId and key are null', async () => {
    const tool = createDownloadAssetTool('user-1')
    await expect(tool.execute('call-1', { assetId: null, key: null })).rejects.toThrow(
      'Provide exactly one of "assetId" (to download a workspace asset) or "key" (to download a specific S3 storage key). Set the unused parameter to null.',
    )
  })

  it('should throw error if both assetId and key are provided', async () => {
    const tool = createDownloadAssetTool('user-1')
    await expect(
      tool.execute('call-1', { assetId: 'asset-1', key: 'files/path/file.png' }),
    ).rejects.toThrow(
      'Provide exactly one of "assetId" (to download a workspace asset) or "key" (to download a specific S3 storage key). Set the unused parameter to null.',
    )
  })

  it('should throw error if asset not found when downloading by assetId', async () => {
    vi.mocked(authzService.hasPermission).mockResolvedValue()
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)

    const tool = createDownloadAssetTool('user-1')
    await expect(tool.execute('call-1', { assetId: 'asset-1', key: null })).rejects.toThrow(
      'Asset with ID asset-1 not found.',
    )
  })

  it('should download proxy image to .pi directory when downloading by assetId', async () => {
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
    const result = await tool.execute('call-1', { assetId: 'asset-img-1', key: null })

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

  it('should download specific S3 storage key to .pi directory when key is provided', async () => {
    vi.mocked(s3Service.getObject).mockResolvedValue({
      buffer: Buffer.from('fake-screenshot-bytes'),
      contentType: 'image/webp',
    } as unknown as { buffer: Buffer; contentType: string })

    const tool = createDownloadAssetTool('user-1')
    const result = await tool.execute('call-1', {
      assetId: null,
      key: 'files/ast-123/screenshots/shot_5.0s.webp',
    })

    expect(s3Service.getObject).toHaveBeenCalledWith(
      'shumai',
      'files/ast-123/screenshots/shot_5.0s.webp',
    )

    const expectedPath = path.join(piDir, 'shot_5.0s.webp')
    createdFiles.push(expectedPath)

    expect(fs.existsSync(expectedPath)).toBe(true)
    expect(fs.readFileSync(expectedPath, 'utf-8')).toBe('fake-screenshot-bytes')

    expect(result.details.filePath).toBe(path.join('.pi', 'shot_5.0s.webp'))
    expect(result.details.key).toBe('files/ast-123/screenshots/shot_5.0s.webp')
    expect(result.details.size).toBe(Buffer.from('fake-screenshot-bytes').length)
    expect((result.content[0] as { type: 'text'; text: string }).text).toContain(
      'Downloaded storage key "files/ast-123/screenshots/shot_5.0s.webp"',
    )
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
    const result = await tool.execute('call-1', { assetId: 'stack-1', key: null })

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
