import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import {
  extractEmbeddedJpeg,
  validateExtractedJpeg,
  validateExtractedImage,
  decodeRawWithDcraw,
  extractAndValidateRawPreview,
  EXIF_ORIENTATION_TO_ROTATION,
  withTimeout,
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

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { exiftool } from 'exiftool-vendored'
import sharp from 'sharp'
import { execFile } from 'child_process'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMetadata = (sharp as any)._mockMetadata as ReturnType<typeof vi.fn>
const mockExtractBinaryTag = vi.mocked(exiftool.extractBinaryTag)
const mockRead = vi.mocked(exiftool.read)
const mockExecFile = vi.mocked(execFile)

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

  it('skips remaining tags and aborts early when extraction times out', async () => {
    const origEnv = process.env.EXIFTOOL_TIMEOUT_MS
    try {
      process.env.EXIFTOOL_TIMEOUT_MS = '20'
      // Hang on first tag
      mockExtractBinaryTag.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 300)),
      )

      const result = await extractEmbeddedJpeg('/path/to/photo.cr2')

      expect(result).toBeNull()
      // Crucial: should break immediately after the first timeout instead of trying remaining 2 tags
      expect(mockExtractBinaryTag).toHaveBeenCalledTimes(1)
    } finally {
      if (origEnv !== undefined) {
        process.env.EXIFTOOL_TIMEOUT_MS = origEnv
      } else {
        delete process.env.EXIFTOOL_TIMEOUT_MS
      }
    }
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

describe('validateExtractedImage', () => {
  it('is an alias for validateExtractedJpeg', () => {
    expect(validateExtractedImage).toBe(validateExtractedJpeg)
  })
})

