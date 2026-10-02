// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VideoViewer from './video-viewer'
import type { AssetInfo } from '@shumai/dtos'

const { mockHlsInstance, mockHlsConstructor } = vi.hoisted(() => {
  const instance = {
    attachMedia: vi.fn(),
    loadSource: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    destroy: vi.fn(),
    levels: [
      { height: 1080, width: 1920, bitrate: 5000000 },
      { height: 720, width: 1280, bitrate: 2500000 },
    ],
    currentLevel: -1,
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
  }
  const constructor = vi.fn(function () {
    return instance
  })
  return { mockHlsInstance: instance, mockHlsConstructor: constructor }
})

vi.mock('hls.js', () => {
  const MockHls = mockHlsConstructor
  // @ts-expect-error adding static mock property
  MockHls.isSupported = vi.fn(() => true)
  // @ts-expect-error adding static mock property
  MockHls.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    LEVEL_SWITCHED: 'hlsLevelSwitched',
    ERROR: 'hlsError',
  }
  // @ts-expect-error adding static mock property
  MockHls.ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
    OTHER_ERROR: 'otherError',
  }
  return {
    default: MockHls,
  }
})

vi.mock('@/ui/components/drawing-canvas', () => ({
  default: () => <div data-testid="drawing-canvas" />,
}))

vi.mock('@/ui/paraglide/messages.js', () => ({
  m: new Proxy({}, { get: () => () => '' }),
}))

