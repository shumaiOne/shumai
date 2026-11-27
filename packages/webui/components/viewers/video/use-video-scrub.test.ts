// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useVideoScrub } from './use-video-scrub'

afterEach(cleanup)

function setup() {
  const video = document.createElement('video')
  const media = { paused: false, seeking: false, readyState: 4, currentTime: 1 }
  Object.defineProperties(video, {
    paused: { get: () => media.paused },
    seeking: { get: () => media.seeking },
    readyState: { get: () => media.readyState },
    currentTime: { get: () => media.currentTime },
  })
  const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
  const seekToFrame = vi.fn(async (frame: number) => {
    media.seeking = true
    media.readyState = 1
    media.currentTime = (frame + 0.5) / 30
  })
  const { result, rerender } = renderHook(
    ({ source }) =>
      useVideoScrub({
        videoRef: { current: video },
        assetId: 'video',
        source,
        totalFrames: 300,
        frameRate: 30,
        pauseForScrub: () => {
          media.paused = true
        },
        seekToFrame,
      }),
    { initialProps: { source: '/video.mp4' } },
  )
  return { result, rerender, media, video, play, seekToFrame }
}

it('keeps the preview and audio paused until the requested frame is ready', async () => {
  const { result, media, video, play, seekToFrame } = setup()

  act(() => result.current.scrub.onStart(30))
  act(() => result.current.scrub.onMove(90))
  expect(media.paused).toBe(true)
  expect(seekToFrame).not.toHaveBeenCalled()
  await act(() => result.current.scrub.onEnd(100))
  expect(seekToFrame).toHaveBeenCalledExactlyOnceWith(100)
  expect(result.current.scrubFrame).toBe(100)
  expect(play).not.toHaveBeenCalled()

  media.seeking = false
  act(() => video.dispatchEvent(new Event('seeked')))
  expect(result.current.scrubFrame).toBe(100)
  expect(play).not.toHaveBeenCalled()

  media.readyState = 2
  act(() => video.dispatchEvent(new Event('loadeddata')))
  expect(result.current.scrubFrame).toBeNull()
  expect(play).toHaveBeenCalledTimes(1)
})

it('restores playback at the old position when the drag is canceled', () => {
  const { result, media, play, seekToFrame } = setup()
  act(() => result.current.scrub.onStart(50))
  act(() => result.current.scrub.onCancel())

  expect(seekToFrame).not.toHaveBeenCalled()
  expect(media.currentTime).toBe(1)
  expect(result.current.scrubFrame).toBeNull()
  expect(play).toHaveBeenCalledTimes(1)
})

it('drops a pending handoff when the playback source changes', async () => {
  const { result, rerender, media, video, play } = setup()
  act(() => result.current.scrub.onStart(90))
  await act(() => result.current.scrub.onEnd(90))
  rerender({ source: '/other.mp4' })

  media.seeking = false
  media.readyState = 4
  act(() => video.dispatchEvent(new Event('seeked')))
  expect(result.current.scrubFrame).toBeNull()
  expect(play).not.toHaveBeenCalled()
})

it('returns to the main video when a newer seek changes the landing frame', async () => {
  const { result, media, video, play } = setup()
  act(() => result.current.scrub.onStart(90))
  await act(() => result.current.scrub.onEnd(90))

  media.currentTime = 4
  media.seeking = false
  media.readyState = 4
  act(() => video.dispatchEvent(new Event('seeked')))

  expect(result.current.scrubFrame).toBeNull()
  expect(play).toHaveBeenCalledTimes(1)
})
