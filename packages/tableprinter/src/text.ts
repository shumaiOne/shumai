/* eslint-disable no-control-regex */
export function stripAnsi(str: string): string {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  )
}

export function displayWidth(str: string): number {
  const stripped = stripAnsi(str)
  let width = 0
  for (let i = 0; i < stripped.length; i++) {
    const code = stripped.charCodeAt(i)
    // Basic detection for CJK Unified Ideographs, Hangul, Hiragana, Katakana, Fullwidth
    if (
      (code >= 0x3000 && code <= 0x9fff) || // CJK symbols, Hiragana, Katakana, Unified Ideographs
      (code >= 0xff00 && code <= 0xffef) || // Fullwidth forms
      (code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
      (code >= 0xac00 && code <= 0xd7af) // Hangul Syllables
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

export function truncate(width: number, s: string): string {
  const stripped = stripAnsi(s)
  const visualWidth = displayWidth(stripped)
  if (visualWidth <= width) {
    return s
  }

  // If width is too small, return part of ellipses
  if (width <= 3) {
    return '.'.repeat(width)
  }

  const targetWidth = width - 3 // save space for "..."
  let currentWidth = 0
  let cutIndex = 0

  for (let i = 0; i < s.length; i++) {
    // If we hit an ANSI escape sequence, skip it in width calculation but keep it in output
    if (s[i] === '\u001b') {
      // Find end of ANSI sequence
      const match = s
        .slice(i)
        .match(/^[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/)
      if (match) {
        i += match[0].length - 1
        continue
      }
    }

    const code = s.charCodeAt(i)
    const charWidth =
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0xac00 && code <= 0xd7af)
        ? 2
        : 1

    if (currentWidth + charWidth > targetWidth) {
      cutIndex = i
      break
    }
    currentWidth += charWidth
  }

  const sliced = s.slice(0, cutIndex)
  const resetCode = s.includes('\u001b') ? '\u001b[0m' : ''
  return sliced + '...' + resetCode
}

export function padRight(width: number, s: string): string {
  const currentWidth = displayWidth(s)
  if (currentWidth >= width) {
    return s
  }
  return s + ' '.repeat(width - currentWidth)
}
