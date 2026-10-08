// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import React, { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelViewer } from './model-viewer'
import type { MediaController } from '../types'
import type { AssetInfo } from '@shumai/dtos'

vi.mock('@/ui/components/drawing-canvas', () => ({
  default: () => <div data-testid="drawing-canvas" />,
}))

vi.mock('@/ui/paraglide/messages.js', () => ({
  m: new Proxy({}, { get: () => () => '' }),
}))

class MockResizeObserver {
  observe = vi.fn(() => {
    // Immediate callback with mock size
    this.callback(
      [{ contentRect: { width: 800, height: 600 } } as unknown as ResizeObserverEntry],
      this,
    )
  })
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(private callback: ResizeObserverCallback) {}
}

const mockAsset: AssetInfo = {
  id: 'asset-3d-1',
  name: 'robot.glb',
  proxyType: '3d',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  type: 'file',
  sizeByte: 1024,
  fileCount: 1,
  status: 'processed',
  projectId: 'proj-1',
  media: {
    videoPreview: {
      url: 'https://example.com/robot-turntable.mp4',
    },
    original: {
      key: 'files/robot.glb',
    },
    metadata: {
      originalWidth: 1080,
      originalHeight: 1080,
    },
  },
  preview: {
    thumbnailUrl: 'https://example.com/robot-poster.webp',
  },
} as unknown as AssetInfo

describe('ModelViewer', () => {
  beforeEach(() => {
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders model viewer container, surface, video, and control bar', () => {
    const { getByTestId, getByText } = render(<ModelViewer file={mockAsset} />)

    expect(getByTestId('model-viewer-container')).toBeDefined()
    expect(getByTestId('model-viewer-surface')).toBeDefined()
    expect(getByTestId('drawing-canvas')).toBeDefined()
    // Control bar shows 0° / 360° initially
    expect(getByText(/0°\s*\/\s*360°/)).toBeDefined()
  })

  it('toggles play/pause via spacebar hotkey', () => {
    const onPlay = vi.fn()
    const onPause = vi.fn()
    const { container } = render(<ModelViewer file={mockAsset} onPlay={onPlay} onPause={onPause} />)

    const video = container.querySelector('video')
    expect(video).toBeDefined()

    // Space key triggers togglePlay
    fireEvent.keyDown(window, { key: ' ' })
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()

    // Simulate video playing event
    if (video) {
      fireEvent.play(video)
      expect(onPlay).toHaveBeenCalled()
    }
  })

  it('seeks frames via arrow hotkeys', () => {
    const onTimeUpdate = vi.fn()
    render(<ModelViewer file={mockAsset} onTimeUpdate={onTimeUpdate} />)

    // Press ArrowRight -> advance 1 frame (15 deg = 1/6 sec = ~0.1667)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(1 / 6, 2))

    // Press ArrowLeft -> back 1 frame (frame 0 = 0 sec)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onTimeUpdate).toHaveBeenCalledWith(0)
  })

  it('handles pointer dragging to rotate 3D asset', () => {
    const onTimeUpdate = vi.fn()
    const { getByTestId } = render(<ModelViewer file={mockAsset} onTimeUpdate={onTimeUpdate} />)

    const surface = getByTestId('model-viewer-surface')
    // Mock setPointerCapture / releasePointerCapture
    surface.setPointerCapture = vi.fn()
    surface.releasePointerCapture = vi.fn()

    // Start drag at x = 100
    fireEvent.pointerDown(surface, { clientX: 100, button: 0, pointerId: 1 })
    expect(surface.setPointerCapture).toHaveBeenCalledWith(1)

    // Move right by 24px (+2 frames = +30 deg)
    fireEvent.pointerMove(surface, { clientX: 124, button: 0, pointerId: 1 })
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(2 / 6, 2))

    // Release drag
    fireEvent.pointerUp(surface, { clientX: 124, button: 0, pointerId: 1 })
    expect(surface.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('exposes imperative media controller via ref', () => {
    const ref = createRef<MediaController>()
    render(<ModelViewer ref={ref} file={mockAsset} />)

    expect(ref.current).toBeDefined()
    expect(ref.current?.getDuration?.()).toBe(4)
    expect(typeof ref.current?.getCurrentTime?.()).toBe('number')

    ref.current?.play()
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()

    ref.current?.pause()
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()

    ref.current?.seekTo(1) // 1 second -> frame 6 -> 1 second
    expect(ref.current?.getCurrentTime?.()).toBeDefined()
  })

  it('resets rotation to 0° when reset button is clicked', () => {
    const onTimeUpdate = vi.fn()
    const { getByRole } = render(
      <ModelViewer file={mockAsset} startTime={1} onTimeUpdate={onTimeUpdate} />,
    )

    // Reset rotation button has aria-label 'Reset rotation to 0°'
    const resetBtn = getByRole('button', { name: /Reset rotation/i })
    fireEvent.click(resetBtn)
    expect(onTimeUpdate).toHaveBeenCalledWith(0)
  })

  it('renders children alongside viewer surface when provided', () => {
    const { getByTestId } = render(
      <ModelViewer file={mockAsset}>
        <div data-testid="test-sidebar">Sidebar</div>
      </ModelViewer>,
    )

    expect(getByTestId('test-sidebar')).toBeDefined()
    expect(getByTestId('model-viewer-surface')).toBeDefined()
  })
})
