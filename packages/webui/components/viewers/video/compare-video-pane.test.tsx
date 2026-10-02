// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import React, { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CompareVideoPane } from './compare-video-pane'
import type { ComparePaneHandle, PaneReportedState } from '../../compare/types'
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

describe('CompareVideoPane', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockHlsInstance.currentLevel = -1
    const Hls = (await import('hls.js')).default as unknown as {
      isSupported: ReturnType<typeof vi.fn>
    }
    Hls.isSupported.mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
  })

  it('safely handles native HLS fallback without clearing video.src when manual resolution is invoked', async () => {
    const Hls = (await import('hls.js')).default as unknown as {
      isSupported: ReturnType<typeof vi.fn>
    }
    Hls.isSupported.mockReturnValue(false)

    // Mock HTMLMediaElement.prototype.canPlayType to support native HLS
    const originalCanPlayType = HTMLMediaElement.prototype.canPlayType
    HTMLMediaElement.prototype.canPlayType = vi.fn((type: string) =>
      type === 'application/vnd.apple.mpegurl' ? 'maybe' : '',
    )

    try {
      const hlsVideo: AssetInfo = {
        id: 'hls-compare',
        name: 'hls-compare.m3u8',
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

      const reportedStates: PaneReportedState[] = []
      const ref = createRef<ComparePaneHandle>()

      const { container } = render(
        <CompareVideoPane
          ref={ref}
          file={hlsVideo}
          isActive={true}
          annotations={[]}
          onStateChange={(state) => reportedStates.push(state)}
          onActivate={vi.fn()}
        />,
      )

      const video = container.querySelector('video') as HTMLVideoElement
      expect(video.src).toBe('https://cdn.example.com/master.m3u8')

      // Check reported state: isHlsManualSupported should be false
      const lastState = reportedStates[reportedStates.length - 1]
      expect(lastState?.video?.isHlsManualSupported).toBe(false)

      // Invoke changeResolution('1080p')
      act(() => {
        ref.current?.changeResolution('1080p')
      })

      // In native fallback, changeResolution should NO-OP and NOT clear video.src to empty string
      expect(video.src).toBe('https://cdn.example.com/master.m3u8')
    } finally {
      HTMLMediaElement.prototype.canPlayType = originalCanPlayType
    }
  })

  it('switches HLS resolution immediately using currentLevel and does not hijack subsequent seeks', async () => {
    vi.useFakeTimers()
    try {
      const hlsVideo: AssetInfo = {
        id: 'hls-compare-switch',
        name: 'hls-compare-switch.m3u8',
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

      const reportedStates: PaneReportedState[] = []
      const ref = createRef<ComparePaneHandle>()

      const { container } = render(
        <CompareVideoPane
          ref={ref}
          file={hlsVideo}
          isActive={true}
          annotations={[]}
          onStateChange={(state) => reportedStates.push(state)}
          onActivate={vi.fn()}
        />,
      )

      const video = container.querySelector('video') as HTMLVideoElement
      Object.defineProperty(video, 'paused', { value: true, configurable: true })
      video.currentTime = 0

      // In Hls.js supported mode, isHlsManualSupported should be true
      const lastState = reportedStates[reportedStates.length - 1]
      expect(lastState?.video?.isHlsManualSupported).toBe(true)

      // Switch to 720p (index 1)
      act(() => {
        ref.current?.changeResolution('720p')
      })
      expect(mockHlsInstance.currentLevel).toBe(1)

      // Advance timers past the 1500ms safety timeout without seeked event
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Now user performs an unrelated seek to frame 150 (currentTime = 5.0)
      video.currentTime = 5.0
      act(() => {
        video.dispatchEvent(new Event('seeked'))
      })

      // video.currentTime must remain at frame 150, NOT rewound to frame 0
      expect(Math.floor(video.currentTime * 30 + 0.001)).toBe(150)
      expect(video.currentTime).toBeCloseTo(5.0167, 3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports 2160p instead of 3840p for 4K vertical video when HLS switches level on Auto', () => {
    mockHlsInstance.levels = [{ height: 3840, width: 2160, bitrate: 10000000 }]

    const hlsVideo: AssetInfo = {
      id: 'video-hls-compare-vertical-4k',
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

    const ref = createRef<ComparePaneHandle>()
    const reportedStates: PaneReportedState[] = []

    render(
      <CompareVideoPane
        ref={ref}
        file={hlsVideo}
        isActive={true}
        annotations={[]}
        onActivate={vi.fn()}
        onStateChange={(s) => reportedStates.push(s)}
      />,
    )

    const levelSwitchedHandler = mockHlsInstance.on.mock.calls.find(
      ([event]) => event === 'hlsLevelSwitched',
    )?.[1]
    expect(levelSwitchedHandler).toBeDefined()

    act(() => {
      levelSwitchedHandler('hlsLevelSwitched', { level: 0 })
    })

    const lastState = reportedStates[reportedStates.length - 1]
    expect(lastState?.video?.activeAutoResolution).toBe('2160p')
  })

  it('derives resolution from long side for legacy portrait MP4 transcode without explicit resolution', () => {
    const legacyPortraitVideo: AssetInfo = {
      id: 'legacy-portrait-compare-mp4',
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

    const reportedStates: PaneReportedState[] = []
    render(
      <CompareVideoPane
        file={legacyPortraitVideo}
        isActive={true}
        annotations={[]}
        onActivate={vi.fn()}
        onStateChange={(s) => reportedStates.push(s)}
      />,
    )

    const lastState = reportedStates[reportedStates.length - 1]
    expect(lastState?.video?.resolutions?.[0]?.resolution).toBe('1080p')
  })

  it('sets poster on video element from file.preview.thumbnailUrl', () => {
    const videoWithThumb: AssetInfo = {
      id: 'compare-thumb',
      name: 'thumb.mp4',
      proxyType: 'video',
      preview: {
        thumbnailUrl: 'https://cdn.example.com/compare-poster.jpg',
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
            url: 'https://cdn.example.com/compare-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const { container } = render(
      <CompareVideoPane
        file={videoWithThumb}
        isActive={true}
        annotations={[]}
        onActivate={vi.fn()}
        onStateChange={vi.fn()}
      />,
    )
    const video = container.querySelector(
      '[data-testid="compare-video-area"] video',
    ) as HTMLVideoElement
    expect(video.getAttribute('poster')).toBe('https://cdn.example.com/compare-poster.jpg')
  })

  it('shows loading spinner initially, transitions on loadeddata, and blocks play while loading', () => {
    const testVideo: AssetInfo = {
      id: 'compare-loading-test',
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
            url: 'https://cdn.example.com/compare-1080p.mp4',
            width: 1920,
            height: 1080,
          },
        ],
      },
    } as unknown as AssetInfo

    const onRequestTogglePlay = vi.fn()
    const { container } = render(
      <CompareVideoPane
        file={testVideo}
        isActive={true}
        annotations={[]}
        onActivate={vi.fn()}
        onStateChange={vi.fn()}
        onRequestTogglePlay={onRequestTogglePlay}
      />,
    )

    const area = container.querySelector('[data-testid="compare-video-area"]') as HTMLDivElement
    const video = area.querySelector('video') as HTMLVideoElement

    // Initially loading spinner is visible
    expect(container.querySelector('[data-testid="compare-video-loading-spinner"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="compare-video-play-overlay"]')).toBeNull()

    // Clicking while loading should not trigger play
    act(() => {
      area.click()
    })
    expect(onRequestTogglePlay).not.toHaveBeenCalled()

    // Dispatch loadeddata
    act(() => {
      video.dispatchEvent(new Event('loadeddata'))
    })

    // Spinner gone, play overlay visible
    expect(container.querySelector('[data-testid="compare-video-loading-spinner"]')).toBeNull()
    expect(container.querySelector('[data-testid="compare-video-play-overlay"]')).not.toBeNull()

    // Clicking now triggers toggle play
    act(() => {
      area.click()
    })
    expect(onRequestTogglePlay).toHaveBeenCalledTimes(1)
  })
})
