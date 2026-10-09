/**
 * XMP sidecar files: the culling and tagging that photographers keep next to an image
 * (`DSCF1234.RAF.xmp` as darktable writes it, `DSCF1234.xmp` as Lightroom and Capture One do).
 *
 * This file holds the pure parts: reading a sidecar's rating, color label and keywords, working
 * out which media file a sidecar belongs to, and turning the result into metadata field updates.
 * The database side lives in `xmp-sidecar-sync.ts`.
 */
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { exiftool, type Tags } from 'exiftool-vendored'
import { logger } from '../logger'
import { withTimeout } from '../transcode/raw-extract'
import { isRawImage } from '../utils/raw'

/** A sidecar bigger than this is not a rating file (develop history can be large, not this large). */
export const MAX_XMP_SIDECAR_BYTES = 5 * 1024 * 1024

const DEFAULT_EXIFTOOL_TIMEOUT_MS = 15_000

/** Keys of the read-only system fields the sidecar values are stored in (see `system_fields.ts`). */
export const XMP_FIELD_KEYS = ['xmp_rating', 'xmp_rejected', 'xmp_label', 'xmp_keywords'] as const

export interface XmpSidecar {
  /** Star rating from 1 to 5. Unrated (0) and rejected (-1) leave it unset. */
  rating?: number
  /** `xmp:Rating` of -1, which darktable and Lightroom use for a rejected photo. */
  rejected: boolean
  /** `xmp:Label`, for example "Red" or "Blue". Kept as written. */
  label?: string
  /** `dc:subject` plus the last part of every `lr:hierarchicalSubject` path, without repeats. */
  keywords: string[]
}

export interface MetadataUpdate {
  key: string
  value: string | number | boolean | null
}

function nonBlank(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** ExifTool returns a lone keyword as a string and a keyword like "2024" as a number. */
function toList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value]
  const out: string[] = []
  for (const item of items) {
    const s = nonBlank(item)
    if (s) out.push(s)
  }
  return out
}

/** The rating, label and keywords from ExifTool's tags for an XMP file, or null when it has none. */
export function xmpFromTags(
  tags: Pick<Tags, 'Rating' | 'Label' | 'Subject' | 'HierarchicalSubject'>,
): XmpSidecar | null {
  const rawRating = typeof tags.Rating === 'number' ? tags.Rating : Number(tags.Rating)
  const hasRating = tags.Rating !== undefined && Number.isFinite(rawRating)
  const rejected = hasRating && rawRating < 0
  const rating = hasRating && rawRating >= 1 ? Math.min(5, Math.round(rawRating)) : undefined
  const label = nonBlank(tags.Label)
  const keywords: string[] = []
  const seen = new Set<string>()
  const add = (kw: string) => {
    const k = kw.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    keywords.push(kw)
  }
  toList(tags.Subject).forEach(add)
  for (const entry of toList(tags.HierarchicalSubject)) {
    const leaf = entry.split('|').pop()?.trim()
    if (leaf) add(leaf)
  }
  if (!hasRating && !label && keywords.length === 0) return null
  return { rating, rejected, label, keywords }
}

/**
 * Whether ExifTool read the file as an XMP document. ExifTool detects the format by content, so a
 * JPEG or video renamed to `.xmp` reports its real type and its embedded tags must not be taken
 * as sidecar values.
 */
export function isXmpFileTags(tags: Pick<Tags, 'FileType' | 'MIMEType'>): boolean {
  return tags.FileType === 'XMP' || tags.MIMEType === 'application/rdf+xml'
}

/**
 * Read a sidecar's content. Never throws: malformed or unreadable XML gives null. ExifTool's XMP
 * reader does not resolve entities or DTDs, so a hostile file cannot read local files or expand
 * entities. The content is written to a private temporary file because ExifTool reads paths.
 * A file that is not really XMP (a JPEG renamed to .xmp) gives null.
 */
