// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VideoViewer from './video-viewer'
import type { AssetInfo } from '@shumai/dtos'

const videojsMock = vi.fn((...args: unknown[]) => {
  void args
  return {
    on: vi.fn(),
    volume: vi.fn(),
    duration: vi.fn(() => 10),
    currentTime: vi.fn(() => 0),
    bufferedEnd: vi.fn(() => 0),
    playbackRate: vi.fn(() => 1),
    ready: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
  }
})

vi.mock('video.js', () => ({
  default: (...args: unknown[]) => videojsMock(...args),
}))

vi.mock('@/ui/components/drawing-canvas', () => ({
  default: () => <div data-testid="drawing-canvas" />,
}))

vi.mock('@/ui/paraglide/messages.js', () => ({
  m: new Proxy({}, { get: () => () => '' }),
}))

describe('VideoViewer', () => {
  beforeEach(() => {
    videojsMock.mockClear()
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

    const { rerender } = render(<VideoViewer file={videoA} />)

    // Initial render should initialize videojs with video A URL
    expect(videojsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sources: [
          {
            src: 'https://cdn.example.com/videoA-720p.mp4',
            type: 'video/mp4',
          },
        ],
      }),
    )

    // Rerender with video B (simulating selecting another video from the carousel)
    rerender(<VideoViewer file={videoB} />)

    // VideoJS should be re-initialized with video B's URL
    expect(videojsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        sources: [
          {
            src: 'https://cdn.example.com/videoB-1080p.mp4',
            type: 'video/mp4',
          },
        ],
      }),
    )
  })

  it('initializes VideoJS when transcode URL becomes available after initially empty with same ID', () => {
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
            // URL not yet presigned (e.g. from file list payload)
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

    const { rerender } = render(<VideoViewer file={initialVideo} autoPlay={true} />)

    // Initially targetSrc is empty, videojs should not be initialized
    expect(videojsMock).not.toHaveBeenCalled()

    // Rerender with detailedVideo (same id, but signed URL now available)
    rerender(<VideoViewer file={detailedVideo} autoPlay={true} />)

    // VideoJS should now be initialized with the new URL
    expect(videojsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        autoplay: false,
        sources: [
          {
            src: 'https://cdn.example.com/signed-pending-1080p.mp4',
            type: 'video/mp4',
          },
        ],
      }),
    )
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

    render(<VideoViewer file={hdrVideo} />)

    expect(videojsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sources: [
          {
            src: 'https://cdn.example.com/video-1080p-hdr.mp4',
            type: 'video/mp4',
          },
        ],
      }),
    )

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

    render(<VideoViewer file={hdrVideo} />)

    expect(videojsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sources: [
          {
            src: 'https://cdn.example.com/video-1080p.mp4',
            type: 'video/mp4',
          },
        ],
      }),
    )

    window.matchMedia = originalMatchMedia
  })

  it('does not render a darkened overlay or center play button when paused', () => {
    const testVideo: AssetInfo = {
      id: 'test-video-clean-pause',
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
    expect(videoArea).toBeTruthy()
    expect(videoArea?.querySelector('.bg-black\\/20')).toBeNull()
    expect(videoArea?.querySelector('.animate-pulse')).toBeNull()
  })
})
