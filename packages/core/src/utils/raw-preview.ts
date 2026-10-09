/**
 * Locate the JPEG previews that camera RAW files already carry, so a thumbnail never has to
 * demosaic the sensor data.
 *
 * Every mainstream RAW format (Sony ARW, Fujifilm RAF, Nikon NEF, Canon CR2, DNG, Olympus ORF,
 * Pentax PEF, Samsung SRW, ...) embeds one or more ready-made JPEGs. Decoding the sensor data
 * instead is 100 to 1000x slower (a Sony ARW through LibRaw takes ~20 s; its embedded preview
 * takes milliseconds) and loses the camera's own rendering (film simulation, picture profile).
 *
 * The parser reads through a random-access `ByteSource`, so only the header, the IFDs and the
 * chosen preview are read, never the whole file. Every file-controlled offset is bounds-checked
 * and every file-controlled loop has a hard cap.
 *
 * Ported from RawThumbProvider (`src/core/raw_preview.cpp`, https://github.com/Bristopher/RawThumbProvider)
 * by its author, and released here under this repository's MIT license.
 */
import * as fs from 'fs'
import * as path from 'path'

/** Largest single read (and so allocation) the parser ever makes: also the largest preview. */
const MAX_READ_BYTES = 64 * 1024 * 1024

export interface ByteSource {
  /** Exactly `length` bytes at `offset`, or null on a short read or a bad range. */
  read(offset: number, length: number): Buffer | null
  /** Total size in bytes. */
  size(): number
}

export class BufferSource implements ByteSource {
  constructor(private readonly data: Uint8Array) {}

  read(offset: number, length: number): Buffer | null {
    if (!rangeOk(this.data.length, offset, length)) return null
    return Buffer.from(this.data.buffer, this.data.byteOffset + offset, length)
  }

  size(): number {
    return this.data.length
  }
}

export class FileSource implements ByteSource {
  private readonly total: number

  constructor(private readonly fd: number) {
    this.total = fs.fstatSync(fd).size
  }

  read(offset: number, length: number): Buffer | null {
    if (!rangeOk(this.total, offset, length)) return null
    // A hostile file can declare any length; never allocate more than a preview may be.
    if (length > MAX_READ_BYTES) return null
    const buf = Buffer.alloc(length)
    let done = 0
    while (done < length) {
      const n = fs.readSync(this.fd, buf, done, length - done, offset + done)
      if (n <= 0) return null
      done += n
    }
    return buf
  }

  size(): number {
    return this.total
  }
}

export type RawFormat = 'tiff' | 'raf' | 'cr3' | 'heif' | 'x3f' | 'ciff' | 'bigtiff' | 'unknown'

export interface RawPreview {
  /** Byte offset of the JPEG SOI within the file. */
  offset: number
  /** Byte length of the JPEG stream, trimmed to its EOI. */
  length: number
  /** Stored dimensions, from the JPEG's own SOF marker (before orientation). */
  width: number
  height: number
  /** EXIF orientation 1..8 still to be applied. */
  orientation: number
  /** True when a container tag pointed at it; false when found by the fallback scan. */
  fromTag: boolean
}

export interface RawPreviewResult {
  format: RawFormat
  /** Every validated preview: tag-located first, then largest first. */
  candidates: RawPreview[]
  /**
   * Largest full-resolution IFD size the container declares. For Sony ARW this is the padded
   * raw buffer (7168x5120), so it only bounds preview sizes; it is NOT the size of anything
   * that gets rendered (see {@link rawImageSize}).
   */
  rawWidth: number
  rawHeight: number
  error?: string
}

export interface RawPreviewLimits {
  maxPreviewDim: number
  minPreviewDim: number
  maxAspect: number
  maxScanBytes: number
  maxIfdEntries: number
  maxIfdChain: number
  maxSubIfdDepth: number
  minPreviewBytes: number
  maxPreviewBytes: number
  /** Distinct tag-located candidates kept per file. */
  maxHits: number
  /** Candidates examined in total (tags and scan, passes and failures alike). */
  maxConsiderAttempts: number
  /** Total bytes the EOI trim may walk back through, across all candidates. */
  maxEoiScanBytes: number
}

