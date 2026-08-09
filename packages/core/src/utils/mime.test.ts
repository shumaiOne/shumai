import { describe, it, expect } from 'vitest'
import {
  detectSupportedMimeType,
  getProxyType,
  isOfficeDocument,
  isHtmlDocument,
  isMarkdownDocument,
  isCsvDocument,
} from './mime'

describe('detectSupportedMimeType', () => {
  it('should detect JPEG', () => {
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    expect(detectSupportedMimeType(buffer)).toBe('image/jpeg')
  })

  it('should detect PNG', () => {
    const buffer = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ])
    expect(detectSupportedMimeType(buffer)).toBe('image/png')
  })

  it('should detect GIF', () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectSupportedMimeType(buffer)).toBe('image/gif')
  })

  it('should detect WEBP', () => {
    const buffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ])
    expect(detectSupportedMimeType(buffer)).toBe('image/webp')
  })

  it('should detect PSD', () => {
    const buffer = new Uint8Array([0x38, 0x42, 0x50, 0x53, 0x00, 0x01])
    expect(detectSupportedMimeType(buffer)).toBe('image/vnd.adobe.photoshop')
  })

  it('should detect MP4', () => {
    const buffer = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ])
    expect(detectSupportedMimeType(buffer)).toBe('video/mp4')
  })

  it('should return null for unknown type', () => {
    const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00])
    expect(detectSupportedMimeType(buffer)).toBeNull()
  })
})

describe('document helpers', () => {
  it('isOfficeDocument should correctly identify office files', () => {
    expect(isOfficeDocument('application/msword', 'letter.doc')).toBe(true)
    expect(
      isOfficeDocument(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx',
      ),
    ).toBe(true)
    expect(isOfficeDocument(null, 'sheet.xlsx')).toBe(true)
    expect(isOfficeDocument(null, 'slides.pptx')).toBe(true)
    expect(isOfficeDocument(null, 'notes.rtf')).toBe(true)
    expect(isOfficeDocument('text/plain', 'notes.txt')).toBe(false)
  })

  it('isHtmlDocument should correctly identify html files', () => {
    expect(isHtmlDocument('text/html', 'page.html')).toBe(true)
    expect(isHtmlDocument(null, 'index.htm')).toBe(true)
    expect(isHtmlDocument('text/plain', 'notes.txt')).toBe(false)
  })

  it('isMarkdownDocument should correctly identify markdown files', () => {
    expect(isMarkdownDocument('text/markdown', 'README.md')).toBe(true)
    expect(isMarkdownDocument(null, 'doc.markdown')).toBe(true)
  })

  it('isCsvDocument should correctly identify csv files', () => {
    expect(isCsvDocument('text/csv', 'data.csv')).toBe(true)
    expect(isCsvDocument(null, 'data.csv')).toBe(true)
  })
})

describe('getProxyType', () => {
  it('should detect image proxyType', () => {
    expect(getProxyType('image/png', 'test.png')).toBe('image')
    expect(getProxyType('image/jpeg', 'photo.jpg')).toBe('image')
    expect(getProxyType('image/vnd.adobe.photoshop', 'design.psd')).toBe('image')
    expect(getProxyType(null, 'design.psd')).toBe('image')
  })

  it('should detect video proxyType', () => {
    expect(getProxyType('video/mp4', 'clip.mp4')).toBe('video')
  })

  it('should detect audio proxyType', () => {
    expect(getProxyType('audio/mpeg', 'song.mp3')).toBe('audio')
  })

  it('should detect pdf proxyType for pdf, csv, txt, markdown, html, and office files', () => {
    expect(getProxyType('application/pdf', 'doc.pdf')).toBe('pdf')
    expect(getProxyType('text/plain', 'notes.txt')).toBe('pdf')
    expect(getProxyType('text/csv', 'data.csv')).toBe('pdf')
    expect(getProxyType('text/markdown', 'README.md')).toBe('pdf')
    expect(getProxyType('text/x-markdown', 'doc.markdown')).toBe('pdf')
    expect(getProxyType('text/html', 'index.html')).toBe('pdf')
    expect(getProxyType('application/msword', 'letter.doc')).toBe('pdf')
    expect(getProxyType(null, 'sheet.xlsx')).toBe('pdf')
    expect(getProxyType(null, 'slides.pptx')).toBe('pdf')
  })

  it('should return null for unsupported files', () => {
    expect(getProxyType('application/zip', 'archive.zip')).toBeNull()
    expect(getProxyType(null, 'unknown.bin')).toBeNull()
  })
})
