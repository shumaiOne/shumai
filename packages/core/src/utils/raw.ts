// Deep import on purpose: this file is reachable from the Temporal workflow bundle (via utils/mime),
// and the dtos index pulls in modules that import @shumai/db, which webpack cannot resolve there.
import { RAW_EXTENSIONS as RAW_EXTENSION_NAMES } from '@shumai/dtos/src/file-types'

/**
 * Centralized set of recognized camera RAW file extensions, with the leading dot. The list itself
 * lives in `@shumai/dtos` (`RAW_EXTENSIONS`) so the file browser's RAW filter shares it.
 * Used only for routing files into the ExifTool extraction path.
 */
const RAW_EXTENSIONS: ReadonlySet<string> = new Set(RAW_EXTENSION_NAMES.map((ext) => `.${ext}`))

/** The same list without dots, as the file-type filter uses it. */
export { RAW_EXTENSION_NAMES }

/** Check whether a filename has a recognized camera RAW extension. */
export function isRawImage(filename: string): boolean {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return false
  const ext = filename.slice(dotIndex).toLowerCase()
  return RAW_EXTENSIONS.has(ext)
}