export const DEFAULT_RAW_PREVIEW_LIMITS: RawPreviewLimits = {
  maxPreviewDim: 65535,
  minPreviewDim: 32,
  maxAspect: 4,
  maxScanBytes: 64 * 1024 * 1024,
  maxIfdEntries: 512,
  maxIfdChain: 32,
  maxSubIfdDepth: 4,
  minPreviewBytes: 2048,
  maxPreviewBytes: MAX_READ_BYTES,
  maxHits: 64,
  maxConsiderAttempts: 256,
  maxEoiScanBytes: 128 * 1024 * 1024,
}

// --- helpers -----------------------------------------------------------------

function rangeOk(total: number, offset: number, length: number): boolean {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)) return false
  if (offset < 0 || length <= 0) return false
  return offset + length <= total
}

function u16(b: Buffer, at: number, be: boolean): number {
  return be ? b.readUInt16BE(at) : b.readUInt16LE(at)
}

function u32(b: Buffer, at: number, be: boolean): number {
  return be ? b.readUInt32BE(at) : b.readUInt32LE(at)
}

function readU16(src: ByteSource, at: number, be: boolean): number | null {
  const b = src.read(at, 2)
  return b ? u16(b, 0, be) : null
}

function readU32(src: ByteSource, at: number, be: boolean): number | null {
  const b = src.read(at, 4)
  return b ? u32(b, 0, be) : null
}

// --- TIFF --------------------------------------------------------------------

const TAG_NEW_SUBFILE_TYPE = 0x00fe
const TAG_IMAGE_WIDTH = 0x0100
const TAG_IMAGE_HEIGHT = 0x0101
const TAG_COMPRESSION = 0x0103
const TAG_STRIP_OFFSETS = 0x0111
const TAG_ORIENTATION = 0x0112
const TAG_STRIP_BYTE_COUNTS = 0x0117
const TAG_JPEG_IF_OFFSET = 0x0201
const TAG_JPEG_IF_LENGTH = 0x0202
const TAG_SUB_IFDS = 0x014a
const TAG_EXIF_IFD = 0x8769

// TIFF field type sizes, indexed by type code (1..13). 0 = unknown.
const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4]

interface TiffCtx {
  src: ByteSource
  base: number
  be: boolean
  lim: RawPreviewLimits
}

interface IfdEntry {
  tag: number
  type: number
  count: number
  /** Absolute offset of the value, already resolved past the inline case. */
  valueOffset: number
  inline: boolean
}

function entryElement(ctx: TiffCtx, e: IfdEntry, index = 0): number | null {
  if (index >= e.count) return null
  const size = TYPE_SIZE[e.type] ?? 0
  if (size === 0) return null
  const b = ctx.src.read(e.valueOffset + index * size, size)
  if (!b) return null
  switch (size) {
    case 1:
      return b[0]
    case 2:
      return u16(b, 0, ctx.be)
    case 4:
      return u32(b, 0, ctx.be)
    case 8: {
      // RATIONAL-sized fields: only the first word is meaningful for the tags read here.
      return u32(b, 0, ctx.be)
    }
    default:
      return null
  }
}

function readIfd(ctx: TiffCtx, ifdOffset: number): { entries: IfdEntry[]; next: number } | null {
  const count = readU16(ctx.src, ifdOffset, ctx.be)
  if (count === null || count === 0 || count > ctx.lim.maxIfdEntries) return null
  const entriesStart = ifdOffset + 2
  const table = ctx.src.read(entriesStart, count * 12 + 4)
  if (!table) return null

  const entries: IfdEntry[] = []
  for (let i = 0; i < count; i++) {
    const at = i * 12
    const tag = u16(table, at, ctx.be)
    const type = u16(table, at + 2, ctx.be)
    const n = u32(table, at + 4, ctx.be)
    const size = TYPE_SIZE[type] ?? 0
    if (size === 0) continue
    const total = n * size
    if (!Number.isSafeInteger(total)) continue
    if (total <= 4) {
      entries.push({ tag, type, count: n, valueOffset: entriesStart + at + 8, inline: true })
    } else {
      const valueOffset = ctx.base + u32(table, at + 8, ctx.be)
      if (!rangeOk(ctx.src.size(), valueOffset, total)) continue
      entries.push({ tag, type, count: n, valueOffset, inline: false })
    }
  }

  const nextRel = u32(table, count * 12, ctx.be)
  const next = nextRel !== 0 && ctx.base + nextRel !== ifdOffset ? ctx.base + nextRel : 0
  return { entries, next }
}

