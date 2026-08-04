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
