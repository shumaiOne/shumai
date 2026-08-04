import { describe, it, expect } from 'vitest'
import { getFileMimeType, readFileMimeType } from './file-mime'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

function withTempFile(content: string | Buffer, filename: string, fn: (filePath: string) => void) {
  const filePath = path.join(os.tmpdir(), filename)
  fs.writeFileSync(filePath, content)
  try {
    fn(filePath)
  } finally {
    fs.unlinkSync(filePath)
  }
}

describe('getFileMimeType', () => {
  it('should detect binary mime type from content signature', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ])
    expect(getFileMimeType(png, 'photo.unknown')).toBe('image/png')
  })

  it('should map known extensions when no signature is available', () => {
    expect(getFileMimeType(null, 'notes.md')).toBe('text/markdown')
    expect(getFileMimeType(null, 'doc.pdf')).toBe('application/pdf')
    expect(getFileMimeType(null, 'image.PNG')).toBe('image/png')
  })

  it('should fall back to application/octet-stream for unknown extensions', () => {
    expect(getFileMimeType(null, 'script.ts')).toBe('application/octet-stream')
  })

  it('should honor a custom fallback for unknown extensions', () => {
    expect(getFileMimeType(null, 'script.ts', 'text/plain')).toBe('text/plain')
  })
})

describe('readFileMimeType', () => {
  it('should sniff binary file content', () => {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x00,
    ])
    withTempFile(pngBytes, 'file-mime-test-image.png', (filePath) => {
      expect(readFileMimeType(filePath)).toBe('image/png')
    })
  })

  it('should map text files by extension', () => {
    withTempFile('# Hello', 'file-mime-test-notes.md', (filePath) => {
      expect(readFileMimeType(filePath)).toBe('text/markdown')
    })
  })

  it('should fall back to octet-stream for missing files', () => {
    expect(readFileMimeType('/nonexistent/file.xyz')).toBe('application/octet-stream')
  })
})
