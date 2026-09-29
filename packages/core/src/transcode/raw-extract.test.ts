import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import {
  extractEmbeddedJpeg,
  validateExtractedJpeg,
  extractAndValidateRawPreview,
  EXIF_ORIENTATION_TO_ROTATION,
} from './raw-extract'

// Mock exiftool-vendored
vi.mock('exiftool-vendored', () => ({
  exiftool: {
    extractBinaryTag: vi.fn(),
    read: vi.fn(),
  },
}))

// Mock sharp
vi.mock('sharp', () => {
  const mockMetadata = vi.fn()
  const mockSharp = vi.fn(() => ({
    metadata: mockMetadata,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mockSharp as any)._mockMetadata = mockMetadata
  return { default: mockSharp }
})

import { exiftool } from 'exiftool-vendored'
import sharp from 'sharp'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMetadata = (sharp as any)._mockMetadata as ReturnType<typeof vi.fn>
const mockExtractBinaryTag = vi.mocked(exiftool.extractBinaryTag)
const mockRead = vi.mocked(exiftool.read)

describe('extractEmbeddedJpeg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts from JpgFromRaw2 first to a temporary file', async () => {
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      fs.writeFileSync(dest, 'jpeg-data')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 1 } as never)

    const result = await extractEmbeddedJpeg('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(fs.existsSync(result!.previewPath)).toBe(true)
    expect(result!.orientation).toBe(1)
    expect(mockExtractBinaryTag).toHaveBeenCalledWith(
      'JpgFromRaw2',
      '/path/to/photo.cr2',
      expect.stringContaining('preview-JpgFromRaw2'),
    )

    // Test cleanup
    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('falls back to JpgFromRaw when JpgFromRaw2 fails', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('0 output files created'))
      .mockImplementationOnce(async (_tag, _src, dest) => {
        fs.writeFileSync(dest, 'jpeg-data')
      })
    mockRead.mockResolvedValueOnce({ Orientation: 6 } as never)

    const result = await extractEmbeddedJpeg('/path/to/photo.nef')

    expect(result).not.toBeNull()
    expect(fs.existsSync(result!.previewPath)).toBe(true)
    expect(result!.orientation).toBe(6)
    expect(mockExtractBinaryTag).toHaveBeenCalledTimes(2)
    expect(mockExtractBinaryTag).toHaveBeenNthCalledWith(
      2,
      'JpgFromRaw',
      '/path/to/photo.nef',
      expect.stringContaining('preview-JpgFromRaw'),
    )

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('falls back to PreviewImage when JpgFromRaw2 and JpgFromRaw fail', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('0 output files created'))
      .mockRejectedValueOnce(new Error('0 output files created'))
      .mockImplementationOnce(async (_tag, _src, dest) => {
        fs.writeFileSync(dest, 'preview-data')
      })
    mockRead.mockResolvedValueOnce({ Orientation: 3 } as never)

    const result = await extractEmbeddedJpeg('/path/to/photo.arw')

    expect(result).not.toBeNull()
    expect(fs.existsSync(result!.previewPath)).toBe(true)
    expect(result!.orientation).toBe(3)
    expect(mockExtractBinaryTag).toHaveBeenCalledTimes(3)
    expect(mockExtractBinaryTag).toHaveBeenNthCalledWith(
      3,
      'PreviewImage',
      '/path/to/photo.arw',
      expect.stringContaining('preview-PreviewImage'),
    )

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('returns null and cleans up when all tags fail', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('0 output files created'))
      .mockRejectedValueOnce(new Error('0 output files created'))
      .mockRejectedValueOnce(new Error('0 output files created'))

    const result = await extractEmbeddedJpeg('/path/to/photo.cr2')

    expect(result).toBeNull()
    expect(mockExtractBinaryTag).toHaveBeenCalledTimes(3)
  })

  it('returns undefined orientation when EXIF read fails', async () => {
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      fs.writeFileSync(dest, 'jpeg-data')
    })
    mockRead.mockRejectedValueOnce(new Error('EXIF read failed'))

    const result = await extractEmbeddedJpeg('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(result!.orientation).toBeUndefined()
    result!.cleanup()
  })

  it('returns undefined orientation when orientation value is out of range', async () => {
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      fs.writeFileSync(dest, 'jpeg-data')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 9 } as never)

    const result = await extractEmbeddedJpeg('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(result!.orientation).toBeUndefined()
    result!.cleanup()
  })

  it('returns undefined orientation when orientation is not a number', async () => {
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      fs.writeFileSync(dest, 'jpeg-data')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 'Horizontal' } as never)

    const result = await extractEmbeddedJpeg('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(result!.orientation).toBeUndefined()
    result!.cleanup()
  })
})