function findEntry(entries: IfdEntry[], tag: number): IfdEntry | undefined {
  return entries.find((e) => e.tag === tag)
}

interface WalkState {
  rawWidth: number
  rawHeight: number
  /** Container orientation, taken from IFD0 only (1 until {@link orientationSeen}). */
  orientation: number
  orientationSeen: boolean
  hits: Array<{ offset: number; length: number }>
  hitOffsets: Set<number>
  visited: Set<number>
}

/** Record a candidate location once per offset, up to the per-file cap. */
function addHit(ctx: TiffCtx, st: WalkState, offset: number, length: number): void {
  if (st.hits.length >= ctx.lim.maxHits || st.hitOffsets.has(offset)) return
  st.hitOffsets.add(offset)
  st.hits.push({ offset, length })
}

function walkIfdChain(ctx: TiffCtx, firstIfd: number, depth: number, st: WalkState): void {
  if (depth > ctx.lim.maxSubIfdDepth) return
  let ifd = firstIfd
  for (let n = 0; n < ctx.lim.maxIfdChain && ifd !== 0; n++) {
    // A crafted file can point IFDs at one another in a cycle; track everything walked.
    if (st.visited.has(ifd)) return
    if (st.visited.size >= ctx.lim.maxIfdChain * ctx.lim.maxSubIfdDepth) return
    st.visited.add(ifd)

    const parsed = readIfd(ctx, ifd)
    if (!parsed) return
    const { entries, next } = parsed

    // The full-resolution IFD (NewSubfileType 0, or absent) gives the sensor size.
    const subType = findEntry(entries, TAG_NEW_SUBFILE_TYPE)
    const isFullRes = !subType || entryElement(ctx, subType) === 0

    const w = findEntry(entries, TAG_IMAGE_WIDTH)
    const wv = w ? entryElement(ctx, w) : null
    if (isFullRes && wv !== null && wv > st.rawWidth) st.rawWidth = wv
    const h = findEntry(entries, TAG_IMAGE_HEIGHT)
    const hv = h ? entryElement(ctx, h) : null
    if (isFullRes && hv !== null && hv > st.rawHeight) st.rawHeight = hv
    // Orientation belongs to the main image: IFD0 (depth 0, first IFD) only. Later IFDs and
    // SubIFDs describe thumbnails and raw data and may carry a different value.
    if (depth === 0 && n === 0 && !st.orientationSeen) {
      st.orientationSeen = true
      const o = findEntry(entries, TAG_ORIENTATION)
      const ov = o ? entryElement(ctx, o) : null
      if (ov !== null && ov >= 1 && ov <= 8) st.orientation = ov
    }

    // JPEGInterchangeFormat pair: the canonical preview location.
    const jOff = findEntry(entries, TAG_JPEG_IF_OFFSET)
    const jLen = findEntry(entries, TAG_JPEG_IF_LENGTH)
    if (jOff && jLen) {
      const off = entryElement(ctx, jOff)
      const len = entryElement(ctx, jLen)
      if (off !== null && len !== null) addHit(ctx, st, ctx.base + off, len)
    }

    // A reduced-resolution IFD with JPEG compression (6, 7, or Olympus 99) stores its
    // preview as a single strip (DNG, NEF, ORF and others). A full-resolution IFD's strip is
    // the sensor data (lossless JPEG in DNG and CR2), so it only counts as a preview in IFD0,
    // where many formats (CR2 among them) keep their main JPEG.
    const comp = findEntry(entries, TAG_COMPRESSION)
    const compV = comp ? entryElement(ctx, comp) : null
    const sOff = findEntry(entries, TAG_STRIP_OFFSETS)
    const sLen = findEntry(entries, TAG_STRIP_BYTE_COUNTS)
    if (
      (!isFullRes || (depth === 0 && n === 0)) &&
      (compV === 6 || compV === 7 || compV === 99) &&
      sOff &&
      sLen &&
      sOff.count === 1 &&
      sLen.count === 1
    ) {
      const off = entryElement(ctx, sOff)
      const len = entryElement(ctx, sLen)
      if (off !== null && len !== null) addHit(ctx, st, ctx.base + off, len)
    }

    // A tag whose VALUE is itself a JPEG (Sony 0x2001, Panasonic JpgFromRaw, Olympus
    // ThumbnailImage, ...). Testing any large BYTE/UNDEFINED value for an SOI covers every
    // vendor without a vendor tag table.
    for (const e of entries) {
      if (e.inline || (e.type !== 1 && e.type !== 7)) continue
      if (e.count < ctx.lim.minPreviewBytes) continue
      const soi = ctx.src.read(e.valueOffset, 3)
      if (soi && soi[0] === 0xff && soi[1] === 0xd8 && soi[2] === 0xff) {
        addHit(ctx, st, e.valueOffset, e.count)
      }
    }

    // SubIFDs (DNG stores previews there, as do NEF and others).
    const sub = findEntry(entries, TAG_SUB_IFDS)
    if (sub) {
      const cnt = Math.min(sub.count, 16)
      for (let i = 0; i < cnt; i++) {
        const rel = entryElement(ctx, sub, i)
        if (rel !== null) walkIfdChain(ctx, ctx.base + rel, depth + 1, st)
      }
    }

    // The EXIF IFD can carry its own preview pair.
    const exif = findEntry(entries, TAG_EXIF_IFD)
    if (exif) {
      const rel = entryElement(ctx, exif)
      if (rel !== null) walkIfdChain(ctx, ctx.base + rel, depth + 1, st)
    }

    ifd = next
  }
}

