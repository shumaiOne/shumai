// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import React, { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelViewer } from './model-viewer'
import type { MediaController } from '../types'
import type { AssetInfo } from '@shumai/dtos'
import type { Annotation } from '@/ui/types'

vi.mock('@/ui/components/drawing-canvas', () => ({
  default: (props: { annotations?: unknown[] }) => (
    <div data-testid="drawing-canvas" data-annotation-count={props.annotations?.length ?? 0} />
  ),
}))

vi.mock('@/ui/paraglide/messages.js', () => ({
  m: new Proxy({}, { get: () => () => '' }),
}))

const mockFileDownloadPost = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ url: 'https://example.com/download-model.glb' }),
})
const mockShareDownloadPost = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ url: 'https://example.com/share-download-model.glb' }),
})

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        'download-url': {
          $post: (...args: unknown[]) => mockFileDownloadPost(...args),
        },
      },
      shares: {
        ':shareId': {
          files: {
            ':fileId': {
              'download-url': {
                $post: (...args: unknown[]) => mockShareDownloadPost(...args),
              },
            },
          },
        },
      },
    },
  },
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

  it('prioritizes videoTranscodes URL over videoPreview URL for watermarked share compatibility', () => {
    const fileWithBoth = {
      ...mockAsset,
      media: {
        ...mockAsset.media,
        videoPreview: { url: 'https://example.com/unwatermarked-turntable.mp4' },
        videoTranscodes: [{ url: 'https://example.com/watermarked-turntable.mp4' }],
      },
    } as unknown as AssetInfo

    const { container } = render(<ModelViewer file={fileWithBoth} />)
    const video = container.querySelector('video')
    expect(video?.getAttribute('src')).toBe('https://example.com/watermarked-turntable.mp4')
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

  it('zooms viewer and prevents browser default on touchpad pinch (ctrl+wheel)', () => {
    const { getByTestId, getByRole } = render(<ModelViewer file={mockAsset} />)
    const surface = getByTestId('model-viewer-surface')
    const resetZoomBtn = getByRole('button', { name: 'Reset zoom' })

    const initialZoomText = resetZoomBtn.textContent

    surface.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(wheelEvent, 'ctrlKey', { value: true })
    Object.defineProperty(wheelEvent, 'clientX', { value: 400 })
    Object.defineProperty(wheelEvent, 'clientY', { value: 300 })

    let notPrevented = true
    act(() => {
      notPrevented = surface.dispatchEvent(wheelEvent)
    })

    expect(notPrevented).toBe(false)
    expect(resetZoomBtn.textContent).not.toBe(initialZoomText)
  })

  it('pans viewer content and prevents scroll on two-finger wheel when zoomed in', () => {
    const { getByTestId, getByRole } = render(<ModelViewer file={mockAsset} />)
    const surface = getByTestId('model-viewer-surface')
    const zoomInBtn = getByRole('button', { name: 'Zoom in' })

    // Zoom in multiple times so zoom exceeds baseScale significantly
    fireEvent.click(zoomInBtn)
    fireEvent.click(zoomInBtn)
    fireEvent.click(zoomInBtn)

    const mediaWrapper = surface.querySelector('div.absolute.pointer-events-none') as HTMLElement
    const initialTransform = mediaWrapper.style.transform

    const scrollEvent = new WheelEvent('wheel', {
      deltaX: 20,
      deltaY: 30,
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(scrollEvent, 'ctrlKey', { value: false })

    let notPrevented = true
    act(() => {
      notPrevented = surface.dispatchEvent(scrollEvent)
    })

    expect(notPrevented).toBe(false)
    expect(mediaWrapper.style.transform).not.toBe(initialTransform)
  })

  it('keeps video loop attribute disabled when paused to prevent browser EOF reset, and enables loop when playing', () => {
    const { container } = render(<ModelViewer file={mockAsset} />)
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeDefined()

    // Paused initially: loop should be false so seeking to final frame does not trigger browser loop-reset
    expect(video.loop).toBe(false)

    // Play: loop should become true
    fireEvent.play(video)
    expect(video.loop).toBe(true)

    // Pause: loop should become false again
    fireEvent.pause(video)
    expect(video.loop).toBe(false)
  })

  it('seeks safely to 345° without touching 4.0s EOF boundary', () => {
    const onTimeUpdate = vi.fn()
    const { container, getByTestId } = render(
      <ModelViewer file={mockAsset} onTimeUpdate={onTimeUpdate} />,
    )
    const video = container.querySelector('video') as HTMLVideoElement
    const degreeReadout = getByTestId('degree-readout')

    // At 0°, press ArrowLeft to rotate counterclockwise to 345° (Frame 23)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    // Target time should be 23 / 6s = 3.8333s
    expect(onTimeUpdate).toHaveBeenCalledWith(expect.closeTo(23 / 6, 2))
    // Video currentTime should be safely offset from 4.0s EOF (3.875s)
    expect(video.currentTime).toBeCloseTo(3.875, 3)
    expect(video.currentTime).toBeLessThan(4.0)
    expect(degreeReadout.textContent).toContain('345° / 360°')
  })

  it('downloads the original model via files download-url endpoint when Download asset is clicked', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { getByTitle } = render(<ModelViewer file={mockAsset} />)
    const downloadBtn = getByTitle('Download asset')
    expect(downloadBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(downloadBtn)
    })

    expect(mockFileDownloadPost).toHaveBeenCalledWith({
      json: { key: 'files/robot.glb', assetId: 'asset-3d-1' },
    })
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('downloads the model via shares download-url endpoint when shareId is provided', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { getByTitle } = render(<ModelViewer file={mockAsset} shareId="share-test-123" />)
    const downloadBtn = getByTitle('Download asset')
    expect(downloadBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(downloadBtn)
    })

    expect(mockShareDownloadPost).toHaveBeenCalledWith({
      param: { shareId: 'share-test-123', fileId: 'asset-3d-1' },
      json: { key: 'files/robot.glb' },
    })
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('hides the download button when allowDownload is false', () => {
    const { queryByTitle } = render(<ModelViewer file={mockAsset} allowDownload={false} />)
    expect(queryByTitle('Download asset')).toBeNull()
  })

  it('hides the download button when original key is missing', () => {
    const assetWithoutOriginal = {
      ...mockAsset,
      media: {
        ...mockAsset.media,
        original: undefined,
      },
    } as unknown as AssetInfo

    const { queryByTitle } = render(<ModelViewer file={assetWithoutOriginal} />)
    expect(queryByTitle('Download asset')).toBeNull()
  })

  describe('onSeek callback for rotation interactions', () => {
    it('calls onSeek when dragging the viewer surface to rotate', () => {
      const onSeek = vi.fn()
      const { getByTestId } = render(<ModelViewer file={mockAsset} onSeek={onSeek} />)
      const surface = getByTestId('model-viewer-surface')

      // Pointer down at x=100
      fireEvent.pointerDown(surface, {
        button: 0,
        clientX: 100,
        pointerId: 1,
      })
      expect(onSeek).not.toHaveBeenCalled()

      // Drag right by +24px (2 frames rotation)
      fireEvent.pointerMove(surface, {
        clientX: 124,
        pointerId: 1,
      })
      expect(onSeek).toHaveBeenCalledTimes(1)
    })

    it('calls onSeek when changing degree via slider', () => {
      const onSeek = vi.fn()
      const { getByTestId } = render(<ModelViewer file={mockAsset} onSeek={onSeek} />)
      const minusBtn = getByTestId('ruler-step-minus')
      expect(minusBtn).toBeDefined()

      fireEvent.click(minusBtn)
      expect(onSeek).toHaveBeenCalledTimes(1)
    })

    it('calls onSeek when pressing keyboard arrow keys to rotate', () => {
      const onSeek = vi.fn()
      render(<ModelViewer file={mockAsset} onSeek={onSeek} />)

      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(onSeek).toHaveBeenCalledTimes(1)

      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(onSeek).toHaveBeenCalledTimes(2)
    })

    it('does not call onSeek when programmatic seekTo is called via ref', () => {
      const onSeek = vi.fn()
      const ref = createRef<MediaController>()
      render(<ModelViewer ref={ref} file={mockAsset} onSeek={onSeek} />)

      act(() => {
        ref.current?.seekTo(1.5)
      })

      expect(onSeek).not.toHaveBeenCalled()
    })

    it('clears displayed annotations when container onSeek empties annotations prop upon rotation', () => {
      const initialAnnotation: Annotation = {
        type: 'arrow',
        color: '#ef4444',
        points: [
          [0, 0],
          [100, 100],
        ],
      }
      function Harness() {
        const [annotations, setAnnotations] = React.useState<Annotation[]>([initialAnnotation])
        return (
          <ModelViewer
            file={mockAsset}
            annotations={annotations}
            onSeek={() => setAnnotations([])}
          />
        )
      }

      const { getByTestId } = render(<Harness />)
      const canvas = getByTestId('drawing-canvas')
      expect(canvas.getAttribute('data-annotation-count')).toBe('1')

      // Rotate via ruler step minus
      fireEvent.click(getByTestId('ruler-step-minus'))

      // Markup annotation disappears
      expect(canvas.getAttribute('data-annotation-count')).toBe('0')
    })
  })
})
