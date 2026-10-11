import { sanitizeFileTypeFilter, type FileTypeFilter } from '@shumai/dtos'

/**
 * Format a file count for the file-type filter in the reader's locale ("1,204" in en, "1 204" in
 * fr). Pass the locale explicitly in tests; the UI passes the active paraglide locale.
 */
export function formatFileCount(count: number, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale).format(count)
  } catch {
    // An unknown locale tag makes Intl throw; fall back to the runtime default.
    return new Intl.NumberFormat().format(count)
  }
}

/**
 * The remembered file-type filter with any token the server would reject removed (an older build
 * offered extensions like "tar-gz" that make every search fail with a 400). `changed` tells the
 * caller to write the cleaned value back, so the stored filter heals itself.
 */
export function cleanPersistedFileTypes(stored: unknown): {
  value: FileTypeFilter
  changed: boolean
} {
  const value = sanitizeFileTypeFilter(stored)
  const changed = stored !== undefined && JSON.stringify(stored) !== JSON.stringify(value)
  return { value, changed }
}
