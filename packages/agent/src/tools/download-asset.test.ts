import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createDownloadAssetTool,
  resolveAssetIdFromKey,
  resolveS3MediaBuffer,
} from './download-asset'
import { prisma, type Asset, type StorageKey } from '@shumai/db'
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
      storageKey: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
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

  describe('Download by assetId', () => {
    it('should throw error if asset not found', async () => {
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

  describe('Download by S3 key and Authorization', () => {
    it('should reject keys that do not start with files/', async () => {
      const tool = createDownloadAssetTool('user-1')
      await expect(
        tool.execute('call-1', { assetId: null, key: 'avatars/user-1.png' }),
      ).rejects.toThrow('Invalid storage key format: key must start with "files/"')
    })

    it('should reject keys with path traversal (..)', async () => {
      const tool = createDownloadAssetTool('user-1')
      await expect(
        tool.execute('call-1', { assetId: null, key: 'files/../../etc/passwd' }),
      ).rejects.toThrow('cannot contain ".."')
    })

    it('should reject keys with insufficient path segments', async () => {
      const tool = createDownloadAssetTool('user-1')
      await expect(tool.execute('call-1', { assetId: null, key: 'files/invalid' })).rejects.toThrow(
        'Invalid storage key format',
      )
    })

    it('should reject keys that do not belong to any valid asset in database', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findUnique).mockResolvedValue(null)

      const tool = createDownloadAssetTool('user-1')
      await expect(
        tool.execute('call-1', { assetId: null, key: 'files/nonexistent-id/shot.webp' }),
      ).rejects.toThrow('does not belong to any valid asset or the asset has been deleted')
    })

    it('should reject download when user lacks read permission on the owning asset (cross-project protection)', async () => {
      // Key belongs to asset-in-other-project
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'asset-in-other-project',
      } as unknown as Asset)

      // Authz rejects because user is in a different project/team
      vi.mocked(authzService.hasPermission).mockRejectedValue(
        new Error('User does not have Read permission on asset asset-in-other-project'),
      )

      const tool = createDownloadAssetTool('user-1')
      await expect(
        tool.execute('call-1', {
          assetId: null,
          key: 'files/asset-in-other-project/screenshots/secret_frame.webp',
        }),
      ).rejects.toThrow('User does not have Read permission on asset asset-in-other-project')

      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: 'Read',
        type: 'asset',
        id: 'asset-in-other-project',
      })
      expect(s3Service.getObject).not.toHaveBeenCalled()
    })

    it('should authorize and download derived artifact key (files/<assetId>/...)', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: 'ast-123',
      } as unknown as Asset)
      vi.mocked(authzService.hasPermission).mockResolvedValue()

      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('fake-screenshot-bytes'),
        contentType: 'image/webp',
      } as unknown as { buffer: Buffer; contentType: string })

      const tool = createDownloadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: null,
        key: 'files/ast-123/screenshots/shot_5.0s.webp',
      })

      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: 'Read',
        type: 'asset',
        id: 'ast-123',
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
      expect(result.details.assetId).toBe('ast-123')
      expect(result.details.size).toBe(Buffer.from('fake-screenshot-bytes').length)
    })

    it('should authorize and download original upload key (files/<uploadUlid>/...) via StorageKey', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue({
        id: 'sk-1',
        key: 'files/upload-ulid-456/photo.png',
        assets: [{ id: 'asset-photo-1' }],
      } as unknown as StorageKey & { assets: Asset[] })
      vi.mocked(authzService.hasPermission).mockResolvedValue()

      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('fake-original-photo-bytes'),
        contentType: 'image/png',
      } as unknown as { buffer: Buffer; contentType: string })

      const tool = createDownloadAssetTool('user-1')
      const result = await tool.execute('call-1', {
        assetId: null,
        key: 'files/upload-ulid-456/photo.png',
      })

      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        permission: 'Read',
        type: 'asset',
        id: 'asset-photo-1',
      })

      expect(s3Service.getObject).toHaveBeenCalledWith('shumai', 'files/upload-ulid-456/photo.png')

      const expectedPath = path.join(piDir, 'photo.png')
      createdFiles.push(expectedPath)

      expect(fs.existsSync(expectedPath)).toBe(true)
      expect(result.details.assetId).toBe('asset-photo-1')
    })
  })

  describe('resolveAssetIdFromKey helper unit tests', () => {
    it('resolves directly by asset ID', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({ id: 'ast-999' } as unknown as Asset)
      const assetId = await resolveAssetIdFromKey('files/ast-999/pdf_pages/page_1.webp')
      expect(assetId).toBe('ast-999')
    })

    it('resolves via StorageKey prefix', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue({
        assets: [{ id: 'ast-888' }],
      } as unknown as StorageKey & { assets: Asset[] })
      const assetId = await resolveAssetIdFromKey('files/ulid-777/document.pdf')
      expect(assetId).toBe('ast-888')
    })

    it('resolves via exact StorageKey match', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.storageKey.findUnique).mockResolvedValue({
        assets: [{ id: 'ast-777' }],
      } as unknown as StorageKey & { assets: Asset[] })
      const assetId = await resolveAssetIdFromKey('files/ulid-special/document.pdf')
      expect(assetId).toBe('ast-777')
    })
  })

  describe('resolveS3MediaBuffer helper unit tests', () => {
    it('throws authorization error when userId is empty', async () => {
      await expect(resolveS3MediaBuffer('files/ast-1/img.png', '')).rejects.toThrow(
        'User ID is required for authorization.',
      )
    })

    it('verifies authz permission on owning asset and returns buffer with mimeType', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({ id: 'ast-1' } as unknown as Asset)
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('png-bytes'),
        contentType: 'image/png',
      } as unknown as { buffer: Buffer; contentType: string })

      const result = await resolveS3MediaBuffer('files/ast-1/image.png', 'user-123')
      expect(authzService.hasPermission).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        permission: 'Read',
        type: 'asset',
        id: 'ast-1',
      })
      expect(result.buffer.toString()).toBe('png-bytes')
      expect(result.mimeType).toBe('image/png')
    })

    it('throws error when S3 file is not an image', async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({ id: 'ast-1' } as unknown as Asset)
      vi.mocked(authzService.hasPermission).mockResolvedValue()
      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('some text'),
        contentType: 'text/plain',
      } as unknown as { buffer: Buffer; contentType: string })

      await expect(resolveS3MediaBuffer('files/ast-1/readme.txt', 'user-123')).rejects.toThrow(
        'has MIME type "text/plain", but an image is required.',
      )
    })
  })
})