describe('validateExtractedJpeg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns dimensions for a valid JPEG file', async () => {
    mockMetadata.mockResolvedValueOnce({ width: 6000, height: 4000 })

    const result = await validateExtractedJpeg('/tmp/valid-jpeg.jpg')

    expect(result).toEqual({ width: 6000, height: 4000 })
  })

  it('returns null when metadata has zero width', async () => {
    mockMetadata.mockResolvedValueOnce({ width: 0, height: 4000 })

    const result = await validateExtractedJpeg('/tmp/bad-jpeg.jpg')

    expect(result).toBeNull()
  })

  it('returns null when metadata has no dimensions', async () => {
    mockMetadata.mockResolvedValueOnce({})

    const result = await validateExtractedJpeg('/tmp/bad-jpeg.jpg')

    expect(result).toBeNull()
  })

  it('returns null when sharp throws', async () => {
    mockMetadata.mockRejectedValueOnce(new Error('Invalid image'))

    const result = await validateExtractedJpeg('/tmp/corrupt-jpeg.jpg')

    expect(result).toBeNull()
  })
})

describe('extractAndValidateRawPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns previewPath, dimensions, orientation, and cleanup for valid RAW', async () => {
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      fs.writeFileSync(dest, 'jpeg-data')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 6 } as never)
    mockMetadata.mockResolvedValueOnce({ width: 4000, height: 3000 })

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(fs.existsSync(result!.previewPath)).toBe(true)
    expect(result!.width).toBe(4000)
    expect(result!.height).toBe(3000)
    expect(result!.orientation).toBe(6)

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('returns null when extraction fails', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).toBeNull()
  })

  it('returns null and cleans up when validation fails', async () => {
    let createdPath = ''
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      createdPath = dest
      fs.writeFileSync(dest, 'bad-jpeg')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 1 } as never)
    mockMetadata.mockRejectedValueOnce(new Error('Not a valid image'))

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).toBeNull()
    expect(fs.existsSync(createdPath)).toBe(false)
  })
})

describe('EXIF_ORIENTATION_TO_ROTATION', () => {
  it('maps all 8 EXIF orientations', () => {
    expect(Object.keys(EXIF_ORIENTATION_TO_ROTATION)).toHaveLength(8)
    for (let i = 1; i <= 8; i++) {
      expect(EXIF_ORIENTATION_TO_ROTATION[i]).toBeDefined()
    }
  })

  it('has correct rotation for landscape (1)', () => {
    expect(EXIF_ORIENTATION_TO_ROTATION[1]).toEqual({})
  })

  it('has correct rotation for 90° CW (6)', () => {
    expect(EXIF_ORIENTATION_TO_ROTATION[6]).toEqual({ angle: 90 })
  })

  it('has correct rotation for 180° (3)', () => {
    expect(EXIF_ORIENTATION_TO_ROTATION[3]).toEqual({ angle: 180 })
  })

  it('has correct rotation for 270° CW (8)', () => {
    expect(EXIF_ORIENTATION_TO_ROTATION[8]).toEqual({ angle: 270 })
  })

  it('has correct rotation for mirror horizontal (2)', () => {
    expect(EXIF_ORIENTATION_TO_ROTATION[2]).toEqual({ flop: true })
  })
})
