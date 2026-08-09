/**
 * Calculates the start and end selection range for a file name to exclude its extension.
 * e.g. "test.png" -> [0, 4] ("test")
 * e.g. "archive.tar.gz" -> [0, 11] ("archive.tar")
 * e.g. "file_without_ext" -> [0, 16] ("file_without_ext")
 * e.g. ".gitignore" -> [0, 10] (".gitignore")
 */
export function getFileNameBaseRange(name: string): [number, number] {
  const lastDotIndex = name.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return [0, lastDotIndex]
  }
  return [0, name.length]
}

/**
 * Focuses the input element and selects the base file name, excluding the extension.
 */
export function selectFileNameWithoutExtension(input: HTMLInputElement) {
  input.focus()
  const [start, end] = getFileNameBaseRange(input.value)
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(start, end)
  } else {
    input.select()
  }
}
