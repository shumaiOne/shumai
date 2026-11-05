// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { copyToClipboard, copyToClipboardDeferred, copyImageToClipboard } from './clipboard'

describe('copyToClipboard', () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    })
  })

  it('uses navigator.clipboard.writeText when available', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
      writable: true,
    })

    const success = await copyToClipboard('test text')
    expect(success).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('test text')
  })

  it('falls back to execCommand when navigator.clipboard is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const execCommandFn = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      value: execCommandFn,
      configurable: true,
      writable: true,
    })

    const success = await copyToClipboard('fallback text')
    expect(success).toBe(true)
    expect(execCommandFn).toHaveBeenCalledWith('copy')
  })
})

describe('copyToClipboardDeferred', () => {
  it('uses navigator.clipboard.write with ClipboardItem when available', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined)
    class MockClipboardItem {
      types: Record<string, unknown>
      constructor(types: Record<string, unknown>) {
        this.types = types
      }
    }

    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: MockClipboardItem,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'clipboard', {
      value: { write: mockWrite },
      configurable: true,
      writable: true,
    })

    const success = await copyToClipboardDeferred(Promise.resolve('deferred text'))
    expect(success).toBe(true)
    expect(mockWrite).toHaveBeenCalledTimes(1)
  })

  it('falls back to copyToClipboard when ClipboardItem is unavailable', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
      writable: true,
    })

    const success = await copyToClipboardDeferred(Promise.resolve('fallback deferred text'))
    expect(success).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('fallback deferred text')
  })
})

describe('copyImageToClipboard', () => {
  it('returns false when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const success = await copyImageToClipboard('http://example.com/image.png')
    expect(success).toBe(false)
  })

  it('accepts a Promise resolving to a URL and writes to clipboard', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined)
    class MockClipboardItem {
      types: Record<string, unknown>
      constructor(types: Record<string, unknown>) {
        this.types = types
      }
    }

    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: MockClipboardItem,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'clipboard', {
      value: { write: mockWrite },
      configurable: true,
      writable: true,
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(new Blob(['fake-image-bytes'], { type: 'image/webp' }))
    })

    const success = await copyImageToClipboard(Promise.resolve('http://example.com/image.png'))
    expect(success).toBe(true)
    expect(mockWrite).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
  })
})