export async function parseXmpSidecar(data: Buffer | string): Promise<XmpSidecar | null> {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  if (buffer.length === 0 || buffer.length > MAX_XMP_SIDECAR_BYTES) return null
  let dir: string | undefined
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'shumai-xmp-'))
    const file = path.join(dir, `${randomUUID()}.xmp`)
    await writeFile(file, buffer)
    const timeoutMs = Number(process.env.EXIFTOOL_TIMEOUT_MS) || DEFAULT_EXIFTOOL_TIMEOUT_MS
    const tags = await withTimeout(exiftool.read(file), timeoutMs, 'exiftool.read')
    if (!isXmpFileTags(tags)) return null
    return xmpFromTags(tags)
  } catch (err) {
    logger.warn({ err }, 'Failed to read XMP sidecar')
    return null
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/**
 * The metadata updates for a sidecar. A field the sidecar does not set has the value null, which
 * the sync turns into deleting that field's row (never an all-null row), so a re-synced sidecar
 * that dropped its label or keywords clears them. Pass null to clear everything.
 *
 * Keywords are stored comma-joined in one text value. A keyword that itself holds a comma is
 * indistinguishable from two keywords in that value; the original list stays in the sidecar.
 */
export function xmpMetadataUpdates(xmp: XmpSidecar | null): MetadataUpdate[] {
  return [
    { key: 'xmp_rating', value: xmp?.rating ?? null },
    { key: 'xmp_rejected', value: xmp?.rejected ? true : null },
    { key: 'xmp_label', value: xmp?.label ?? null },
    { key: 'xmp_keywords', value: xmp?.keywords.length ? xmp.keywords.join(', ') : null },
  ]
}

export function isXmpSidecarName(name: string): boolean {
  return name.length > 4 && !name.startsWith('.') && name.toLowerCase().endsWith('.xmp')
}

/**
 * The part of a file name that a media file and its sidecar share:
 * `DSCF1234.RAF.xmp`, `DSCF1234.xmp` and `DSCF1234.RAF` all give `DSCF1234`.
 */
export function xmpStem(name: string): string {
  let base = isXmpSidecarName(name) ? name.slice(0, -4) : name
  const dot = base.lastIndexOf('.')
  if (dot > 0) base = base.slice(0, dot)
  return base
}

export interface FolderEntry {
  id: string
  name: string
  createdAt: Date
}

/**
 * Match sidecars with media files among the files of one folder. Names are compared ignoring case.
 *
 * - `X.RAF.xmp` belongs to `X.RAF` (the darktable style) and wins over `X.xmp`.
 * - `X.xmp` belongs to `X.<ext>` (the Lightroom and Capture One style). When a RAW file and
 *   other files share the name (RAW plus JPEG), only the RAW file takes it, as Lightroom does.
 * - When two sidecars have the same name (a re-upload), the newest one is used.
 *
 * Returns media id -> sidecar id. Media with no sidecar are not in the map.
 */
export function pairSidecars(entries: FolderEntry[]): Map<string, string> {
  const sidecarsByName = new Map<string, FolderEntry>()
  const media: FolderEntry[] = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    if (isXmpSidecarName(e.name)) {
      const key = e.name.toLowerCase()
      const prev = sidecarsByName.get(key)
      if (!prev || e.createdAt.getTime() > prev.createdAt.getTime()) sidecarsByName.set(key, e)
    } else {
      media.push(e)
    }
  }
  const rawStems = new Set(
    media.filter((m) => isRawImage(m.name)).map((m) => xmpStem(m.name).toLowerCase()),
  )
  const pairs = new Map<string, string>()
  for (const m of media) {
    const lower = m.name.toLowerCase()
    const exact = sidecarsByName.get(`${lower}.xmp`)
    if (exact) {
      pairs.set(m.id, exact.id)
      continue
    }
    const stem = xmpStem(m.name).toLowerCase()
    const shared = sidecarsByName.get(`${stem}.xmp`)
    if (!shared) continue
    if (!isRawImage(m.name) && rawStems.has(stem)) continue
    pairs.set(m.id, shared.id)
  }
  return pairs
}