// --- JPEG --------------------------------------------------------------------

/** True dimensions from a JPEG's SOF marker. Reads only the header segments. */
export function parseJpegDimensions(
  src: ByteSource,
  offset: number,
  maxLength: number,
): { width: number; height: number } | null {
  const end = Math.min(maxLength > 0 ? offset + maxLength : src.size(), src.size())
  // The header segments are parsed from one in-memory window (re-read only when a long
  // segment skips past it), not with a tiny read per marker.
  let win = readWindow(src, offset, end)
  if (!win || win.buf.length < 3) return null
  const soi = win.buf
  if (soi[0] !== 0xff || soi[1] !== 0xd8 || soi[2] !== 0xff) return null

  let p = offset + 2
  for (let guard = 0; guard < 4096 && p + 4 <= end; guard++) {
    if (p + 9 > win.start + win.buf.length) {
      win = readWindow(src, p, end)
      if (!win || win.buf.length < 4) return null
    }
    const at = p - win.start
    const b = win.buf
    if (b[at] !== 0xff) {
      p++
      continue
    }
    const marker = b[at + 1]
    if (marker === 0xff) {
      p++
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null
    const segLen = b.readUInt16BE(at + 2)
    if (segLen < 2) return null
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) {
      // SOF3 / 7 / 11 / 15 are lossless: that is raw sensor data, never a preview.
      if (marker === 0xc3 || marker === 0xc7 || marker === 0xcb || marker === 0xcf) return null
      if (at + 9 > b.length) return null
      const height = b.readUInt16BE(at + 5)
      const width = b.readUInt16BE(at + 7)
      return width > 0 && height > 0 ? { width, height } : null
    }
    p += 2 + segLen
  }
  return null
}

const HEADER_WINDOW_BYTES = 64 * 1024

/** Up to one header window at `start`, clipped to `end`; null when nothing can be read. */
function readWindow(
  src: ByteSource,
  start: number,
  end: number,
): { start: number; buf: Buffer } | null {
  const len = Math.min(HEADER_WINDOW_BYTES, end - start)
  if (len <= 0) return null
  const buf = src.read(start, len)
  return buf ? { start, buf } : null
}