describe('VideoViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHlsInstance.currentLevel = -1
  })

  afterEach(() => {
    cleanup()
  })

  it('reloads video player with new video source when file prop changes without unmounting', () => {
    const videoA: AssetInfo = {
      id: 'video-a',
      name: 'video-a.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1280,
          originalHeight: 720,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '720p',
            url: 'https://cdn.example.com/videoA-720p.mp4',
            width: 1280,
            height: 720,
          },
        ],
      },
    } as unknown as AssetInfo

    const videoB: AssetInfo = {
      id: 'video-b',
      name: 'video-b.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 25,
          frameRate: 30,
          totalFrames: 750,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/videoB-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container, rerender } = render(<VideoViewer file={videoA} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

    // Initial render should set video element src with video A URL
    expect(video.src).toBe('https://cdn.example.com/videoA-720p.mp4')

    // Rerender with video B (simulating selecting another video from the carousel)
    rerender(<VideoViewer file={videoB} />)

    // Native video element should now have video B's URL
    expect(video.src).toBe('https://cdn.example.com/videoB-1080p.mp4')
  })

  it('initializes video when transcode URL becomes available after initially empty with same ID', () => {
    const initialVideo: AssetInfo = {
      id: 'video-pending',
      name: 'pending.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: undefined as unknown as string,
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const detailedVideo: AssetInfo = {
      ...initialVideo,
      media: {
        ...initialVideo.media,
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/signed-pending-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container, rerender } = render(<VideoViewer file={initialVideo} autoPlay={true} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

    // Initially targetSrc is empty, video.src should be empty
    expect(video.src).toBe('')

    // Rerender with detailedVideo (same id, but signed URL now available)
    rerender(<VideoViewer file={detailedVideo} autoPlay={true} />)

    // Video element should now have the newly available signed URL
    expect(video.src).toBe('https://cdn.example.com/signed-pending-1080p.mp4')
  })

  it('auto-selects HDR proxy when display supports HDR (dynamic-range: high)', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(dynamic-range: high)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const hdrVideo: AssetInfo = {
      id: 'video-hdr',
      name: 'video-hdr.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/video-1080p.mp4',
            width: 1920,
            height: 1080,
            hdr: false,
          },
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/video-1080p-hdr.mp4',
            width: 1920,
            height: 1080,
            hdr: true,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={hdrVideo} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

    expect(video.src).toBe('https://cdn.example.com/video-1080p-hdr.mp4')

    window.matchMedia = originalMatchMedia
  })

  it('auto-selects SDR proxy when display does not support HDR', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const hdrVideo: AssetInfo = {
      id: 'video-sdr-fallback',
      name: 'video-sdr-fallback.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/video-1080p.mp4',
            width: 1920,
            height: 1080,
            hdr: false,
          },
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/video-1080p-hdr.mp4',
            width: 1920,
            height: 1080,
            hdr: true,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={hdrVideo} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

    expect(video.src).toBe('https://cdn.example.com/video-1080p.mp4')

    window.matchMedia = originalMatchMedia
  })

  it('shows play button and darkened overlay initially, but never again after playing (even when paused or scrubbed back to start)', () => {
    const testVideo: AssetInfo = {
      id: 'test-video-lifecycle',
      name: 'test.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/test-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={testVideo} />)
    const videoArea = container.querySelector('[data-testid="video-area"]')
    const video = videoArea?.querySelector('video') as HTMLVideoElement
    expect(videoArea).toBeTruthy()
    expect(video).toBeTruthy()

    // 1. Initially (before playing): play button & 20% black tint are present
    expect(videoArea?.querySelector('.bg-black\\/20')).not.toBeNull()

    // 2. Start playback
    act(() => {
      video.dispatchEvent(new Event('play'))
    })
    expect(videoArea?.querySelector('.bg-black\\/20')).toBeNull()

    // 3. Pause video: overlay must NOT show again
    act(() => {
      video.dispatchEvent(new Event('pause'))
    })
    expect(videoArea?.querySelector('.bg-black\\/20')).toBeNull()

    // 4. Drag seekbar / time back to 0: overlay must STILL NOT show
    act(() => {
      video.dispatchEvent(new Event('timeupdate'))
    })
    expect(videoArea?.querySelector('.bg-black\\/20')).toBeNull()
  })

  it('initializes Hls.js with capLevelToPlayerSize false when video is HLS', () => {
    const hlsVideo: AssetInfo = {
      id: 'video-hls',
      name: 'video-hls.m3u8',
      proxyType: 'video',
      media: {
        isHls: true,
        hls: {
          key: 'hls-key',
          url: 'https://cdn.example.com/master.m3u8',
          resolutions: [
            { width: 1920, height: 1080, resolution: '1080p' },
            { width: 1280, height: 720, resolution: '720p' },
          ],
        },
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={hlsVideo} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

    expect(mockHlsConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        autoStartLoad: true,
        startLevel: -1,
        capLevelToPlayerSize: false,
        enableWorker: true,
      }),
    )
    expect(mockHlsInstance.attachMedia).toHaveBeenCalledWith(video)
    expect(mockHlsInstance.loadSource).toHaveBeenCalledWith('https://cdn.example.com/master.m3u8')
  })

  it('switches HLS resolution immediately using currentLevel', () => {
    const hlsVideo: AssetInfo = {
      id: 'video-hls-switch',
      name: 'video-hls-switch.m3u8',
      proxyType: 'video',
      media: {
        isHls: true,
        hls: {
          key: 'hls-key',
          url: 'https://cdn.example.com/master.m3u8',
          resolutions: [
            { width: 1920, height: 1080, resolution: '1080p' },
            { width: 1280, height: 720, resolution: '720p' },
          ],
        },
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={hlsVideo} />)

    // Open settings / quality dropdown
    const settingsButton = container.querySelector('button:has(.lucide-settings)')
    expect(settingsButton).toBeTruthy()
    fireEvent.pointerDown(settingsButton!, { pointerType: 'mouse', button: 0 })
    fireEvent.click(settingsButton!)

    // Click 720p (index 1 in levels: 1080p is index 0, 720p is index 1)
    const items = document.querySelectorAll('[role="menuitem"]')
    const item720p = Array.from(items).find((el) => el.textContent?.includes('720p'))
    expect(item720p).toBeTruthy()

    act(() => {
      fireEvent.click(item720p!)
    })

    // currentLevel should be set immediately to 1 (720p)
    expect(mockHlsInstance.currentLevel).toBe(1)

    // Click Auto
    const itemAuto = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent?.includes('Auto') || el.textContent === '',
    )
    if (itemAuto) {
      act(() => {
        fireEvent.click(itemAuto)
      })
      // Auto should reset currentLevel to -1
      expect(mockHlsInstance.currentLevel).toBe(-1)
    }
  })

  it('does not hijack subsequent seeks if paused HLS switch did not emit seeked', () => {
    vi.useFakeTimers()
    try {
      const hlsVideo: AssetInfo = {
        id: 'video-hls-stale-seek',
        name: 'video-hls-stale-seek.m3u8',
        proxyType: 'video',
        media: {
          isHls: true,
          hls: {
            key: 'hls-key',
            url: 'https://cdn.example.com/master.m3u8',
            resolutions: [
              { width: 1920, height: 1080, resolution: '1080p' },
              { width: 1280, height: 720, resolution: '720p' },
            ],
          },
          metadata: {
            originalWidth: 1920,
            originalHeight: 1080,
            duration: 10,
            frameRate: 30,
            totalFrames: 300,
          },
        },
      } as unknown as AssetInfo

      const { container } = render(<VideoViewer file={hlsVideo} />)
      const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

      // Video is paused at 0s (frame 0)
      Object.defineProperty(video, 'paused', { value: true, configurable: true })
      video.currentTime = 0

      // Open settings and click 720p
      const settingsButton = container.querySelector('button:has(.lucide-settings)')
      fireEvent.pointerDown(settingsButton!, { pointerType: 'mouse', button: 0 })
      fireEvent.click(settingsButton!)
      const item720p = Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) =>
        el.textContent?.includes('720p'),
      )
      act(() => {
        fireEvent.click(item720p!)
      })

      // Simulate that no seeked event occurred within the timeout (e.g. 1500ms elapses)
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Now user performs an unrelated seek to frame 150 (currentTime = 5.0)
      video.currentTime = 5.0
      act(() => {
        fireEvent(video, new Event('seeked'))
      })

      // video.currentTime must remain at frame 150, NOT rewound to frame 0
      expect(Math.floor(video.currentTime * 30 + 0.001)).toBe(150)
      expect(video.currentTime).toBeCloseTo(5.0167, 3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('displays 2160p instead of 3840p for 4K vertical video when HLS switches level on Auto', () => {
    mockHlsInstance.levels = [{ height: 3840, width: 2160, bitrate: 10000000 }]

    const hlsVideo: AssetInfo = {
      id: 'video-hls-vertical-4k',
      name: 'vertical-4k.m3u8',
      proxyType: 'video',
      media: {
        isHls: true,
        hls: {
          key: 'hls-key',
          url: 'https://cdn.example.com/master.m3u8',
          resolutions: [{ width: 2160, height: 3840, resolution: '2160p' }],
        },
        metadata: {
          originalWidth: 2160,
          originalHeight: 3840,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={hlsVideo} />)

    const levelSwitchedHandler = mockHlsInstance.on.mock.calls.find(
      ([event]) => event === 'hlsLevelSwitched',
    )?.[1]
    expect(levelSwitchedHandler).toBeDefined()

    act(() => {
      levelSwitchedHandler('hlsLevelSwitched', { level: 0 })
    })

    const settingsButton = container.querySelector('button:has(.lucide-settings)')
    expect(settingsButton?.textContent).toContain('2160p')
    expect(settingsButton?.textContent).not.toContain('3840p')
  })

  it('derives resolution from long side for legacy portrait MP4 transcode without explicit resolution', () => {
    const legacyPortraitVideo: AssetInfo = {
      id: 'legacy-portrait-mp4',
      name: 'portrait.mp4',
      proxyType: 'video',
      media: {
        videoTranscodes: [
          {
            key: 'portrait-1080p.mp4',
            url: 'https://cdn.example.com/portrait-1080p.mp4',
            width: 1080,
            height: 1920,
            size: 5000000,
          },
        ],
        metadata: {
          originalWidth: 1080,
          originalHeight: 1920,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={legacyPortraitVideo} />)
    const settingsButton = container.querySelector('button:has(.lucide-settings)')
    expect(settingsButton?.textContent).toContain('1080p')
    expect(settingsButton?.textContent).not.toContain('1920p')
  })

  it('sets poster on video element from file.preview.thumbnailUrl', () => {
    const videoWithThumb: AssetInfo = {
      id: 'video-thumb',
      name: 'thumb.mp4',
      proxyType: 'video',
      preview: {
        thumbnailUrl: 'https://cdn.example.com/poster.jpg',
      },
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/video-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={videoWithThumb} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement
    expect(video.getAttribute('poster')).toBe('https://cdn.example.com/poster.jpg')
  })

  it('shows loading spinner initially and transitions to play overlay on loadeddata', () => {
    const testVideo: AssetInfo = {
      id: 'video-loading-test',
      name: 'loading.mp4',
      proxyType: 'video',
      media: {
        metadata: {
          originalWidth: 1920,
          originalHeight: 1080,
          duration: 10,
          frameRate: 30,
          totalFrames: 300,
        },
        videoTranscodes: [
          {
            resolution: '1080p',
            url: 'https://cdn.example.com/video-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container } = render(<VideoViewer file={testVideo} />)
    const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

    // 1. Initially loading spinner is visible, play overlay is not
    expect(container.querySelector('[data-testid="video-loading-spinner"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="video-play-overlay"]')).toBeNull()

    // 2. Control bar inner wrapper is dimmed & non-interactive
    const controlBarWrapper = container.querySelector('.pointer-events-none.opacity-60')
    expect(controlBarWrapper).not.toBeNull()

    // 3. Dispatch loadeddata
    act(() => {
      video.dispatchEvent(new Event('loadeddata'))
    })

    // Spinner is gone, play overlay is visible, controls are interactive
    expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()
    expect(container.querySelector('[data-testid="video-play-overlay"]')).not.toBeNull()
    expect(container.querySelector('.pointer-events-none.opacity-60')).toBeNull()
  })

  it('debounces waiting stall with 200ms delay and cancels spinner on quick recovery', () => {
    vi.useFakeTimers()
    try {
      const testVideo: AssetInfo = {
        id: 'video-stall-test',
        name: 'stall.mp4',
        proxyType: 'video',
        media: {
          metadata: {
            originalWidth: 1920,
            originalHeight: 1080,
            duration: 10,
            frameRate: 30,
            totalFrames: 300,
          },
          videoTranscodes: [
            {
              resolution: '1080p',
              url: 'https://cdn.example.com/video-1080p.mp4',
              width: 1920,
              height: 1080,
            },
          ],
        },
      } as unknown as AssetInfo

      const { container } = render(<VideoViewer file={testVideo} />)
      const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

      // Become ready first
      act(() => {
        video.dispatchEvent(new Event('loadeddata'))
      })
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()

      // Stalls briefly (<200ms)
      act(() => {
        video.dispatchEvent(new Event('waiting'))
      })
      // Immediately after waiting, spinner should NOT be shown yet (debounced)
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()

      // Recovers quickly at 100ms
      act(() => {
        vi.advanceTimersByTime(100)
        video.dispatchEvent(new Event('playing'))
      })
      act(() => {
        vi.advanceTimersByTime(150)
      })
      // Spinner still not shown
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()

      // Now a long stall (>200ms)
      act(() => {
        video.dispatchEvent(new Event('waiting'))
      })
      act(() => {
        vi.advanceTimersByTime(250)
      })
      // Spinner should now appear!
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).not.toBeNull()

      // Resume playing
      act(() => {
        video.dispatchEvent(new Event('playing'))
      })
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not cancel waiting stall debounce when progress events fire during stall', () => {
    vi.useFakeTimers()
    try {
      const testVideo: AssetInfo = {
        id: 'video-stall-progress-test',
        name: 'stall-progress.mp4',
        proxyType: 'video',
        media: {
          metadata: {
            originalWidth: 1920,
            originalHeight: 1080,
            duration: 10,
            frameRate: 30,
            totalFrames: 300,
          },
          videoTranscodes: [
            {
              resolution: '1080p',
              url: 'https://cdn.example.com/video-1080p.mp4',
              width: 1920,
              height: 1080,
            },
          ],
        },
      } as unknown as AssetInfo

      const { container } = render(<VideoViewer file={testVideo} />)
      const video = container.querySelector('[data-testid="video-area"] video') as HTMLVideoElement

      // 1. Initial ready state
      act(() => {
        video.dispatchEvent(new Event('loadeddata'))
      })
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()

      // 2. Play starts (paused === false)
      Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true })
      act(() => {
        video.dispatchEvent(new Event('playing'))
      })

      // 3. Stalls: dispatches waiting
      act(() => {
        video.dispatchEvent(new Event('waiting'))
      })
      // Spinner not visible immediately (within 200ms debounce)
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()

      // 4. Progress event fires at 100ms while paused is false (data still trickling in)
      act(() => {
        vi.advanceTimersByTime(100)
        video.dispatchEvent(new Event('progress'))
      })
      // Should NOT clear debounce or mark loading false
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()

      // 5. Advance past 200ms debounce (advance remaining 110ms)
      act(() => {
        vi.advanceTimersByTime(110)
      })
      // Spinner should now appear despite the progress event!
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).not.toBeNull()

      // 6. Playback resumes: dispatch playing
      act(() => {
        video.dispatchEvent(new Event('playing'))
      })
      // Spinner disappears
      expect(container.querySelector('[data-testid="video-loading-spinner"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders failed state when file has no media and status is failed', () => {
    const failedVideo = {
      id: 'failed-video',
      name: 'failed-video.mp4',
      proxyType: 'video',
      status: 'failed',
      media: {
        error: 'Transcoding failed due to server error',
      },
    } as unknown as AssetInfo

    const { getByTestId, getByText } = render(<VideoViewer file={failedVideo} />)
    expect(getByTestId('video-viewer-failed-state')).toBeDefined()
    expect(getByText('Transcoding failed due to server error')).toBeDefined()
  })
})
