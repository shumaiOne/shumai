// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { copyToClipboard } from './clipboard'

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