/** EXIF orientation (1..8) from a JPEG's own APP1 segment, or null. */
export function readJpegExifOrientation(
  src: ByteSource,
  offset: number,
  maxLength: number,
): number | null {
  const soi = src.read(offset, 2)
  if (!soi || soi[0] !== 0xff || soi[1] !== 0xd8) return null

  let p = offset + 2
  const end = maxLength > 0 ? offset + maxLength : src.size()
  for (let guard = 0; guard < 64 && p + 4 <= end; guard++) {
    const h = src.read(p, 4)
    if (!h || h[0] !== 0xff) return null
    const marker = h[1]
    if (marker === 0xd9 || marker === 0xda) return null
    const segLen = h.readUInt16BE(2)
    if (segLen < 2) return null

    if (marker === 0xe1) {
      const sig = src.read(p + 4, 6)
      if (sig && sig.toString('latin1') === 'Exif\0\0') {
        const tiffBase = p + 10
        const th = src.read(tiffBase, 8)
        if (th && (th[0] === 0x49 || th[0] === 0x4d)) {
          const be = th[0] === 0x4d
          if (u16(th, 2, be) === 42) {
            const ctx: TiffCtx = { src, base: tiffBase, be, lim: DEFAULT_RAW_PREVIEW_LIMITS }
            const ifd = readIfd(ctx, tiffBase + u32(th, 4, be))
            const o = ifd ? findEntry(ifd.entries, TAG_ORIENTATION) : undefined
            const v = o ? entryElement(ctx, o) : null
            if (v !== null && v >= 1 && v <= 8) return v
          }
        }
      }
    }
    p += 2 + segLen
  }
  return null
}

const EOI_MARKER = Buffer.from([0xff, 0xd9])
const SOI_MARKER = Buffer.from([0xff, 0xd8, 0xff])

/** Offset just past the last EOI inside [offset, offset+maxLength), or null. */
export function findJpegEnd(src: ByteSource, offset: number, maxLength: number): number | null {
  const limit = Math.min(maxLength > 0 ? offset + maxLength : src.size(), src.size())
  const chunk = 64 * 1024
  let pos = limit
  while (pos > offset) {
    const take = Math.min(chunk, pos - offset)
    const at = pos - take
    const buf = src.read(at, take)
    if (!buf) return null
    const hit = buf.lastIndexOf(EOI_MARKER)
    if (hit >= 0) return at + hit + 2
    if (at === offset) break
    pos = at + 1 // overlap one byte so a marker split across chunks is not missed
  }
  return null
}

// --- detection and candidate collection --------------------------------------

export function detectRawFormat(src: ByteSource, filename = ''): RawFormat {
  // Up to 16 bytes: every magic below fits, and a short file must still be classified rather
  // than failing the read outright.
  const h = src.read(0, Math.min(16, src.size()))
  const ext = path.extname(filename).toLowerCase()
  if (!h || h.length < 4) return 'unknown'
  if (h.toString('latin1', 0, 15) === 'FUJIFILMCCD-RAW') return 'raf'
  if (h.toString('latin1', 0, 4) === 'FOVb') return 'x3f'
  if (h.toString('latin1', 4, 8) === 'ftyp') {
    return h.toString('latin1', 8, 12) === 'crx ' ? 'cr3' : 'heif'
  }
  const order = h.toString('latin1', 0, 2)
  if (order === 'II' || order === 'MM') {
    if (src.read(6, 8)?.toString('latin1') === 'HEAPCCDR') return 'ciff'
    const magic = u16(h, 2, order === 'MM')
    // 43 = BigTIFF (8-byte offsets): refused rather than misparsed.
    if (magic === 43) return 'bigtiff'
    // 42 = TIFF, 85 = Panasonic RW2, 0x4f52 / 0x5352 = Olympus ORF.
    if (magic === 42 || magic === 85 || magic === 0x4f52 || magic === 0x5352) return 'tiff'
  }
  if (ext === '.heic' || ext === '.heif' || ext === '.avif') return 'heif'
  return 'unknown'
}

