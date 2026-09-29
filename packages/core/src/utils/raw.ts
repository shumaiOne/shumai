/**
 * Centralized set of recognized camera RAW file extensions.
 * Used only for routing files into the ExifTool extraction path.
 */
const RAW_EXTENSIONS: ReadonlySet<string> = new Set([
  '.3fr',
  '.arw',
  '.cr2',
  '.cr3',
  '.crw',
  '.dcr',
  '.dng',
  '.erf',
  '.fff',
  '.iiq',
  '.kdc',
  '.nef',
  '.nrw',
  '.orf',
  '.pef',
  '.raf',
  '.raw',
  '.rw2',
  '.rwl',
  '.sr2',
  '.srf',
  '.srw',
  '.x3f',
])

/** Check whether a filename has a recognized camera RAW extension. */
export function isRawImage(filename: string): boolean {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return false
  const ext = filename.slice(dotIndex).toLowerCase()
  return RAW_EXTENSIONS.has(ext)
}
