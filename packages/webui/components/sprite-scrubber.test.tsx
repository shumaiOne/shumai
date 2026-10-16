// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpriteScrubber } from './sprite-scrubber'
import { FilePreview } from './file-browser/file-preview'

class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

describe('SpriteScrubber', () => {
  afterEach(() => {
    cleanup()
  })

  it('scrubs forward by default when hovering from left to right', () => {
    const { getByTestId } = render(
      <SpriteScrubber
        spriteUrl="https://example.com/sprite.webp"
        thumbnailUrl="https://example.com/thumb.webp"
        videoWidth={1080}
        videoHeight={1080}
      />,
    )

    const scrubber = getByTestId('sprite-scrubber')
    vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // At x = 0 (left edge): frame 0
    fireEvent.mouseMove(scrubber, { clientX: 0 })
    expect(scrubber.getAttribute('data-frame')).toBe('0')

    // At x = 50 (middle): frame 50
    fireEvent.mouseMove(scrubber, { clientX: 50 })
    expect(scrubber.getAttribute('data-frame')).toBe('50')

    // At x = 99 (near right edge): frame 99
    fireEvent.mouseMove(scrubber, { clientX: 99 })
    expect(scrubber.getAttribute('data-frame')).toBe('99')
  })

  it('scrubs in reverse when reverse={true} (moving right decreases frame index)', () => {
    const { getByTestId } = render(
      <SpriteScrubber
        spriteUrl="https://example.com/sprite.webp"
        thumbnailUrl="https://example.com/thumb.webp"
        videoWidth={1080}
        videoHeight={1080}
        reverse={true}
      />,
    )

    const scrubber = getByTestId('sprite-scrubber')
    vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // At x = 0 (left edge): frame 99
    fireEvent.mouseMove(scrubber, { clientX: 0 })
    expect(scrubber.getAttribute('data-frame')).toBe('99')

    // At x = 25: frame 74 (rotated right / CCW)
    fireEvent.mouseMove(scrubber, { clientX: 25 })
    expect(scrubber.getAttribute('data-frame')).toBe('74')

    // At x = 50: frame 49
    fireEvent.mouseMove(scrubber, { clientX: 50 })
    expect(scrubber.getAttribute('data-frame')).toBe('49')

    // At x = 99 (right edge): frame 0
    fireEvent.mouseMove(scrubber, { clientX: 99 })
    expect(scrubber.getAttribute('data-frame')).toBe('0')
  })

  it('FilePreview passes reverse={true} for 3D assets and reverse={false} for video assets', () => {
    const asset3D = {
      proxyType: '3d' as const,
      preview: {
        proxyType: '3d' as const,
        spriteUrl: 'https://example.com/3d-sprite.webp',
        thumbnailUrl: 'https://example.com/3d-poster.webp',
        originalWidth: 1080,
        originalHeight: 1080,
      },
    }

    const { getByTestId, unmount } = render(<FilePreview item={asset3D} />)
    const scrubber3D = getByTestId('sprite-scrubber')
    vi.spyOn(scrubber3D, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // Moving right decreases frame index for 3D assets
    fireEvent.mouseMove(scrubber3D, { clientX: 25 })
    expect(scrubber3D.getAttribute('data-frame')).toBe('74')

    unmount()

    const assetVideo = {
      proxyType: 'video' as const,
      preview: {
        proxyType: 'video' as const,
        spriteUrl: 'https://example.com/video-sprite.webp',
        thumbnailUrl: 'https://example.com/video-poster.webp',
        originalWidth: 1920,
        originalHeight: 1080,
      },
    }

    const { getByTestId: getVideoScrubber } = render(<FilePreview item={assetVideo} />)
    const scrubberVideo = getVideoScrubber('sprite-scrubber')
    vi.spyOn(scrubberVideo, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // Moving right increases frame index for video assets
    fireEvent.mouseMove(scrubberVideo, { clientX: 25 })
    expect(scrubberVideo.getAttribute('data-frame')).toBe('25')
  })

  it('renders with cursor-pointer instead of cursor-crosshair for cards', () => {
    const { getByTestId } = render(
      <SpriteScrubber
        spriteUrl="https://example.com/sprite.webp"
        thumbnailUrl="https://example.com/thumb.webp"
        videoWidth={1920}
        videoHeight={1080}
      />,
    )

    const scrubber = getByTestId('sprite-scrubber')
    expect(scrubber.className).toContain('cursor-pointer')
    expect(scrubber.className).not.toContain('cursor-crosshair')
  })
})
