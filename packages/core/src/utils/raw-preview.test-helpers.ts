/**
 * Byte-level builders for RAW-preview tests. They produce just enough structure for the parser
 * (a JPEG with SOI / SOF / EOI and optional EXIF orientation; a RAF header; TIFF IFD chains), so
 * the tests need no binary fixtures and no image library.
 */

/**
 * A structurally valid JPEG: SOI, optional APP1 EXIF orientation, padding, SOF0, EOI. It is
 * not decodable pixel data, which the parser never needs. Padded to at least `minBytes` because
 * the parser ignores tiny candidates (EXIF thumbnails and noise).
 */
export function fakeJpeg(
  width: number,
  height: number,
  opts: { orientation?: number; minBytes?: number; sofMarker?: number } = {},
): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]

  if (opts.orientation) {
    // APP1 "Exif\0\0" + little-endian TIFF with one IFD entry: Orientation (SHORT).
    const tiff = Buffer.alloc(8 + 2 + 12 + 4)
    tiff.write('II', 0, 'latin1')
    tiff.writeUInt16LE(42, 2)
    tiff.writeUInt32LE(8, 4)
    tiff.writeUInt16LE(1, 8)
    tiff.writeUInt16LE(0x0112, 10)
    tiff.writeUInt16LE(3, 12)
    tiff.writeUInt32LE(1, 14)
    tiff.writeUInt16LE(opts.orientation, 18)
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
    const seg = Buffer.alloc(4)
    seg.writeUInt16BE(0xffe1, 0)
    seg.writeUInt16BE(body.length + 2, 2)
    parts.push(seg, body)
  }

  // SOF0 (or `sofMarker`): length 17, precision 8, height, width, 3 components.
  const sof = Buffer.alloc(19)
  sof.writeUInt16BE(0xff00 | (opts.sofMarker ?? 0xc0), 0)
  sof.writeUInt16BE(17, 2)
  sof[4] = 8
  sof.writeUInt16BE(height, 5)
  sof.writeUInt16BE(width, 7)
  sof[9] = 3
  const eoi = Buffer.from([0xff, 0xd9])

  // APP15 padding so the candidate clears the parser's minimum size.
  const soFar = parts.reduce((n, b) => n + b.length, 0) + sof.length + eoi.length
  const pad = Math.max(0, (opts.minBytes ?? 4096) - soFar - 4)
  if (pad > 0) {
    const seg = Buffer.alloc(4 + pad)
    seg.writeUInt16BE(0xffef, 0)
    seg.writeUInt16BE(pad + 2, 2)
    parts.push(seg)
  }

  parts.push(sof, eoi)
  return Buffer.concat(parts)
}

/** A Fujifilm RAF: magic, big-endian JPEG offset at 0x54 and length at 0x58, then the JPEG. */
export function fakeRaf(jpeg: Buffer, trailing = 1024): Buffer {
  const headerLen = 0x100
  const out = Buffer.alloc(headerLen + jpeg.length + trailing)
  out.write('FUJIFILMCCD-RAW 0201FF383501', 0, 'latin1')
  out.writeUInt32BE(headerLen, 0x54)
  out.writeUInt32BE(jpeg.length, 0x58)
  jpeg.copy(out, headerLen)
  return out
}

/** An IFD entry value: a literal, or the offset / length of a blob, or the offset of an IFD. */
export type TiffValue = number | { blob: number } | { blobLen: number } | { ifd: number }

export interface TiffEntry {
  tag: number
  /** 3 = SHORT, 4 = LONG, 13 = IFD. Values are always inline (count 1). */
  type: 3 | 4 | 13
  value: TiffValue
}

export interface TiffIfd {
  entries: TiffEntry[]
  /** Index of the next IFD in the chain, or null for the end. */
  next: number | null
}

/**
 * Builds a TIFF-container RAW: header, the IFDs in order, then the blobs. Offsets are absolute
 * (TIFF base 0). `magic` defaults to 42; pass 43 for BigTIFF.
 */
export function fakeTiff(
  ifds: TiffIfd[],
  blobs: Buffer[],
  opts: { bigEndian?: boolean; magic?: number } = {},
): Buffer {
  const be = opts.bigEndian ?? false
  const ifdOffsets: number[] = []
  let pos = 8
  for (const ifd of ifds) {
    ifdOffsets.push(pos)
    pos += 2 + ifd.entries.length * 12 + 4
  }
  const blobOffsets: number[] = []
  for (const b of blobs) {
    blobOffsets.push(pos)
    pos += b.length
  }

  const out = Buffer.alloc(pos)
  const w16 = (v: number, at: number) => (be ? out.writeUInt16BE(v, at) : out.writeUInt16LE(v, at))
  const w32 = (v: number, at: number) => (be ? out.writeUInt32BE(v, at) : out.writeUInt32LE(v, at))
  const resolve = (v: TiffValue): number => {
    if (typeof v === 'number') return v
    if ('blob' in v) return blobOffsets[v.blob]
    if ('blobLen' in v) return blobs[v.blobLen].length
    return ifdOffsets[v.ifd]
  }

  out.write(be ? 'MM' : 'II', 0, 'latin1')
  w16(opts.magic ?? 42, 2)
  w32(ifdOffsets[0] ?? 0, 4)

  ifds.forEach((ifd, i) => {
    let at = ifdOffsets[i]
    w16(ifd.entries.length, at)
    at += 2
    for (const e of ifd.entries) {
      w16(e.tag, at)
      w16(e.type, at + 2)
      w32(1, at + 4)
      if (e.type === 3) w16(resolve(e.value), at + 8)
      else w32(resolve(e.value), at + 8)
      at += 12
    }
    w32(ifd.next === null ? 0 : ifdOffsets[ifd.next], at)
  })

  blobs.forEach((b, i) => b.copy(out, blobOffsets[i]))
  return out
}

export const TAG = {
  newSubfileType: 0x00fe,
  imageWidth: 0x0100,
  imageHeight: 0x0101,
  compression: 0x0103,
  stripOffsets: 0x0111,
  orientation: 0x0112,
  stripByteCounts: 0x0117,
  subIfds: 0x014a,
  jpegIfOffset: 0x0201,
  jpegIfLength: 0x0202,
  exifIfd: 0x8769,
} as const