describe('decodeRawWithDcraw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decodes RAW using camera white balance, sRGB, and TIFF output without -h when longest dimension <= 8192', async () => {
    mockRead.mockResolvedValueOnce({
      ImageWidth: 6000,
      ImageHeight: 4000,
      Orientation: 1,
    } as never)

    let executedArgs: string[] = []
    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      executedArgs = args as string[]
      const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(tiffDest, 'tiff-data')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(fs.existsSync(result!.previewPath)).toBe(true)
    expect(result!.orientation).toBeUndefined()
    expect(result!.rawWidth).toBe(6000)
    expect(result!.rawHeight).toBe(4000)

    expect(executedArgs).toContain('-w')
    expect(executedArgs).toContain('-o')
    expect(executedArgs).toContain('1')
    expect(executedArgs).toContain('-T')
    expect(executedArgs).toContain('-Z')
    expect(executedArgs).not.toContain('-h')
    expect(executedArgs[executedArgs.length - 1]).toBe('/path/to/photo.cr2')

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('enables half-size (-h) when longest dimension > 8192px and computes upright raw dimensions', async () => {
    mockRead.mockResolvedValueOnce({
      ImageWidth: 9504,
      ImageHeight: 6336,
      Orientation: 6,
    } as never)

    let executedArgs: string[] = []
    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      executedArgs = args as string[]
      const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(tiffDest, 'tiff-data')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.arw')

    expect(result).not.toBeNull()
    expect(executedArgs).toContain('-h')
    expect(result!.orientation).toBeUndefined()
    // For orientation 6 (90 CW), upright raw dimensions are swapped
    expect(result!.rawWidth).toBe(6336)
    expect(result!.rawHeight).toBe(9504)

    result!.cleanup()
  })

  it('omits -h when longest dimension is exactly 8192px', async () => {
    mockRead.mockResolvedValueOnce({
      ImageWidth: 8192,
      ImageHeight: 5464,
      Orientation: 1,
    } as never)

    let executedArgs: string[] = []
    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      executedArgs = args as string[]
      const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(tiffDest, 'tiff-data')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.nef')

    expect(result).not.toBeNull()
    expect(executedArgs).not.toContain('-h')
    result!.cleanup()
  })

  it('defaults to full size without -h when EXIF metadata cannot be read', async () => {
    mockRead.mockRejectedValueOnce(new Error('Exif read failure'))

    let executedArgs: string[] = []
    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      executedArgs = args as string[]
      const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(tiffDest, 'tiff-data')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.dng')

    expect(result).not.toBeNull()
    expect(executedArgs).not.toContain('-h')
    result!.cleanup()
  })

  it('defaults to full size without -h when EXIF metadata read times out', async () => {
    const origEnv = process.env.EXIFTOOL_TIMEOUT_MS
    try {
      process.env.EXIFTOOL_TIMEOUT_MS = '20'
      mockRead.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 300)))

      let executedArgs: string[] = []
      mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
        executedArgs = args as string[]
        const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
        fs.writeFileSync(tiffDest, 'tiff-data')
        const callback = typeof _opts === 'function' ? _opts : cb
        if (callback) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(callback as any)(null, { stdout: '', stderr: '' })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {} as any
      })

      const result = await decodeRawWithDcraw('/path/to/photo.dng')

      expect(result).not.toBeNull()
      expect(executedArgs).not.toContain('-h')
      result!.cleanup()
    } finally {
      if (origEnv !== undefined) {
        process.env.EXIFTOOL_TIMEOUT_MS = origEnv
      } else {
        delete process.env.EXIFTOOL_TIMEOUT_MS
      }
    }
  })

  it('returns null and cleans up when dcraw_emu exits with non-zero code', async () => {
    mockRead.mockResolvedValueOnce({ ImageWidth: 6000, ImageHeight: 4000 } as never)
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      const err = new Error('Command failed: dcraw_emu')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(err as any).code = 1
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(err)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.cr2')

    expect(result).toBeNull()
  })

  it('returns null and cleans up when dcraw_emu times out', async () => {
    mockRead.mockResolvedValueOnce({ ImageWidth: 6000, ImageHeight: 4000 } as never)
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      const err = new Error('Process timed out')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(err as any).code = 'ETIMEDOUT'
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(err)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.cr2')

    expect(result).toBeNull()
  })

  it('returns null and cleans up when dcraw_emu is not found (ENOENT)', async () => {
    mockRead.mockResolvedValueOnce({ ImageWidth: 6000, ImageHeight: 4000 } as never)
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      const err = new Error('spawn dcraw_emu ENOENT')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(err as any).code = 'ENOENT'
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(err)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.cr2')

    expect(result).toBeNull()
  })

  it('returns null and cleans up when output TIFF is missing or empty', async () => {
    mockRead.mockResolvedValueOnce({ ImageWidth: 6000, ImageHeight: 4000 } as never)
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await decodeRawWithDcraw('/path/to/photo.cr2')

    expect(result).toBeNull()
  })
})

