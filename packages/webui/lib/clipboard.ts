/**
 * Copies text to clipboard across both HTTP (non-secure context) and HTTPS (secure context).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback if navigator.clipboard fails or permission is denied
    }
  }

  // Fallback for non-secure HTTP context using execCommand
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('Failed to copy text to clipboard:', err)
    return false
  }
}

/**
 * Copies text resolved asynchronously to clipboard, using ClipboardItem to preserve
 * Safari's transient user activation when fetching links.
 */
export async function copyToClipboardDeferred(textPromise: Promise<string>): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const blobPromise = textPromise.then((text) => {
        if (!text) throw new Error('EMPTY_TEXT')
        return new Blob([text], { type: 'text/plain' })
      })
      blobPromise.catch(() => {})

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': blobPromise,
        }),
      ])
      await textPromise
      return true
    } catch {
      // Fall back if deferred writing fails or is rejected
    }
  }

  try {
    const text = await textPromise
    if (!text) return false
    return await copyToClipboard(text)
  } catch (err) {
    console.error('Failed to copy deferred text to clipboard:', err)
    return false
  }
}

/**
 * Copies an image at a given URL (or promise resolving to URL) to the clipboard as PNG.
 */
export async function copyImageToClipboard(
  imageUrlOrPromise: string | Promise<string>,
): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false
  }

  const renderPngBlob = async (): Promise<Blob> => {
    const imageUrl = await imageUrlOrPromise
    const response = await fetch(imageUrl)
    const blob = await response.blob()

    const img = new Image()
    img.crossOrigin = 'anonymous'
    const objectUrl = URL.createObjectURL(blob)
    img.src = objectUrl

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = (e) => reject(new Error('Failed to load image: ' + String(e)))
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')
      ctx.drawImage(img, 0, 0)

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })

      if (!pngBlob) throw new Error('Failed to convert image to PNG')
      return pngBlob
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  try {
    const blobPromise = renderPngBlob()

    // Try passing promise to ClipboardItem (Safari / Chrome 86+) to preserve user activation
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blobPromise,
        }),
      ])
      return true
    } catch {
      // Fallback for environments requiring a concrete Blob in ClipboardItem
      const blob = await blobPromise
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])
      return true
    }
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err)
    return false
  }
}
