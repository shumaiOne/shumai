import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveAssetIdFromKey, resolveS3MediaBuffer } from './download-asset'
import { prisma, type Asset, type StorageKey } from '@shumai/db'
import { s3Service } from '@shumai/core/src/s3/s3'
import { authzService } from '@shumai/core/src/authz/authz'

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
    headObject: vi.fn(),
    downloadToFile: vi.fn(),
  },
}))

vi.mock('@shumai/core/src/authz/authz', () => ({
  authzService: {
    hasPermission: vi.fn(),
  },
  Permission: { Read: 'Read' },
  ResourceType: { Asset: 'asset' },
}))

describe('download-asset storage key helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
