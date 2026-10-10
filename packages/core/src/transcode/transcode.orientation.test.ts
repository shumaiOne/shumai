import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { transcodeService } from './transcode'

// Only the storage layer is mocked: these tests run the real sharp pipeline end to end.
vi.mock('@shumai/core/src/s3/s3', () => ({
  s3Service: {
    downloadToFile: vi.fn(),
    putObject: vi.fn(),
    resolveInput: vi.fn(),
    presign: vi.fn(),
  },
}))

// Only the RAW preview extraction is replaced, so the RAW branch of transcodeImage can be driven
// with a prepared file (the dcraw_emu fallback result) without ExifTool or dcraw_emu installed.
const extractRawMock = vi.hoisted(() => vi.fn())
vi.mock('./raw-extract', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./raw-extract')>()),
  extractAndValidateRawPreview: extractRawMock,
}))

// Windows keeps cached files open, which would make the temp dir cleanup fail with EBUSY.
sharp.cache(false)

type Corner = 'TL' | 'TR' | 'BL' | 'BR'

// Stored (sensor) pixels are landscape. Each quadrant has its own color so the direction of the
// rotation or flip can be read back from the corners of the output.
const STORED_WIDTH = 64
const STORED_HEIGHT = 48
const QUADRANT_COLORS: Record<Corner, [number, number, number]> = {
  TL: [220, 30, 30], // red
  TR: [30, 200, 30], // green
  BL: [30, 30, 220], // blue
  BR: [230, 230, 30], // yellow
}

/**
 * For each EXIF orientation: the displayed size and which stored corner ends up at the displayed
 * top-left and bottom-right. Orientations 5 to 8 swap width and height.
 */
const ORIENTATIONS: Array<{
  orientation: number
  name: string
  swapped: boolean
  topLeftIs: Corner
  bottomRightIs: Corner
}> = [
  { orientation: 1, name: 'normal', swapped: false, topLeftIs: 'TL', bottomRightIs: 'BR' },
  {
    orientation: 2,
    name: 'mirror horizontal',
    swapped: false,
    topLeftIs: 'TR',
    bottomRightIs: 'BL',
  },
  { orientation: 3, name: 'rotate 180', swapped: false, topLeftIs: 'BR', bottomRightIs: 'TL' },
  { orientation: 4, name: 'mirror vertical', swapped: false, topLeftIs: 'BL', bottomRightIs: 'TR' },
  { orientation: 5, name: 'transpose', swapped: true, topLeftIs: 'TL', bottomRightIs: 'BR' },
  { orientation: 6, name: 'rotate 90 CW', swapped: true, topLeftIs: 'BL', bottomRightIs: 'TR' },
  { orientation: 7, name: 'transverse', swapped: true, topLeftIs: 'BR', bottomRightIs: 'TL' },
  { orientation: 8, name: 'rotate 270 CW', swapped: true, topLeftIs: 'TR', bottomRightIs: 'BL' },
]

async function makeJpeg(orientation: number): Promise<Buffer> {
  const halfW = STORED_WIDTH / 2
  const halfH = STORED_HEIGHT / 2
  const block = (corner: Corner) => ({
    create: {
      width: halfW,
      height: halfH,
      channels: 3 as const,
      background: {
        r: QUADRANT_COLORS[corner][0],
        g: QUADRANT_COLORS[corner][1],
        b: QUADRANT_COLORS[corner][2],
      },
    },
  })
  const tile = async (corner: Corner) => sharp(block(corner)).png().toBuffer()
  return sharp({
    create: {
      width: STORED_WIDTH,
      height: STORED_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: await tile('TL'), left: 0, top: 0 },
      { input: await tile('TR'), left: halfW, top: 0 },
      { input: await tile('BL'), left: 0, top: halfH },
      { input: await tile('BR'), left: halfW, top: halfH },
    ])
    .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
    .withMetadata({ orientation })
    .toBuffer()
}

/** Which quadrant color is nearest to the pixel a few pixels inside the given output corner. */
async function cornerColor(file: string, where: 'TL' | 'BR'): Promise<Corner> {
  const { data, info } = await sharp(fs.readFileSync(file))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const inset = 3
  const x = where === 'TL' ? inset : info.width - 1 - inset
  const y = where === 'TL' ? inset : info.height - 1 - inset
  const offset = (y * info.width + x) * info.channels
  const pixel = [data[offset], data[offset + 1], data[offset + 2]]
  let best: Corner = 'TL'
  let bestDistance = Infinity
  for (const corner of Object.keys(QUADRANT_COLORS) as Corner[]) {
    const distance = QUADRANT_COLORS[corner].reduce(
      (sum, channel, i) => sum + (channel - pixel[i]) ** 2,
      0,
    )
    if (distance < bestDistance) {
      best = corner
      bestDistance = distance
    }
  }
  return best
}

