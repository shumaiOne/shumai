import { z } from 'zod'

/**
 * File-type filtering for the file browser. A filter names extensions ("jpg", "raf") and/or
 * groups ("group:raw"); the server expands groups and matches the file name's last extension,
 * case-insensitively.
 */

/**
 * Canonical camera RAW extensions (lowercase, no dot). The file-type filter's RAW group and
 * core's `isRawImage` both read this list, so the two cannot drift apart.
 */
export const RAW_EXTENSIONS = [
  '3fr',
  'arw',
  'cr2',
  'cr3',
  'crw',
  'dcr',
  'dng',
  'erf',
  'fff',
  'iiq',
  'kdc',
  'nef',
  'nrw',
  'orf',
  'pef',
  'raf',
  'raw',
  'rw2',
  'rwl',
  'sr2',
  'srf',
  'srw',
  'x3f',
] as const

export const FILE_TYPE_GROUPS = {
  /** Camera RAW formats: the one list in `RAW_EXTENSIONS`. */
  raw: RAW_EXTENSIONS,
  jpeg: ['jpg', 'jpeg'],
  heif: ['heic', 'heif', 'hif'],
  video: ['mov', 'mp4', 'm4v', 'mkv', 'avi', 'mts', 'm2ts', 'mxf', 'webm'],
  /**
   * Editing and sidecar files: XMP (Lightroom, darktable, Camera Raw), RawTherapee .pp3, DxO
   * .dop, Capture One .cos/.cop/.cot/.cof/.comask, ON1 .on1, Affinity/ACDSee .acr, Luminar .arp.
   */
  editing: ['xmp', 'pp3', 'dop', 'cos', 'cop', 'cot', 'cof', 'comask', 'on1', 'acr', 'arp'],
} as const satisfies Record<string, readonly string[]>

export type FileTypeGroup = keyof typeof FILE_TYPE_GROUPS

export const FILE_TYPE_GROUP_PREFIX = 'group:'

/** What an extension token may look like. The counts endpoint only offers extensions matching it. */
export const FILE_TYPE_EXTENSION_PATTERN = '^[a-z0-9]{1,10}$'

const fileTypeTokenSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(group:[a-z]+|[a-z0-9]{1,10})$/,
    'expected an extension like "jpg" or a group like "group:raw"',
  )

export const fileTypeFilterSchema = z.object({
  /** Show only files whose extension is in this list (extensions and/or groups). */
  include: z.array(fileTypeTokenSchema).max(64).optional(),
  /** Hide files whose extension is in this list (extensions and/or groups). */
  exclude: z.array(fileTypeTokenSchema).max(64).optional(),
})
export type FileTypeFilter = z.infer<typeof fileTypeFilterSchema>

/**
 * Drop the tokens a filter cannot send (an extension like "tar-gz" or one longer than 10
 * characters, an unknown group, anything not a string) and normalise the rest. Used on a filter
 * remembered by an older version or hand-edited, so it can never make every search fail.
 */
export function sanitizeFileTypeFilter(value: unknown): FileTypeFilter {
  const clean = (list: unknown): string[] | undefined => {
    if (!Array.isArray(list)) return undefined
    const out = new Set<string>()
    for (const item of list) {
      const parsed = fileTypeTokenSchema.safeParse(item)
      if (!parsed.success) continue
      const token = parsed.data
      if (token.startsWith(FILE_TYPE_GROUP_PREFIX)) {
        if (!Object.hasOwn(FILE_TYPE_GROUPS, token.slice(FILE_TYPE_GROUP_PREFIX.length))) continue
      }
      out.add(token)
    }
    return out.size > 0 ? [...out].slice(0, 64) : undefined
  }
  const src = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const include = clean(src.include)
  const exclude = clean(src.exclude)
  return { ...(include && { include }), ...(exclude && { exclude }) }
}

/** Expand groups into their extensions; drop unknown groups; de-duplicate. Lowercase output. */
export function expandFileTypes(tokens: readonly string[] | undefined): string[] {
  const out = new Set<string>()
  for (const raw of tokens ?? []) {
    const t = raw.trim().toLowerCase().replace(/^\./, '')
    if (t.startsWith(FILE_TYPE_GROUP_PREFIX)) {
      const group = t.slice(FILE_TYPE_GROUP_PREFIX.length) as FileTypeGroup
      // hasOwn: a made-up group such as "group:constructor" must not reach Object.prototype.
      if (Object.hasOwn(FILE_TYPE_GROUPS, group))
        for (const ext of FILE_TYPE_GROUPS[group]) out.add(ext)
    } else if (t) {
      out.add(t)
    }
  }
  return [...out]
}

/** True when the filter would change the listing. */
export function isFileTypeFilterActive(filter: FileTypeFilter | undefined): boolean {
  return !!filter && ((filter.include?.length ?? 0) > 0 || (filter.exclude?.length ?? 0) > 0)
}

/** The last extension of a file name, lowercase and without the dot ("" when there is none). */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

export const fileTypeCountSchema = z.object({
  extension: z.string(),
  count: z.number(),
})
export type FileTypeCount = z.infer<typeof fileTypeCountSchema>

/**
 * Roll per-extension counts up into per-group counts (every group is present, 0 when empty), so
 * the group rows can show a number without a second query.
 */
export function groupFileTypeCounts(
  counts: readonly FileTypeCount[] | undefined,
): Record<FileTypeGroup, number> {
  const totals = Object.fromEntries(
    (Object.keys(FILE_TYPE_GROUPS) as FileTypeGroup[]).map((g) => [g, 0]),
  ) as Record<FileTypeGroup, number>
  const groupOf = new Map<string, FileTypeGroup>()
  for (const group of Object.keys(FILE_TYPE_GROUPS) as FileTypeGroup[]) {
    for (const ext of FILE_TYPE_GROUPS[group]) groupOf.set(ext, group)
  }
  for (const { extension, count } of counts ?? []) {
    const group = groupOf.get(extension.toLowerCase())
    if (group) totals[group] += count
  }
  return totals
}
