import { RAW_EXTENSION_NAMES } from './raw'

/**
 * RAW + JPEG stacks: the files of one shot that differ only by extension (DSCF1234.RAF and
 * DSCF1234.JPG in the same folder). Stacking is a view over file names; it never changes data.
 *
 * `SqlQueryBuilder.stackRawJpeg()` applies the same rules in SQL for paginated listings, so keep
 * the two in step.
 */

/** Extensions (lowercase, no dot) of ready-to-view photos, in cover-preference order. */
export const STACK_PREVIEW_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'heic', 'heif', 'hif']

/** Extensions (lowercase, no dot) of camera RAW files, from the shared RAW list. */
export const STACK_RAW_EXTENSIONS: readonly string[] = RAW_EXTENSION_NAMES

const PREVIEW_SET: ReadonlySet<string> = new Set(STACK_PREVIEW_EXTENSIONS)
const RAW_SET: ReadonlySet<string> = new Set(STACK_RAW_EXTENSIONS)

/** Lowercase extension without the dot, or '' when the name has none. */
export function stackExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.slice(dot + 1).toLowerCase()
}

/** The name without its last extension, lowercased: DSCF1234.RAF and DSCF1234.jpg share "dscf1234". */
export function stackBaseName(name: string): string {
  const dot = name.lastIndexOf('.')
  return (dot <= 0 ? name : name.slice(0, dot)).toLowerCase()
}

export type StackRole = 'raw' | 'preview' | null

/** Whether a file name is a camera RAW, a JPEG/HEIF photo, or neither. */
export function stackRole(name: string): StackRole {
  const ext = stackExtension(name)
  if (PREVIEW_SET.has(ext)) return 'preview'
  if (RAW_SET.has(ext)) return 'raw'
  return null
}

export interface StackCandidate {
  id: string
  name: string
  parentId: string | null
}

export interface PhotoStack {
  /** `${parentId}/${baseName}`, unique per folder and shot. */
  key: string
  /** The file shown on the card: the first JPEG/HEIF photo. */
  cover: StackCandidate
  /** Every file of the stack in display order: photos (JPG before HEIF), then RAW. */
  members: StackCandidate[]
}

function memberOrder(a: StackCandidate, b: StackCandidate): number {
  const roleA = stackRole(a.name) === 'preview' ? 0 : 1
  const roleB = stackRole(b.name) === 'preview' ? 0 : 1
  if (roleA !== roleB) return roleA - roleB
  if (roleA === 0) {
    const byExt =
      STACK_PREVIEW_EXTENSIONS.indexOf(stackExtension(a.name)) -
      STACK_PREVIEW_EXTENSIONS.indexOf(stackExtension(b.name))
    if (byExt !== 0) return byExt
  }
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Group files into RAW + JPEG stacks. Files pair when they sit in the same folder, share a base
 * name (case-insensitive) and the group holds at least one RAW and at least one JPEG/HEIF photo.
 * A lone RAW, a lone JPEG, JPEG variants without a RAW, and files in different folders stay out.
 */
export function groupPhotoStacks(files: readonly StackCandidate[]): PhotoStack[] {
  const groups = new Map<string, StackCandidate[]>()
  for (const file of files) {
    if (!file.parentId || stackRole(file.name) === null) continue
    const key = `${file.parentId}/${stackBaseName(file.name)}`
    const list = groups.get(key)
    if (list) list.push(file)
    else groups.set(key, [file])
  }

  const stacks: PhotoStack[] = []
  for (const [key, list] of groups) {
    const hasRaw = list.some((f) => stackRole(f.name) === 'raw')
    const hasPreview = list.some((f) => stackRole(f.name) === 'preview')
    if (!hasRaw || !hasPreview) continue
    const members = [...list].sort(memberOrder)
    stacks.push({ key, cover: members[0]!, members })
  }
  return stacks
}
