/**
 * Generates 1-gram, 2-gram, and 3-gram tokens for a given text.
 * Used for optimizing substring searches (especially for CJK characters).
 *
 * Examples:
 * "apple" -> a, p, l, e, ap, pp, pl, le, app, ppl, ple
 * "foo-bar" -> f, o, -, b, a, r, fo, oo, o-, -b, ba, ar, foo, oo-, o-b, -ba, bar
 */
export function generateNgrams(text: string): string[] {
  if (!text) return []

  const normalized = text.toLowerCase()
  const tokens = new Set<string>()
  const chars = Array.from(normalized) // Unicode-aware character splitting

  for (let i = 0; i < chars.length; i++) {
    // 1-gram
    tokens.add(chars[i])

    // 2-gram
    if (i + 1 < chars.length) {
      tokens.add(chars[i] + chars[i + 1])
    }

    // 3-gram
    if (i + 2 < chars.length) {
      tokens.add(chars[i] + chars[i + 1] + chars[i + 2])
    }
  }

  return Array.from(tokens)
}

/**
 * Generates only the longest possible n-grams for a search query.
 * If the word is 3+ chars, only return 3-grams.
 * If 2 chars, return 2-grams.
 * If 1 char, return 1-grams.
 *
 * This significantly improves search performance by reducing GIN index intersection overhead.
 */
export function generateSearchNgrams(text: string): string[] {
  if (!text) return []

  const normalized = text.toLowerCase()
  const tokens = new Set<string>()
  const chars = Array.from(normalized)
  const len = chars.length

  if (len >= 3) {
    for (let i = 0; i <= len - 3; i++) {
      tokens.add(chars[i] + chars[i + 1] + chars[i + 2])
    }
  } else if (len === 2) {
    tokens.add(chars[0] + chars[1])
  } else if (len === 1) {
    tokens.add(chars[0])
  }

  return Array.from(tokens)
}