describe('EXIF orientation (real sharp)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = transcodeService.createTempDir('orientation-test-')
  })

  afterEach(() => {
    transcodeService.removeDir(tempDir)
  })

  const expectedSize = (swapped: boolean) =>
    swapped
      ? { width: STORED_HEIGHT, height: STORED_WIDTH }
      : { width: STORED_WIDTH, height: STORED_HEIGHT }

  it.each(ORIENTATIONS)(
    'getImageInfo reports the displayed size for orientation $orientation ($name)',
    async ({ orientation, swapped }) => {
      const inputPath = path.join(tempDir, `in-${orientation}.jpg`)
      fs.writeFileSync(inputPath, await makeJpeg(orientation))

      const info = await transcodeService.getImageInfo(inputPath)
      const expected = expectedSize(swapped)

      expect(info.originalWidth).toBe(expected.width)
      expect(info.originalHeight).toBe(expected.height)
    },
  )

  it.each(ORIENTATIONS)(
    'transcodeImage outputs an upright image for orientation $orientation ($name)',
    async ({ orientation, swapped, topLeftIs, bottomRightIs }) => {
      const inputPath = path.join(tempDir, `in-${orientation}.jpg`)
      const outputPath = path.join(tempDir, `out-${orientation}.webp`)
      fs.writeFileSync(inputPath, await makeJpeg(orientation))

      await transcodeService.transcodeImage(inputPath, outputPath, 1000, 100)

      const meta = await sharp(fs.readFileSync(outputPath)).metadata()
      const expected = expectedSize(swapped)
      expect(meta.width).toBe(expected.width)
      expect(meta.height).toBe(expected.height)
      // Direction, not just size: the stored corner that lands top-left and bottom-right.
      expect(await cornerColor(outputPath, 'TL')).toBe(topLeftIs)
      expect(await cornerColor(outputPath, 'BR')).toBe(bottomRightIs)
    },
  )

  it('transcodeImage sizes a rotated preview from the displayed dimensions', async () => {
    // Stored 64x48 with orientation 6 is displayed 48x64 (portrait): the short edge is the width.
    const inputPath = path.join(tempDir, 'preview-in.jpg')
    const outputPath = path.join(tempDir, 'preview-out.webp')
    fs.writeFileSync(inputPath, await makeJpeg(6))

    await transcodeService.transcodeImage(inputPath, outputPath, 24, 80, { isPreview: true })

    const meta = await sharp(fs.readFileSync(outputPath)).metadata()
    expect(meta.width).toBeLessThan(meta.height ?? 0)
  })

  describe('RAW inputs', () => {
    const rawPreview = (previewPath: string, extra: Record<string, unknown>) => ({
      previewPath,
      cleanup: () => {},
      width: STORED_WIDTH,
      height: STORED_HEIGHT,
      ...extra,
    })

    it('never auto-orients dcraw_emu output that still carries an Orientation tag', async () => {
      // The dcraw fallback reports orientation undefined (already upright) but flags it as applied.
      const tiffLike = path.join(tempDir, 'dcraw.jpg')
      const outputPath = path.join(tempDir, 'dcraw-out.webp')
      fs.writeFileSync(tiffLike, await makeJpeg(6))
      extractRawMock.mockResolvedValueOnce(
        rawPreview(tiffLike, { orientation: undefined, orientationApplied: true }),
      )

      await transcodeService.transcodeImage(path.join(tempDir, 'photo.cr2'), outputPath, 1000, 100)

      const meta = await sharp(fs.readFileSync(outputPath)).metadata()
      // Stored landscape stays landscape and the stored corners stay put: no second rotation.
      expect(meta.width).toBe(STORED_WIDTH)
      expect(meta.height).toBe(STORED_HEIGHT)
      expect(await cornerColor(outputPath, 'TL')).toBe('TL')
      expect(await cornerColor(outputPath, 'BR')).toBe('BR')
    })

    it('still auto-orients an embedded preview that has no container orientation', async () => {
      const embedded = path.join(tempDir, 'embedded.jpg')
      const outputPath = path.join(tempDir, 'embedded-out.webp')
      fs.writeFileSync(embedded, await makeJpeg(6))
      extractRawMock.mockResolvedValueOnce(rawPreview(embedded, { orientation: undefined }))

      await transcodeService.transcodeImage(path.join(tempDir, 'photo.cr2'), outputPath, 1000, 100)

      const meta = await sharp(fs.readFileSync(outputPath)).metadata()
      expect(meta.width).toBe(STORED_HEIGHT)
      expect(meta.height).toBe(STORED_WIDTH)
    })
  })

  it('overlayAnnotationsOnBuffer keeps the displayed orientation', async () => {
    const annotations = [
      {
        type: 'box',
        color: '#ffffff',
        points: [
          [0.1, 0.1],
          [0.4, 0.4],
        ],
      },
    ] as unknown as PrismaJson.AnnotationList
    const annotated = await transcodeService.overlayAnnotationsOnBuffer(
      await makeJpeg(6),
      annotations,
    )

    const meta = await sharp(annotated).metadata()
    expect(meta.width).toBe(STORED_HEIGHT)
    expect(meta.height).toBe(STORED_WIDTH)
  })
})
