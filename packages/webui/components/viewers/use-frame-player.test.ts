// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useFramePlayer } from './use-frame-player'

/**
 * Deterministic reproduction of the Safari playhead-rewind bug.
 *
 * On Safari/WebKit, `video.currentTime` (the playback/audio clock) runs AHEAD of
 * the frame actually presented on screen right after playback starts, and the
 * first `requestVideoFrameCallback` (mediaTime) arrives only after a delay. The
 * old logic drove the playhead from `currentTime` immediately on play, racing it
 * forward, then snapped it backward when the first rVFC reported the true (lower)
 * presented frame.
 *
 * The headless WebKit engine does not exhibit that clock skew, so this can only
 * be reproduced deterministically at the logic layer: we mock a video element
 * whose `currentTime` leads while a fake `requestVideoFrameCallback` delivers a
 * lagging `mediaTime`, drive RAF/clock manually, and assert the playhead never
 * moves backward.
 */

const FPS = 30
const TOTAL = 150

// --- Controllable environment -------------------------------------------------

interface RafEntry {
  id: number
  cb: FrameRequestCallback
}

let clock = 0
let rafQueue: RafEntry[] = []
let rafSeq = 0

/** Run exactly the RAF callbacks queued at flush time (one simulated frame). */
const flushRaf = () => {
  const queued = rafQueue
  rafQueue = []
  for (const { cb } of queued) cb(clock)
}

/** Minimal HTMLVideoElement stand-in with a manually-fired rVFC. */
class FakeVideo extends EventTarget {
  currentTime = 0
  paused = true
  ended = false
  private vfcCallbacks: Array<(now: number, meta: { mediaTime: number }) => void> = []

  requestVideoFrameCallback(cb: (now: number, meta: { mediaTime: number }) => void): number {
    this.vfcCallbacks.push(cb)
    return this.vfcCallbacks.length
  }

  cancelVideoFrameCallback(): void {
    this.vfcCallbacks = []
  }

  pause(): void {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  play(): void {
    this.paused = false
    this.dispatchEvent(new Event('play'))
  }

  /** Simulate the compositor presenting a frame at the given mediaTime. */
  fireVfc(mediaTime: number): void {
    const callbacks = this.vfcCallbacks
    this.vfcCallbacks = []
    for (const cb of callbacks) cb(0, { mediaTime })
  }
}

function makeRef(video: FakeVideo): { current: HTMLVideoElement | null } {
  return { current: video as unknown as HTMLVideoElement }
}

let originalRaf: typeof globalThis.requestAnimationFrame
let originalCaf: typeof globalThis.cancelAnimationFrame

beforeEach(() => {
  clock = 0
  rafQueue = []
  rafSeq = 0
  vi.spyOn(Date, 'now').mockImplementation(() => clock)

  originalRaf = globalThis.requestAnimationFrame
  originalCaf = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
    rafSeq += 1
    rafQueue.push({ id: rafSeq, cb })
    return rafSeq
  }) as typeof globalThis.requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number): void => {
    rafQueue = rafQueue.filter((entry) => entry.id !== id)
  }) as typeof globalThis.cancelAnimationFrame
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  globalThis.requestAnimationFrame = originalRaf
  globalThis.cancelAnimationFrame = originalCaf
})

// --- Tests --------------------------------------------------------------------

describe('useFramePlayer Safari playhead synchronization', () => {
  it('does not rewind the playhead on play when currentTime leads the presented frame', () => {
    const video = new FakeVideo()
    const { result } = renderHook(() => useFramePlayer(makeRef(video), FPS, TOTAL))

    const frames: number[] = []
    const record = () => frames.push(result.current.currentFrame)

    // Start playback via the play event (as a real click would).
    act(() => {
      video.paused = false
      video.dispatchEvent(new Event('play'))
    })
    record()

    // Safari: the playback clock races ahead (~frame 10) while NO rVFC frame has
    // been presented yet. The playhead must NOT follow currentTime here.
    const leadingCurrentTimes = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35]
    for (const ct of leadingCurrentTimes) {
      clock += 50
      video.currentTime = ct
      act(() => {
        flushRaf()
      })
      record()
    }
    expect(Math.max(...frames)).toBe(0) // Fix 1: no forward race from currentTime

    // First presented frame arrives, lagging currentTime (frame 1).
    act(() => {
      video.fireVfc(1 / FPS)
    })
    record()

    // Subsequent presented frames advance normally.
    for (let f = 2; f <= 8; f++) {
      clock += 33
      act(() => {
        flushRaf()
      })
      act(() => {
        video.fireVfc(f / FPS)
      })
      record()
    }

    // The playhead must be monotonic non-decreasing throughout (never rewinds).
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1])
    }
    expect(result.current.currentFrame).toBe(8)
  })

  it('still falls back to currentTime once rVFC has delivered and then stalls', () => {
    const video = new FakeVideo()
    const { result } = renderHook(() => useFramePlayer(makeRef(video), FPS, TOTAL))

    act(() => {
      video.paused = false
      video.dispatchEvent(new Event('play'))
    })

    // rVFC delivers a few frames -> the session has "seen" the compositor.
    for (let f = 1; f <= 3; f++) {
      clock += 33
      video.currentTime = f / FPS
      act(() => {
        flushRaf()
      })
      act(() => {
        video.fireVfc(f / FPS)
      })
    }
    expect(result.current.currentFrame).toBe(3)

    // Video track ends: rVFC stops, but audio (currentTime) keeps advancing past
    // the stall threshold. The RAF fallback should take over from currentTime.
    clock += 200
    video.currentTime = 10 / FPS
    act(() => {
      flushRaf()
    })
    expect(result.current.currentFrame).toBe(10)
  })

  it('locks the paused frame to the presented mediaTime, not the leading currentTime', () => {
    const video = new FakeVideo()
    const { result } = renderHook(() => useFramePlayer(makeRef(video), FPS, TOTAL))

    act(() => {
      video.paused = false
      video.dispatchEvent(new Event('play'))
    })

    // Presented up to frame 16 via rVFC.
    for (let f = 1; f <= 16; f++) {
      clock += 33
      act(() => {
        flushRaf()
      })
      act(() => {
        video.fireVfc(f / FPS)
      })
    }
    expect(result.current.currentFrame).toBe(16)

    // Safari's currentTime has raced ahead to frame 20's center.
    video.currentTime = 20 / FPS + 1 / (2 * FPS)

    // Pause while rVFC is still fresh.
    act(() => {
      video.pause()
    })

    // Fix 2: the paused frame follows the presented frame (16), not currentTime (20).
    expect(result.current.currentFrame).toBe(16)
  })
})