/**
 * Validates a candidate against sanity limits and the sensor size, trims it to its EOI and
 * appends it. This gate rejects the phantom "JPEGs" a naive SOI scan finds inside compressed
 * sensor data (on real files: a 49552x5893 stream in a Sony ARW, 45208x20612 in a Fuji RAF).
 */
function consider(
  src: ByteSource,
  lim: RawPreviewLimits,
  budget: Budget,
  offset: number,
  length: number,
  fromTag: boolean,
  rawWidth: number,
  rawHeight: number,
  out: RawPreview[],
): void {
  // Every attempt counts, pass or fail, so a hostile file cannot make us examine endless
  // candidates.
  if (budget.attempts <= 0) return
  budget.attempts--

  if (!rangeOk(src.size(), offset, length)) return
  if (length < lim.minPreviewBytes) return

  const dims = parseJpegDimensions(src, offset, length)
  if (!dims) return
  const { width, height } = dims
  if (width < lim.minPreviewDim || height < lim.minPreviewDim) return
  if (width > lim.maxPreviewDim || height > lim.maxPreviewDim) return
  const aspect = width >= height ? width / height : height / width
  if (aspect > lim.maxAspect) return

  // A preview cannot be larger than the image it previews (10% slack for padded previews).
  if (rawWidth && rawHeight) {
    if (width * height > (rawWidth * rawHeight * 110) / 100) return
    if (width > (rawWidth * 11) / 10 && height > (rawHeight * 11) / 10) return
  }

  // A compressed JPEG cannot plausibly exceed its own uncompressed RGB size. Real Sony ARWs
  // declare a 256x256 preview with a 35 MB length; without this bound a thumbnail request
  // would read 35 MB. Computed up front so the EOI search never walks more than that.
  const maxPlausible = width * height * 3 + 64 * 1024
  let useLength = length
  if (length > maxPlausible || length > lim.maxPreviewBytes) {
    const window = Math.min(length, maxPlausible, lim.maxPreviewBytes)
    if (budget.eoiBytes < window) return
    budget.eoiBytes -= window
    const end = findJpegEnd(src, offset, window)
    if (end === null || end <= offset) return
    useLength = end - offset
  } else {
    // Trim padding the declared length included. Fast path: already ends on EOI.
    const tail = src.read(offset + length - 2, 2)
    if (!(tail && tail[0] === 0xff && tail[1] === 0xd9)) {
      if (budget.eoiBytes < length) return
      budget.eoiBytes -= length
      const end = findJpegEnd(src, offset, length)
      if (end !== null && end > offset) useLength = end - offset
    }
  }

  out.push({ offset, length: useLength, width, height, orientation: 1, fromTag })
}

/** Work left for one findRawPreviews call, shared by the tag hits and the scan. */
interface Budget {
  /** Candidates still allowed to be examined. */
  attempts: number
  /** Bytes the EOI trim may still walk back through. */
  eoiBytes: number
}

/** Last resort: scan for SOI markers. Only used when the container tags yielded nothing. */
function scanForJpegs(
  src: ByteSource,
  lim: RawPreviewLimits,
  budget: Budget,
  rawWidth: number,
  rawHeight: number,
  out: RawPreview[],
): void {
  const total = src.size()
  const cap = Math.min(total, lim.maxScanBytes)
  const chunk = 1 << 20
  let pos = 0
  while (pos < cap && out.length < 64 && budget.attempts > 0) {
    const take = Math.min(chunk + 3, cap - pos)
    const buf = src.read(pos, take)
    if (!buf) break
    let from = 0
    while (budget.attempts > 0 && out.length < 64) {
      const i = buf.indexOf(SOI_MARKER, from)
      if (i < 0) break
      consider(src, lim, budget, pos + i, total - (pos + i), false, rawWidth, rawHeight, out)
      from = i + 1
    }
    if (take <= 3) break
    // Overlap by 2 so a marker split across chunks is seen once, in the next chunk.
    pos += take - 2
  }
}