describe('extractAndValidateRawPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns previewPath, dimensions, orientation, and cleanup for valid RAW using embedded JPEG first', async () => {
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      fs.writeFileSync(dest, 'jpeg-data')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 6, ImageWidth: 4000, ImageHeight: 3000 } as never)
    mockMetadata.mockResolvedValueOnce({ width: 4000, height: 3000 })

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(fs.existsSync(result!.previewPath)).toBe(true)
    expect(result!.width).toBe(4000)
    expect(result!.height).toBe(3000)
    expect(result!.orientation).toBe(6)
    expect(mockExecFile).not.toHaveBeenCalled()

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('falls back to dcraw_emu when embedded preview extraction fails', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    mockRead.mockResolvedValueOnce({
      ImageWidth: 6000,
      ImageHeight: 4000,
      Orientation: 1,
    } as never)

    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(tiffDest, 'tiff-data')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    mockMetadata.mockResolvedValueOnce({ width: 6000, height: 4000 })

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(mockExecFile).toHaveBeenCalled()
    expect(result!.width).toBe(6000)
    expect(result!.height).toBe(4000)
    expect(result!.rawWidth).toBe(6000)
    expect(result!.rawHeight).toBe(4000)
    expect(result!.orientation).toBeUndefined()

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('falls back to dcraw_emu when extracted embedded JPEG is corrupt', async () => {
    let createdJpegPath = ''
    mockExtractBinaryTag.mockImplementationOnce(async (_tag, _src, dest) => {
      createdJpegPath = dest
      fs.writeFileSync(dest, 'corrupt-jpeg')
    })
    mockRead.mockResolvedValueOnce({ Orientation: 1 } as never)
    mockMetadata.mockRejectedValueOnce(new Error('Not a valid image'))

    // Fallback dcraw_emu
    mockRead.mockResolvedValueOnce({ ImageWidth: 6000, ImageHeight: 4000 } as never)
    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(tiffDest, 'tiff-data')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })
    mockMetadata.mockResolvedValueOnce({ width: 6000, height: 4000 })

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).not.toBeNull()
    expect(fs.existsSync(createdJpegPath)).toBe(false) // Embedded jpeg was cleaned up
    expect(fs.existsSync(result!.previewPath)).toBe(true)

    result!.cleanup()
    expect(fs.existsSync(result!.previewPath)).toBe(false)
  })

  it('returns null when both embedded extraction and dcraw_emu fail', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    mockRead.mockRejectedValueOnce(new Error('fail'))
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(new Error('dcraw failed'))
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).toBeNull()
  })

  it('returns null and cleans up when decoded TIFF is corrupt', async () => {
    mockExtractBinaryTag
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    let createdTiff = ''
    mockRead.mockResolvedValueOnce({ ImageWidth: 6000, ImageHeight: 4000 } as never)
    mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
      createdTiff = (args as string[])[(args as string[]).indexOf('-Z') + 1]
      fs.writeFileSync(createdTiff, 'corrupt-tiff')
      const callback = typeof _opts === 'function' ? _opts : cb
      if (callback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(callback as any)(null, { stdout: '', stderr: '' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any
    })
    mockMetadata.mockRejectedValueOnce(new Error('Invalid TIFF'))

    const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

    expect(result).toBeNull()
    expect(fs.existsSync(createdTiff)).toBe(false)
  })

  it('falls back to dcraw_emu when embedded preview extraction times out', async () => {
    const origEnv = process.env.EXIFTOOL_TIMEOUT_MS
    try {
      process.env.EXIFTOOL_TIMEOUT_MS = '20'
      // Hang on extractBinaryTag
      mockExtractBinaryTag.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 300)),
      )

      mockRead.mockResolvedValueOnce({
        ImageWidth: 6000,
        ImageHeight: 4000,
        Orientation: 1,
      } as never)

      mockExecFile.mockImplementationOnce((_bin, args, _opts, cb) => {
        const tiffDest = (args as string[])[(args as string[]).indexOf('-Z') + 1]
        fs.writeFileSync(tiffDest, 'tiff-data')
        const callback = typeof _opts === 'function' ? _opts : cb
        if (callback) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(callback as any)(null, { stdout: '', stderr: '' })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {} as any
      })
      mockMetadata.mockResolvedValueOnce({ width: 6000, height: 4000 })

      const result = await extractAndValidateRawPreview('/path/to/photo.cr2')

      expect(result).not.toBeNull()
      expect(mockExecFile).toHaveBeenCalled()
      expect(result!.width).toBe(6000)
      expect(result!.height).toBe(4000)

      result!.cleanup()
    } finally {
      if (origEnv !== undefined) {
        process.env.EXIFTOOL_TIMEOUT_MS = origEnv
      } else {
        delete process.env.EXIFTOOL_TIMEOUT_MS
      }
    }
  })
})

describe('withTimeout', () => {
  it('resolves when promise settles before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000)
    expect(result).toBe('ok')
  })

  it('rejects with timeout error when promise exceeds timeout', async () => {
    const hanging = new Promise((resolve) => setTimeout(resolve, 500))
    await expect(withTimeout(hanging, 20, 'TestTask')).rejects.toThrow(
      'TestTask timed out after 20ms',
    )
  })

  it('propagates underlying promise rejection before timeout', async () => {
    const failing = Promise.reject(new Error('fail fast'))
    await expect(withTimeout(failing, 1000, 'TestTask')).rejects.toThrow('fail fast')
  })

  it('prevents unhandled rejection if promise rejects after timeout', async () => {
    const delayedReject = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('late error')), 40),
    )
    await expect(withTimeout(delayedReject, 10, 'TestTask')).rejects.toThrow(
      'TestTask timed out after 10ms',
    )
    await new Promise((resolve) => setTimeout(resolve, 60))
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
