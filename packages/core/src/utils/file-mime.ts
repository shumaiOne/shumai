import * as fs from 'fs'
import * as path from 'path'
import { detectSupportedMimeType } from './mime'

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  // Camera RAW formats
  '.3fr': 'image/x-hasselblad-3fr',
  '.arw': 'image/x-sony-arw',
  '.cr2': 'image/x-canon-cr2',
  '.cr3': 'image/x-canon-cr3',
  '.crw': 'image/x-canon-crw',
  '.dcr': 'image/x-kodak-dcr',
  '.dng': 'image/x-adobe-dng',
  '.erf': 'image/x-epson-erf',
  '.fff': 'image/x-hasselblad-fff',
  '.iiq': 'image/x-phaseone-iiq',
  '.kdc': 'image/x-kodak-kdc',
  '.nef': 'image/x-nikon-nef',
  '.nrw': 'image/x-nikon-nrw',
  '.orf': 'image/x-olympus-orf',
  '.pef': 'image/x-pentax-pef',
  '.raf': 'image/x-fuji-raf',
  '.raw': 'image/x-panasonic-raw',
  '.rw2': 'image/x-panasonic-rw2',
  '.rwl': 'image/x-leica-rwl',
  '.sr2': 'image/x-sony-sr2',
  '.srf': 'image/x-sony-srf',
  '.srw': 'image/x-samsung-srw',
  '.x3f': 'image/x-sigma-x3f',
}

/**
 * Resolve a mime type from an optional content signature and a filename.
 * Content signature sniffing (binary formats) takes priority; otherwise the
 * filename extension mapping is used, falling back to `fallback` (defaults to
 * `application/octet-stream`).
 */
export function getFileMimeType(
  buffer: Uint8Array | null,
  filename: string,
  fallback: string = 'application/octet-stream',
): string {
  if (buffer) {
    const detected = detectSupportedMimeType(buffer)
    if (detected) return detected
  }
  const ext = path.extname(filename).toLowerCase()
  return EXTENSION_MIME_TYPES[ext] || fallback
}

/**
 * Detect the mime type of a file on disk by sniffing its first bytes and
 * falling back to extension mapping.
 */
export function readFileMimeType(filePath: string): string {
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(4100)
      const bytesRead = fs.readSync(fd, buffer, 0, 4100, 0)
      return getFileMimeType(new Uint8Array(buffer.subarray(0, bytesRead)), filePath)
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    /* Ignore read errors and fall back to extension mapping */
    return getFileMimeType(null, filePath)
  }
}
