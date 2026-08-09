export type ProxyType = 'image' | 'video' | 'audio' | 'pdf'

export function isOfficeDocument(mediaType?: string | null, filename?: string | null): boolean {
  const lowerMediaType = mediaType?.toLowerCase() || ''
  const lowerFilename = filename?.toLowerCase() || ''

  if (
    lowerMediaType === 'application/msword' ||
    lowerMediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerMediaType === 'application/vnd.ms-excel' ||
    lowerMediaType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lowerMediaType === 'application/vnd.ms-powerpoint' ||
    lowerMediaType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    lowerMediaType === 'application/vnd.oasis.opendocument.text' ||
    lowerMediaType === 'application/vnd.oasis.opendocument.spreadsheet' ||
    lowerMediaType === 'application/vnd.oasis.opendocument.presentation' ||
    lowerMediaType === 'application/rtf' ||
    lowerMediaType === 'text/rtf'
  ) {
    return true
  }

  const officeExtensions = [
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.odt',
    '.ods',
    '.odp',
    '.rtf',
  ]
  return officeExtensions.some((ext) => lowerFilename.endsWith(ext))
}

export function isHtmlDocument(mediaType?: string | null, filename?: string | null): boolean {
  const lowerMediaType = mediaType?.toLowerCase() || ''
  const lowerFilename = filename?.toLowerCase() || ''

  return (
    lowerMediaType === 'text/html' ||
    lowerFilename.endsWith('.html') ||
    lowerFilename.endsWith('.htm')
  )
}

export function isMarkdownDocument(mediaType?: string | null, filename?: string | null): boolean {
  const lowerMediaType = mediaType?.toLowerCase() || ''
  const lowerFilename = filename?.toLowerCase() || ''

  return (
    lowerMediaType === 'text/markdown' ||
    lowerMediaType === 'text/x-markdown' ||
    lowerFilename.endsWith('.md') ||
    lowerFilename.endsWith('.markdown')
  )
}

export function isCsvDocument(mediaType?: string | null, filename?: string | null): boolean {
  const lowerMediaType = mediaType?.toLowerCase() || ''
  const lowerFilename = filename?.toLowerCase() || ''

  return lowerMediaType === 'text/csv' || lowerFilename.endsWith('.csv')
}

export function getProxyType(
  mediaType?: string | null,
  filename?: string | null,
): ProxyType | null {
  const lowerMediaType = mediaType?.toLowerCase() || ''
  const lowerFilename = filename?.toLowerCase() || ''

  if (lowerMediaType.startsWith('image/') || lowerFilename.endsWith('.psd')) return 'image'
  if (lowerMediaType.startsWith('video/')) return 'video'
  if (lowerMediaType.startsWith('audio/')) return 'audio'

  if (
    lowerMediaType === 'application/pdf' ||
    lowerMediaType === 'text/plain' ||
    lowerFilename.endsWith('.pdf') ||
    lowerFilename.endsWith('.txt') ||
    isCsvDocument(mediaType, filename) ||
    isMarkdownDocument(mediaType, filename) ||
    isHtmlDocument(mediaType, filename) ||
    isOfficeDocument(mediaType, filename)
  ) {
    return 'pdf'
  }

  return null
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function detectSupportedMimeType(buffer: Uint8Array): string | null {
  if (startsWithAscii(buffer, 0, '8BPS')) {
    return 'image/vnd.adobe.photoshop'
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return buffer[3] === 0xf7 ? null : 'image/jpeg'
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return isPng(buffer) && !isAnimatedPng(buffer) ? 'image/png' : null
  }
  if (startsWithAscii(buffer, 0, 'GIF')) {
    return 'image/gif'
  }
  if (startsWithAscii(buffer, 0, 'RIFF') && startsWithAscii(buffer, 8, 'WEBP')) {
    return 'image/webp'
  }
  if (startsWithAscii(buffer, 4, 'ftyp')) {
    return 'video/mp4'
  }
  return null
}

function isPng(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 16 &&
    readUint32Be(buffer, PNG_SIGNATURE.length) === 13 &&
    startsWithAscii(buffer, 12, 'IHDR')
  )
}

function isAnimatedPng(buffer: Uint8Array): boolean {
  let offset = PNG_SIGNATURE.length
  while (offset + 8 <= buffer.length) {
    const chunkLength = readUint32Be(buffer, offset)
    const chunkTypeOffset = offset + 4
    if (startsWithAscii(buffer, chunkTypeOffset, 'acTL')) return true
    if (startsWithAscii(buffer, chunkTypeOffset, 'IDAT')) return false

    const nextOffset = offset + 8 + chunkLength + 4
    if (nextOffset <= offset || nextOffset > buffer.length) return false
    offset = nextOffset
  }
  return false
}

function readUint32Be(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] ?? 0) * 0x1000000 +
    ((buffer[offset + 1] ?? 0) << 16) +
    ((buffer[offset + 2] ?? 0) << 8) +
    (buffer[offset + 3] ?? 0)
  )
}

function startsWith(buffer: Uint8Array, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  return bytes.every((byte, index) => buffer[index] === byte)
}

function startsWithAscii(buffer: Uint8Array, offset: number, text: string): boolean {
  if (buffer.length < offset + text.length) return false
  for (let index = 0; index < text.length; index++) {
    if (buffer[offset + index] !== text.charCodeAt(index)) return false
  }
  return true
}
