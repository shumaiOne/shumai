import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { applyRawOrientation } from './raw-extract'

// Real sharp (no mocks): the mapping must produce the same pixels as sharp's own
// EXIF auto-orientation, which is what a non-RAW image gets.

const WIDTH = 4
const HEIGHT = 2

/** 4x2 image where every pixel has a distinct colour, encoded as a lossless-ish JPEG. */
async function makeJpegWithOrientation(orientation: number): Promise<Buffer> {
  const raw = Buffer.alloc(WIDTH * HEIGHT * 3)
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    raw[i * 3] = i * 30
    raw[i * 3 + 1] = 255 - i * 30
    raw[i * 3 + 2] = (i * 77) % 256
  }
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .withMetadata({ orientation })
    .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

async function toRaw(pipeline: ReturnType<typeof sharp>) {
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

describe('EXIF_ORIENTATION_TO_ROTATION matches sharp auto-orientation', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('orientation %i', async (orientation) => {
    const jpeg = await makeJpegWithOrientation(orientation)

    // Reference: sharp reads the EXIF tag and orients the pixels itself.
    const expected = await toRaw(sharp(jpeg).rotate())

    // Under test: ignore the tag (as with an extracted RAW preview) and apply the mapping.
    const actual = await toRaw(applyRawOrientation(sharp(jpeg), orientation))

    expect(actual.width).toBe(expected.width)
    expect(actual.height).toBe(expected.height)
    expect(actual.data.equals(expected.data)).toBe(true)
  })

  it('swaps dimensions only for orientations 5 to 8', async () => {
    for (let orientation = 1; orientation <= 8; orientation++) {
      const jpeg = await makeJpegWithOrientation(orientation)
      const { width, height } = await toRaw(applyRawOrientation(sharp(jpeg), orientation))
      const swapped = orientation >= 5
      expect([width, height]).toEqual(swapped ? [HEIGHT, WIDTH] : [WIDTH, HEIGHT])
    }
  })
})