/** Find every valid embedded JPEG preview. Does not copy pixel data. */
export function findRawPreviews(
  src: ByteSource,
  filename = '',
  limits: RawPreviewLimits = DEFAULT_RAW_PREVIEW_LIMITS,
): RawPreviewResult {
  const format = detectRawFormat(src, filename)
  const result: RawPreviewResult = {
    format,
    candidates: [],
    rawWidth: 0,
    rawHeight: 0,
  }
  const st: WalkState = {
    rawWidth: 0,
    rawHeight: 0,
    orientation: 1,
    orientationSeen: false,
    hits: [],
    hitOffsets: new Set<number>(),
    visited: new Set<number>(),
  }
  const budget: Budget = {
    attempts: limits.maxConsiderAttempts,
    eoiBytes: limits.maxEoiScanBytes,
  }

  if (format === 'bigtiff') {
    result.error = 'BigTIFF is not supported (8-byte offsets)'
    return result
  }

  if (format === 'raf') {
    // Fuji's own header: big-endian JPEG offset at 0x54, length at 0x58. Orientation lives
    // in that JPEG's EXIF and is read below.
    const off = readU32(src, 0x54, true)
    const len = readU32(src, 0x58, true)
    if (off && len) st.hits.push({ offset: off, length: len })
  } else if (format === 'tiff') {
    const h = src.read(0, 8)
    if (h) {
      const be = h[0] === 0x4d
      const ctx: TiffCtx = { src, base: 0, be, lim: limits }
      walkIfdChain(ctx, u32(h, 4, be), 0, st)
    }
  }
  // CR3, X3F, CIFF and HEIF have no dedicated locator yet and fall through to the scan.

  result.rawWidth = st.rawWidth
  result.rawHeight = st.rawHeight

  for (const hit of st.hits) {
    consider(
      src,
      limits,
      budget,
      hit.offset,
      hit.length,
      true,
      st.rawWidth,
      st.rawHeight,
      result.candidates,
    )
  }
  // Scanning is where phantoms come from, so it never competes with a tag-located preview.
  if (result.candidates.length === 0) {
    scanForJpegs(src, limits, budget, st.rawWidth, st.rawHeight, result.candidates)
  }
  if (result.candidates.length === 0) {
    result.error = 'no valid embedded JPEG preview found'
    return result
  }

  // De-duplicate (the same JPEG is often reachable through two tags), then sort: tag-located
  // first, then largest first.
  const seen = new Set<number>()
  result.candidates = result.candidates.filter((c) => {
    if (seen.has(c.offset)) return false
    seen.add(c.offset)
    return true
  })
  result.candidates.sort((a, b) => {
    if (a.fromTag !== b.fromTag) return a.fromTag ? -1 : 1
    return b.width * b.height - a.width * a.height
  })

  // Orientation: prefer the container's. When it said nothing (RAF gives only an offset and a
  // length), fall back to the preview JPEG's own EXIF, otherwise rotated frames render sideways.
  for (const c of result.candidates) {
    c.orientation = st.orientation
    if (st.orientation === 1) {
      c.orientation = readJpegExifOrientation(src, c.offset, c.length) ?? 1
    }
  }
  return result
}

/**
 * Pick the preview to decode for a target whose longest edge is `edge` pixels.
 *
 * This is the SMALLEST on-aspect preview whose longest edge still reaches `edge`: output is
 * never upscaled, so it looks identical to a larger one for a fraction of the bytes (a Sony
 * A7C II's 1616x1080 preview is ~300 KB against ~4 MB for its 7008x4672 one). Off-aspect
 * extras (a 256x256 square, a 4:3 EXIF thumb beside 3:2 previews) are skipped. Falls back to
 * the largest on-aspect preview, then the largest of any shape.
 */
export function choosePreviewForSize(result: RawPreviewResult, edge: number): RawPreview | null {
  const valid = result.candidates.filter((c) => c.length > 0 && c.width > 0 && c.height > 0)
  if (valid.length === 0) return null

  const norm = (a: number) => (a < 1 ? 1 / a : a)
  const biggest = valid.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
  const refAspect = norm(biggest.width / biggest.height)
  const aspectOk = (c: RawPreview) =>
    Math.abs(norm(c.width / c.height) - refAspect) / refAspect <= 0.05

  let best: RawPreview | null = null
  let largestOk: RawPreview | null = null
  for (const c of valid) {
    if (!aspectOk(c)) continue
    if (!largestOk || c.width * c.height > largestOk.width * largestOk.height) largestOk = c
    if (
      Math.max(c.width, c.height) >= edge &&
      (!best || c.width * c.height < best.width * best.height)
    ) {
      best = c
    }
  }
  return best ?? largestOk ?? biggest
}

