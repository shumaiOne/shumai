// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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
    const { container, getByTestId, getByText } = render(<ModelViewer file={mockAsset} />)

    expect(getByTestId('model-viewer-container')).toBeDefined()
    expect(getByTestId('model-viewer-surface')).toBeDefined()
    expect(getByTestId('drawing-canvas')).toBeDefined()
    // Control bar shows 0° / 360° initially
    expect(getByText(/0°\s*\/\s*360°/)).toBeDefined()
    // Video does not use low-res poster
    expect(container.querySelector('video')?.getAttribute('poster')).toBeNull()
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

    // Press ArrowRight second time -> advance to frame 2 (30 deg = 2/6 sec)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(2 / 6, 2))

    // Press ArrowLeft -> back 1 frame (frame 1 = 1/6 sec)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(1 / 6, 2))

    // Press ArrowLeft -> back 1 frame (frame 0 = 0 sec)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onTimeUpdate).toHaveBeenCalledWith(0)
  })

  it('handles pointer dragging to rotate 3D asset (drag right rotates counterclockwise)', () => {
    const onTimeUpdate = vi.fn()
    const { getByTestId } = render(<ModelViewer file={mockAsset} onTimeUpdate={onTimeUpdate} />)

    const surface = getByTestId('model-viewer-surface')
    // Mock setPointerCapture / releasePointerCapture
    surface.setPointerCapture = vi.fn()
    surface.releasePointerCapture = vi.fn()

    // Start drag at x = 100
    fireEvent.pointerDown(surface, { clientX: 100, button: 0, pointerId: 1 })
    expect(surface.setPointerCapture).toHaveBeenCalledWith(1)

    // Move right by 24px (drag right rotates counterclockwise: frame 0 - 2 = 22 frames = 22/6s)
    fireEvent.pointerMove(surface, { clientX: 124, button: 0, pointerId: 1 })
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(22 / 6, 2))

    // Move left by 24px from origin (frame 0 - (-2) = 2 frames = 2/6s)
    fireEvent.pointerMove(surface, { clientX: 76, button: 0, pointerId: 1 })
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(2 / 6, 2))

    // Release drag
    fireEvent.pointerUp(surface, { clientX: 76, button: 0, pointerId: 1 })
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

  it('renders children alongside viewer surface when provided', () => {
    const { getByTestId } = render(
      <ModelViewer file={mockAsset}>
        <div data-testid="test-sidebar">Sidebar</div>
      </ModelViewer>,
    )

    expect(getByTestId('test-sidebar')).toBeDefined()
    expect(getByTestId('model-viewer-surface')).toBeDefined()
  })

  it('steps rotation by 15° forward and backward via plus and minus buttons', () => {
    const onTimeUpdate = vi.fn()
    const { getByTestId } = render(
      <ModelViewer file={mockAsset} startTime={0} onTimeUpdate={onTimeUpdate} />,
    )

    const plusBtn = getByTestId('ruler-step-plus')
    const minusBtn = getByTestId('ruler-step-minus')

    // Click plus button at 0° -> seeks to 15° (frame 1, 1/6s)
    fireEvent.click(plusBtn)
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(1 / 6, 2))

    // Click minus button at 0° (or current) -> wraps backward
    fireEvent.click(minusBtn)
    expect(onTimeUpdate).toHaveBeenCalledWith(0)
  })

  it('updates playback smoothly on each frame via requestVideoFrameCallback without skipping degrees', () => {
    let frameCallback: ((now: number, metadata: { mediaTime: number }) => void) | null = null
    const rvfcMock = vi.fn().mockImplementation((cb) => {
      frameCallback = cb
      return 101
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(HTMLVideoElement.prototype as any).requestVideoFrameCallback = rvfcMock

    const onTimeUpdate = vi.fn()
    const { container, getByTestId } = render(
      <ModelViewer file={mockAsset} onTimeUpdate={onTimeUpdate} />,
    )

    const video = container.querySelector('video')
    expect(video).toBeDefined()

    // Start playing
    fireEvent.play(video!)
    expect(rvfcMock).toHaveBeenCalled()

    // Simulate decoded frames arriving sequentially at 6 FPS (every 1/6 second)
    const degreeReadout = getByTestId('degree-readout')

    // Frame 0: 0.083s -> 0°
    act(() => {
      frameCallback!(100, { mediaTime: 0.083 })
    })
    expect(degreeReadout.textContent).toContain('0° / 360°')

    // Frame 1: 0.25s -> 15°
    act(() => {
      frameCallback!(267, { mediaTime: 0.25 })
    })
    expect(degreeReadout.textContent).toContain('15° / 360°')

    // Frame 2: 0.417s -> 30°
    act(() => {
      frameCallback!(433, { mediaTime: 0.417 })
    })
    expect(degreeReadout.textContent).toContain('30° / 360°')

    // Frame 3: 0.583s -> 45°
    act(() => {
      frameCallback!(600, { mediaTime: 0.583 })
    })
    expect(degreeReadout.textContent).toContain('45° / 360°')

    // Frame 4: 0.75s -> 60°
    act(() => {
      frameCallback!(767, { mediaTime: 0.75 })
    })
    expect(degreeReadout.textContent).toContain('60° / 360°')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback
  })

  it('cancels frame callback loop when video is paused', () => {
    const cancelMock = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(HTMLVideoElement.prototype as any).requestVideoFrameCallback = vi.fn().mockReturnValue(123)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(HTMLVideoElement.prototype as any).cancelVideoFrameCallback = cancelMock

    const { container } = render(<ModelViewer file={mockAsset} />)
    const video = container.querySelector('video')

    fireEvent.play(video!)
    fireEvent.pause(video!)

    expect(cancelMock).toHaveBeenCalledWith(123)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLVideoElement.prototype as any).cancelVideoFrameCallback
  })
})
