import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureJpegInStorage, getJpegKeyForWebp, isWebpKey } from './preview-converter'
import { s3Service } from './s3'

vi.mock('./s3', () => ({
  s3Service: {
    getObject: vi.fn(),
    putObject: vi.fn(),
  },
}))

vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      jpeg: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('converted-jpeg-data')),
    })),
  }
})

describe('preview-converter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isWebpKey', () => {
    it('returns true for .webp files case-insensitively', () => {
      expect(isWebpKey('thumb.webp')).toBe(true)
      expect(isWebpKey('folder/IMAGE.WEBP')).toBe(true)
      expect(isWebpKey('a/b/c/file.WebP')).toBe(true)
    })

    it('returns false for non-webp files or empty inputs', () => {
      expect(isWebpKey('thumb.jpeg')).toBe(false)
      expect(isWebpKey('thumb.png')).toBe(false)
      expect(isWebpKey('')).toBe(false)
      expect(isWebpKey(null)).toBe(false)
      expect(isWebpKey(undefined)).toBe(false)
    })
  })

  describe('getJpegKeyForWebp', () => {
    it('replaces .webp extension with .jpeg', () => {
      expect(getJpegKeyForWebp('path/to/thumb.webp')).toBe('path/to/thumb.jpeg')
      expect(getJpegKeyForWebp('path/to/thumb.WEBP')).toBe('path/to/thumb.jpeg')
    })

    it('appends .jpeg if not ending with .webp', () => {
      expect(getJpegKeyForWebp('path/to/thumb')).toBe('path/to/thumb.jpeg')
    })
  })

  describe('ensureJpegInStorage', () => {
    it('converts webp to jpeg and puts it into storage', async () => {
      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.from('fake-webp-buffer'),
        contentType: 'image/webp',
      } as unknown as Awaited<ReturnType<typeof s3Service.getObject>>)
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined)

      await ensureJpegInStorage('my-bucket', 'path/thumb.webp', 'path/thumb.jpeg')

      expect(s3Service.getObject).toHaveBeenCalledWith('my-bucket', 'path/thumb.webp')
      expect(s3Service.putObject).toHaveBeenCalledWith(
        'my-bucket',
        'path/thumb.jpeg',
        Buffer.from('converted-jpeg-data'),
        19,
        'image/jpeg',
      )
    })

    it('throws error when object buffer is empty or missing', async () => {
      vi.mocked(s3Service.getObject).mockResolvedValue({
        buffer: Buffer.alloc(0),
      } as unknown as Awaited<ReturnType<typeof s3Service.getObject>>)

      await expect(
        ensureJpegInStorage('my-bucket', 'path/empty.webp', 'path/empty.jpeg'),
      ).rejects.toThrow('Empty or missing buffer')
    })

    it('deduplicates concurrent requests for the same image', async () => {
      let resolveGetObject: ((val: unknown) => void) | undefined
      const getObjectPromise = new Promise<unknown>((resolve) => {
        resolveGetObject = resolve
      })
      vi.mocked(s3Service.getObject).mockImplementation(
        () => getObjectPromise as ReturnType<typeof s3Service.getObject>,
      )
      vi.mocked(s3Service.putObject).mockResolvedValue(undefined)

      const p1 = ensureJpegInStorage('bucket', 'race.webp', 'race.jpeg')
      const p2 = ensureJpegInStorage('bucket', 'race.webp', 'race.jpeg')

      // Resolve the object fetch
      resolveGetObject!({
        buffer: Buffer.from('race-webp-buffer'),
      })

      await Promise.all([p1, p2])

      // Only one getObject and putObject should have occurred
      expect(s3Service.getObject).toHaveBeenCalledTimes(1)
      expect(s3Service.putObject).toHaveBeenCalledTimes(1)
    })
  })
})