/** The largest preview, which is what the RAW "looks like" at full size. */
export function largestPreview(result: RawPreviewResult): RawPreview | null {
  return choosePreviewForSize(result, Number.MAX_SAFE_INTEGER)
}

/** Dimensions as displayed, after the preview's orientation is applied. */
export function orientedSize(p: RawPreview): { width: number; height: number } {
  return p.orientation >= 5 && p.orientation <= 8
    ? { width: p.height, height: p.width }
    : { width: p.width, height: p.height }
}

export function readPreviewBytes(
  src: ByteSource,
  p: RawPreview,
  limits: RawPreviewLimits = DEFAULT_RAW_PREVIEW_LIMITS,
): Buffer | null {
  if (p.length <= 0 || p.length > limits.maxPreviewBytes) return null
  const b = src.read(p.offset, p.length)
  return b ? Buffer.from(b) : null
}

export interface ExtractedRawPreview {
  jpeg: Buffer
  /** Stored dimensions of the chosen JPEG. */
  width: number
  height: number
  orientation: number
}

/**
 * Open a RAW file, choose the preview for `edge` (use `Infinity` for the largest) and return
 * its JPEG bytes. Reads only the headers and the chosen preview. Returns null when the file
 * carries no usable preview.
 */
export function extractRawPreviewFromFile(
  filePath: string,
  edge: number,
): ExtractedRawPreview | null {
  const fd = fs.openSync(filePath, 'r')
  try {
    const src = new FileSource(fd)
    const result = findRawPreviews(src, filePath)
    const chosen = Number.isFinite(edge)
      ? choosePreviewForSize(result, edge)
      : largestPreview(result)
    if (!chosen) return null
    const jpeg = readPreviewBytes(src, chosen)
    if (!jpeg) return null
    return { jpeg, width: chosen.width, height: chosen.height, orientation: chosen.orientation }
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * The asset's displayed size: the size of the image that actually gets rendered, which is the
 * largest embedded preview with its orientation applied. It is deliberately NOT the sensor size
 * (the transcode spec, output keys, watermark and viewer boxes must all agree with the real
 * file, and nothing is ever rendered at sensor size). Null when the file has no usable preview
 * (so the caller falls back to a full decode).
 */
export function rawImageSize(result: RawPreviewResult): { width: number; height: number } | null {
  const best = largestPreview(result)
  return best ? orientedSize(best) : null
}

/** {@link rawImageSize} for a RAW file on disk. Reads only the headers. */
export function getRawImageSizeFromFile(
  filePath: string,
): { width: number; height: number } | null {
  const fd = fs.openSync(filePath, 'r')
  try {
    return rawImageSize(findRawPreviews(new FileSource(fd), filePath))
  } finally {
    fs.closeSync(fd)
  }
}

/** {@link rawImageSize} for a RAW held in memory; `filename` only helps format detection. */
export function getRawImageSizeFromBuffer(
  data: Uint8Array,
  filename = '',
): { width: number; height: number } | null {
  return rawImageSize(findRawPreviews(new BufferSource(data), filename))
}

/** {@link extractRawPreviewFromFile} for a RAW held in memory. */
export function extractRawPreviewFromBuffer(
  data: Uint8Array,
  edge: number,
  filename = '',
): ExtractedRawPreview | null {
  const src = new BufferSource(data)
  const result = findRawPreviews(src, filename)
  const chosen = Number.isFinite(edge) ? choosePreviewForSize(result, edge) : largestPreview(result)
  if (!chosen) return null
  const jpeg = readPreviewBytes(src, chosen)
  if (!jpeg) return null
  return { jpeg, width: chosen.width, height: chosen.height, orientation: chosen.orientation }
}
