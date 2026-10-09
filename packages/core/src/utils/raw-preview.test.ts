import { describe, it, expect, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'
import {
  BufferSource,
  DEFAULT_RAW_PREVIEW_LIMITS,
  choosePreviewForSize,
  detectRawFormat,
  extractRawPreviewFromFile,
  findRawPreviews,
  extractRawPreviewFromBuffer,
  getRawImageSizeFromBuffer,
  getRawImageSizeFromFile,
  largestPreview,
  orientedSize,
  parseJpegDimensions,
  readJpegExifOrientation,
  type RawPreview,
  type RawPreviewResult,
} from './raw-preview'
import { TAG, fakeJpeg, fakeRaf, fakeTiff } from './raw-preview.test-helpers'

const src = (b: Buffer) => new BufferSource(b)

/** Sony-style layout: IFD0 is the full-size preview, IFD1 the thumbnail, sensor size declared. */
function sonyLikeArw(opts: { orientation?: number; bigEndian?: boolean } = {}) {
  const big = fakeJpeg(1500, 1000)
  const small = fakeJpeg(300, 200)
  const file = fakeTiff(
    [
      {
        entries: [
          { tag: TAG.imageWidth, type: 4, value: 6000 },
          { tag: TAG.imageHeight, type: 4, value: 4000 },
          { tag: TAG.orientation, type: 3, value: opts.orientation ?? 1 },
          { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
          { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
        ],
        next: 1,
      },
      {
        entries: [
          { tag: TAG.newSubfileType, type: 4, value: 1 },
          { tag: TAG.jpegIfOffset, type: 4, value: { blob: 1 } },
          { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 1 } },
        ],
        next: null,
      },
    ],
    [big, small],
    { bigEndian: opts.bigEndian },
  )
  return { file, big, small }
}

function preview(width: number, height: number, extra: Partial<RawPreview> = {}): RawPreview {
  return {
    offset: width * 7 + height,
    length: 5000,
    width,
    height,
    orientation: 1,
    fromTag: true,
    ...extra,
  }
}

function result(candidates: RawPreview[]): RawPreviewResult {
  return { format: 'tiff', candidates, rawWidth: 0, rawHeight: 0 }
}

describe('JPEG header parsing', () => {
  it('reads dimensions from the SOF marker', () => {
    const j = fakeJpeg(4416, 2944)
    expect(parseJpegDimensions(src(j), 0, j.length)).toEqual({ width: 4416, height: 2944 })
  })

  it('reads EXIF orientation from APP1', () => {
    const j = fakeJpeg(640, 480, { orientation: 6 })
    expect(readJpegExifOrientation(src(j), 0, j.length)).toBe(6)
    const plain = fakeJpeg(640, 480)
    expect(readJpegExifOrientation(src(plain), 0, plain.length)).toBeNull()
  })

  it('rejects data that is not a JPEG', () => {
    const junk = Buffer.alloc(4096, 0x41)
    expect(parseJpegDimensions(src(junk), 0, junk.length)).toBeNull()
  })

  it('parses a real JPEG written by sharp, including its orientation', async () => {
    const real = await sharp({
      create: { width: 120, height: 80, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .jpeg()
      .withMetadata({ orientation: 8 })
      .toBuffer()
    expect(parseJpegDimensions(src(real), 0, real.length)).toEqual({ width: 120, height: 80 })
    expect(readJpegExifOrientation(src(real), 0, real.length)).toBe(8)
  })
})

describe('detectRawFormat', () => {
  it('identifies the containers by magic bytes', () => {
    expect(detectRawFormat(src(fakeRaf(fakeJpeg(64, 64))))).toBe('raf')
    expect(detectRawFormat(src(sonyLikeArw().file))).toBe('tiff')
    expect(detectRawFormat(src(sonyLikeArw({ bigEndian: true }).file))).toBe('tiff')
    expect(detectRawFormat(src(fakeTiff([{ entries: [], next: null }], [], { magic: 43 })))).toBe(
      'bigtiff',
    )
  })

  it('returns unknown for garbage and for input shorter than a header', () => {
    expect(detectRawFormat(src(Buffer.alloc(4096, 0x13)))).toBe('unknown')
    expect(detectRawFormat(src(Buffer.from('II')))).toBe('unknown')
  })
})

describe('findRawPreviews', () => {
  it('finds a RAF preview through the header table and takes orientation from its EXIF', () => {
    const jpeg = fakeJpeg(4416, 2944, { orientation: 6 })
    const r = findRawPreviews(src(fakeRaf(jpeg)), 'DSCF5056.RAF')
    expect(r.format).toBe('raf')
    expect(r.error).toBeUndefined()
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0]).toMatchObject({
      offset: 0x100,
      length: jpeg.length,
      width: 4416,
      height: 2944,
      orientation: 6,
      fromTag: true,
    })
  })

  it('walks a TIFF IFD chain, reads the sensor size and applies the container orientation', () => {
    for (const bigEndian of [false, true]) {
      const r = findRawPreviews(src(sonyLikeArw({ orientation: 8, bigEndian }).file), 'a.ARW')
      expect(r.format).toBe('tiff')
      expect(r.rawWidth).toBe(6000)
      expect(r.rawHeight).toBe(4000)
      expect(r.candidates.map((c) => [c.width, c.height])).toEqual([
        [1500, 1000],
        [300, 200],
      ])
      expect(r.candidates.every((c) => c.orientation === 8)).toBe(true)
    }
  })

  it('finds a JPEG-compressed strip in a SubIFD (the DNG / NEF layout)', () => {
    const strip = fakeJpeg(1024, 683)
    const file = fakeTiff(
      [
        {
          entries: [
            { tag: TAG.imageWidth, type: 4, value: 6000 },
            { tag: TAG.imageHeight, type: 4, value: 4000 },
            { tag: TAG.subIfds, type: 13, value: { ifd: 1 } },
          ],
          next: null,
        },
        {
          entries: [
            { tag: TAG.newSubfileType, type: 4, value: 1 },
            { tag: TAG.compression, type: 3, value: 7 },
            { tag: TAG.stripOffsets, type: 4, value: { blob: 0 } },
            { tag: TAG.stripByteCounts, type: 4, value: { blobLen: 0 } },
          ],
          next: null,
        },
      ],
      [strip],
    )
    const r = findRawPreviews(src(file), 'a.dng')
    expect(r.candidates.map((c) => [c.width, c.height])).toEqual([[1024, 683]])
  })

  it('rejects a "preview" larger than the sensor it claims to preview', () => {
    const file = fakeTiff(
      [
        {
          entries: [
            { tag: TAG.imageWidth, type: 4, value: 600 },
            { tag: TAG.imageHeight, type: 4, value: 400 },
            { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
            { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
          ],
          next: null,
        },
      ],
      [fakeJpeg(6000, 4000)],
    )
    const r = findRawPreviews(src(file), 'a.ARW')
    expect(r.candidates).toHaveLength(0)
    expect(r.error).toMatch(/no valid embedded JPEG/)
  })

  it('terminates on an IFD cycle and still returns what it found', () => {
    const file = fakeTiff(
      [
        {
          entries: [
            { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
            { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
          ],
          next: 1,
        },
        { entries: [{ tag: TAG.newSubfileType, type: 4, value: 1 }], next: 0 },
      ],
      [fakeJpeg(1600, 1066)],
    )
    const r = findRawPreviews(src(file), 'a.ARW')
    expect(r.candidates.map((c) => c.width)).toEqual([1600])
  })

  it('refuses BigTIFF instead of misreading its 8-byte offsets', () => {
    const r = findRawPreviews(src(fakeTiff([{ entries: [], next: null }], [], { magic: 43 })))
    expect(r.format).toBe('bigtiff')
    expect(r.candidates).toHaveLength(0)
    expect(r.error).toMatch(/BigTIFF/)
  })

  it('returns an error, not an exception, for garbage and for out-of-range pointers', () => {
    expect(findRawPreviews(src(Buffer.alloc(8192, 0x5a))).error).toBeDefined()
    const broken = fakeRaf(fakeJpeg(800, 600))
    broken.writeUInt32BE(0x7fffffff, 0x54)
    expect(() => findRawPreviews(src(broken), 'x.RAF')).not.toThrow()
  })

  it('trims padding after the EOI that the declared length included', () => {
    const jpeg = fakeJpeg(1500, 1000)
    const padded = Buffer.concat([jpeg, Buffer.alloc(3000)])
    const file = fakeTiff(
      [
        {
          entries: [
            { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
            { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
          ],
          next: null,
        },
      ],
      [padded],
    )
    const r = findRawPreviews(src(file), 'a.ARW')
    expect(r.candidates[0].length).toBe(jpeg.length)
  })

  it('falls back to scanning for an SOI when no tag points at a preview', () => {
    const file = Buffer.concat([
      fakeTiff([{ entries: [{ tag: TAG.imageWidth, type: 4, value: 6000 }], next: null }], []),
      Buffer.alloc(100),
      fakeJpeg(1200, 800),
    ])
    const r = findRawPreviews(src(file), 'a.ARW')
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0].fromTag).toBe(false)
  })
})

describe('choosePreviewForSize', () => {
  const three = result([preview(6000, 4000), preview(1616, 1080), preview(160, 120)])

  it('picks the smallest on-aspect preview that still covers the target edge', () => {
    expect(choosePreviewForSize(three, 533)?.width).toBe(1616)
    expect(choosePreviewForSize(three, 1616)?.width).toBe(1616)
    expect(choosePreviewForSize(three, 1617)?.width).toBe(6000)
  })

  it('skips an off-aspect decoy even when it is the smallest sufficient size', () => {
    const r = result([preview(6000, 4000), preview(1616, 1080), preview(256, 256)])
    expect(choosePreviewForSize(r, 200)?.width).toBe(1616)
  })

  it('falls back to the largest on-aspect preview when none reaches the edge', () => {
    expect(choosePreviewForSize(three, 99999)?.width).toBe(6000)
    expect(largestPreview(three)?.width).toBe(6000)
  })

  it('returns null when there are no candidates', () => {
    expect(choosePreviewForSize(result([]), 300)).toBeNull()
  })
})

describe('orientedSize', () => {
  it('swaps width and height for the transposing orientations 5 to 8', () => {
    for (const o of [1, 2, 3, 4]) {
      expect(orientedSize(preview(300, 200, { orientation: o }))).toEqual({
        width: 300,
        height: 200,
      })
    }
    for (const o of [5, 6, 7, 8]) {
      expect(orientedSize(preview(300, 200, { orientation: o }))).toEqual({
        width: 200,
        height: 300,
      })
    }
  })
})

describe('file helpers', () => {
  const made: string[] = []
  const write = (name: string, data: Buffer) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-preview-test-'))
    made.push(dir)
    const p = path.join(dir, name)
    fs.writeFileSync(p, data)
    return p
  }
  afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true })
  })

  it('extracts exactly the chosen JPEG bytes from a RAF on disk', () => {
    const jpeg = fakeJpeg(4416, 2944, { orientation: 6 })
    const p = write('DSCF5056.RAF', fakeRaf(jpeg))
    const got = extractRawPreviewFromFile(p, 533)
    expect(got).not.toBeNull()
    expect(got!.jpeg.equals(jpeg)).toBe(true)
    expect(got).toMatchObject({ width: 4416, height: 2944, orientation: 6 })
  })

  it('reports the displayed (oriented) size of the largest preview', () => {
    const p = write('a.ARW', sonyLikeArw({ orientation: 6 }).file)
    expect(getRawImageSizeFromFile(p)).toEqual({ width: 1000, height: 1500 })
  })

  it('chooses the small preview for a thumbnail and the big one for full size', () => {
    const { file, big, small } = sonyLikeArw()
    const p = write('a.ARW', file)
    expect(extractRawPreviewFromFile(p, 300)!.jpeg.equals(small)).toBe(true)
    expect(extractRawPreviewFromFile(p, Infinity)!.jpeg.equals(big)).toBe(true)
  })

  it('returns null for a RAW with no usable preview', () => {
    const p = write(
      'a.ARW',
      fakeTiff([{ entries: [{ tag: TAG.imageWidth, type: 4, value: 6000 }], next: null }], []),
    )
    expect(extractRawPreviewFromFile(p, 300)).toBeNull()
    expect(getRawImageSizeFromFile(p)).toBeNull()
  })
})

describe('rendered size (the largest embedded preview, not the sensor size)', () => {
  /** Sony-style ARW whose IFD0 carries the padded raw buffer size, not the image size. */
  function arwWithPaddedRawSize(orientation = 1) {
    const big = fakeJpeg(1500, 1000)
    const file = fakeTiff(
      [
        {
          entries: [
            { tag: TAG.imageWidth, type: 4, value: 1792 },
            { tag: TAG.imageHeight, type: 4, value: 1280 },
            { tag: TAG.orientation, type: 3, value: orientation },
            { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
            { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
          ],
          next: null,
        },
      ],
      [big],
    )
    return { file, big }
  }

  it('reports the preview size, never the padded raw buffer size (Sony ARW)', () => {
    const r = findRawPreviews(src(arwWithPaddedRawSize().file), 'a.ARW')
    expect(r.rawWidth).toBe(1792)
    expect(r.rawHeight).toBe(1280)
    expect(getRawImageSizeFromBuffer(arwWithPaddedRawSize().file, 'a.ARW')).toEqual({
      width: 1500,
      height: 1000,
    })
  })

  it('applies the orientation to the preview size', () => {
    expect(getRawImageSizeFromBuffer(arwWithPaddedRawSize(6).file, 'a.ARW')).toEqual({
      width: 1000,
      height: 1500,
    })
  })

  it('reports the preview size for a RAF, oriented by the preview EXIF', () => {
    const jpeg = fakeJpeg(4416, 2944, { orientation: 8 })
    expect(getRawImageSizeFromBuffer(fakeRaf(jpeg), 'DSCF1153.RAF')).toEqual({
      width: 2944,
      height: 4416,
    })
    expect(getRawImageSizeFromBuffer(fakeRaf(fakeJpeg(4416, 2944)), 'a.RAF')).toEqual({
      width: 4416,
      height: 2944,
    })
  })

  it('returns null for a RAW without a usable preview', () => {
    expect(getRawImageSizeFromBuffer(Buffer.from('not a raw file at all'), 'a.ARW')).toBeNull()
  })

  it('reads the size from disk without loading the file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-preview-size-'))
    try {
      const p = path.join(dir, 'a.ARW')
      fs.writeFileSync(p, arwWithPaddedRawSize().file)
      expect(getRawImageSizeFromFile(p)).toEqual({ width: 1500, height: 1000 })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('raw sensor data is never taken for a preview', () => {
  /** IFD0 with a good preview, plus a SubIFD holding a single strip. */
  function withSensorStrip(strip: Buffer, subfileType: number) {
    return fakeTiff(
      [
        {
          entries: [
            { tag: TAG.imageWidth, type: 4, value: 6000 },
            { tag: TAG.imageHeight, type: 4, value: 4000 },
            { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
            { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
            { tag: TAG.subIfds, type: 13, value: { ifd: 1 } },
          ],
          next: null,
        },
        {
          entries: [
            { tag: TAG.newSubfileType, type: 4, value: subfileType },
            { tag: TAG.compression, type: 3, value: 7 },
            { tag: TAG.stripOffsets, type: 4, value: { blob: 1 } },
            { tag: TAG.stripByteCounts, type: 4, value: { blobLen: 1 } },
          ],
          next: null,
        },
      ],
      [fakeJpeg(1500, 1000), strip],
    )
  }

  it('rejects lossless JPEG (SOF3, 7, 11, 15) in parseJpegDimensions', () => {
    for (const sofMarker of [0xc3, 0xc7, 0xcb, 0xcf]) {
      expect(parseJpegDimensions(src(fakeJpeg(1024, 683, { sofMarker })), 0, 0)).toBeNull()
    }
    expect(parseJpegDimensions(src(fakeJpeg(1024, 683, { sofMarker: 0xc2 })), 0, 0)).toEqual({
      width: 1024,
      height: 683,
    })
  })

  it('does not choose a lossless raw strip', () => {
    const lossless = fakeJpeg(5000, 3300, { sofMarker: 0xc3, minBytes: 8192 })
    for (const subfileType of [0, 1]) {
      const r = findRawPreviews(src(withSensorStrip(lossless, subfileType)), 'a.dng')
      expect(r.candidates.map((c) => [c.width, c.height])).toEqual([[1500, 1000]])
    }
  })

  it('ignores a strip in a full-resolution IFD even when it is baseline JPEG', () => {
    const strip = fakeJpeg(5000, 3300, { minBytes: 8192 })
    const full = findRawPreviews(src(withSensorStrip(strip, 0)), 'a.dng')
    expect(full.candidates.map((c) => [c.width, c.height])).toEqual([[1500, 1000]])
    // The same strip in a reduced-resolution IFD is a legitimate preview.
    const reduced = findRawPreviews(src(withSensorStrip(strip, 1)), 'a.dng')
    expect(reduced.candidates.map((c) => [c.width, c.height])).toContainEqual([5000, 3300])
  })
})

describe('container orientation', () => {
  function orientations(ifd0: number | null, ifd1: number | null, sub: number | null = null) {
    const ori = (v: number | null) =>
      v === null ? [] : [{ tag: TAG.orientation, type: 3 as const, value: v }]
    const file = fakeTiff(
      [
        {
          entries: [
            ...ori(ifd0),
            { tag: TAG.jpegIfOffset, type: 4, value: { blob: 0 } },
            { tag: TAG.jpegIfLength, type: 4, value: { blobLen: 0 } },
            ...(sub === null ? [] : [{ tag: TAG.subIfds, type: 13 as const, value: { ifd: 2 } }]),
          ],
          next: 1,
        },
        { entries: [...ori(ifd1), { tag: TAG.newSubfileType, type: 4, value: 1 }], next: null },
        { entries: [...ori(sub), { tag: TAG.newSubfileType, type: 4, value: 1 }], next: null },
      ],
      [fakeJpeg(1500, 1000)],
    )
    return findRawPreviews(src(file), 'a.ARW').candidates[0].orientation
  }

  it('takes the orientation from IFD0 only, not from a later IFD or a SubIFD', () => {
    expect(orientations(1, 6)).toBe(1)
    expect(orientations(1, 6, 8)).toBe(1)
    expect(orientations(3, 6, 8)).toBe(3)
  })

  it('does not adopt a later IFD when IFD0 says nothing', () => {
    expect(orientations(null, 6)).toBe(1)
  })
})

describe('hostile input stays cheap', () => {
  const BUDGET_MS = 500

  /**
   * A TIFF with one IFD of `entries` large UNDEFINED values, each pointing at a blob that starts
   * with `body`. `distinct` false makes every entry point at the same blob.
   */
  function manyHitTiff(entries: number, distinct: boolean, body: Buffer): Buffer {
    const blobLen = 2200
    const tableEnd = 8 + 2 + entries * 12 + 4
    const out = Buffer.alloc(tableEnd + (distinct ? entries : 1) * blobLen)
    out.write('II', 0, 'latin1')
    out.writeUInt16LE(42, 2)
    out.writeUInt32LE(8, 4)
    out.writeUInt16LE(entries, 8)
    for (let k = 0; k < entries; k++) {
      const at = 10 + k * 12
      const blobAt = tableEnd + (distinct ? k : 0) * blobLen
      out.writeUInt16LE(0xc000 + k, at)
      out.writeUInt16LE(7, at + 2)
      out.writeUInt32LE(blobLen, at + 4)
      out.writeUInt32LE(blobAt, at + 8)
      if (k === 0 || distinct) body.copy(out, blobAt)
    }
    return out
  }

  /** SOI, a SOF0 claiming 64000x64000 and no EOI: passes every cheap check. */
  const hugeSof = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xc0, 0x00, 0x11, 0x08, 0xfa, 0x00, 0xfa, 0x00, 0x03,
  ])
  const noise = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00])

  it('examines a buffer of nothing but SOI markers within budget', () => {
    const data = Buffer.alloc(32 * 1024 * 1024).fill(Buffer.from([0xff, 0xd8, 0xff]))
    const t0 = performance.now()
    const r = findRawPreviews(src(data), 'a.ARW')
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS)
    expect(r.candidates.length).toBeLessThanOrEqual(64)
  })

  it('caps the candidates a TIFF with hundreds of preview-like tags can produce', () => {
    const t0 = performance.now()
    const r = findRawPreviews(src(manyHitTiff(500, true, hugeSof)), 'a.ARW')
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS)
    expect(r.candidates.length).toBeGreaterThan(0)
    expect(r.candidates.length).toBeLessThanOrEqual(DEFAULT_RAW_PREVIEW_LIMITS.maxHits)
  })

  it('collapses tags that all point at the same offset into one candidate', () => {
    const r = findRawPreviews(src(manyHitTiff(500, false, hugeSof)), 'a.ARW')
    expect(r.candidates).toHaveLength(1)
  })

  it('still returns the single valid preview among hundreds of decoys', () => {
    const decoys = manyHitTiff(400, true, noise)
    const good = fakeJpeg(1500, 1000)
    // Put the real preview at the end of the file and point the first entry at it.
    const file = Buffer.concat([decoys, good])
    file.writeUInt32LE(decoys.length, 10 + 8)
    file.writeUInt32LE(good.length, 10 + 4)
    const t0 = performance.now()
    const r = findRawPreviews(src(file), 'a.ARW')
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS)
    expect(r.candidates.map((c) => [c.width, c.height])).toEqual([[1500, 1000]])
  })

  it('counts failed attempts toward the cap when scanning', () => {
    // 5000 SOI markers that all fail validation, then a real JPEG far past the 256th.
    const junk = Buffer.alloc(5000 * 8)
    for (let i = 0; i < 5000; i++) noise.copy(junk, i * 8)
    const file = Buffer.concat([
      fakeTiff([{ entries: [{ tag: TAG.imageWidth, type: 4, value: 6000 }], next: null }], []),
      junk,
      fakeJpeg(1200, 800),
    ])
    const t0 = performance.now()
    const r = findRawPreviews(src(file), 'a.ARW')
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS)
    expect(r.candidates).toHaveLength(0)
  })
})

describe('RAW held in memory (Buffer input)', () => {
  it('extracts the same preview bytes as the file path does', () => {
    const jpeg = fakeJpeg(4416, 2944, { orientation: 6 })
    const got = extractRawPreviewFromBuffer(fakeRaf(jpeg), 533, 'DSCF5056.RAF')
    expect(got).not.toBeNull()
    expect(got!.jpeg.equals(jpeg)).toBe(true)
    expect(got).toMatchObject({ width: 4416, height: 2944, orientation: 6 })
  })

  it('detects a RAF from its magic bytes without a filename', () => {
    const got = extractRawPreviewFromBuffer(fakeRaf(fakeJpeg(4416, 2944)), Infinity)
    expect(got).toMatchObject({ width: 4416, height: 2944 })
  })

  it('returns null for data that is not a RAW', () => {
    expect(extractRawPreviewFromBuffer(Buffer.alloc(64), 300, 'x.ARW')).toBeNull()
  })
})
