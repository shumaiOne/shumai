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
})
