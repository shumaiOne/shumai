import React, { useCallback, useEffect, useRef, useState } from 'react'
import { calculateFrameCenterTime, stallThresholdMs } from './utils'

export interface UseFramePlayerResult {
  currentFrame: number
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>>
  seekToFrame: (targetFrame: number) => Promise<void>
  isSeeking: React.RefObject<boolean>
}

interface HtmlVideoElementWithCallback {
  requestVideoFrameCallback?: (
    callback: (now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => void,
  ) => number
  cancelVideoFrameCallback?: (id: number) => void
}

// If requestVideoFrameCallback is supported but has not delivered a frame within
// this window after playback starts, fall back to the currentTime/RAF driver so
// the playhead can never freeze permanently on an engine that stops emitting rVFC.
const INITIAL_VFC_GRACE_MS = 1000

export function useFramePlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  frameRate: number,
  totalFrames: number,
): UseFramePlayerResult {
  const [currentFrame, setCurrentFrame] = useState<number>(0)
  const isSeekingRef = useRef<boolean>(false)
  const isPlayingRef = useRef<boolean>(false)
  const pendingSeekFrameRef = useRef<number | null>(null)
  const currentFrameRef = useRef<number>(currentFrame)
  currentFrameRef.current = currentFrame

  // Track playing state of the HTML video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      isPlayingRef.current = true
    }
    const handlePause = () => {
      isPlayingRef.current = false
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    // Initial check
    isPlayingRef.current = !video.paused

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [videoRef.current])

  // Continuous frame updating loop during active playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let rVfcId: number | null = null
    let rafId: number | null = null
    let active = true

    // Per-playback-session synchronization state.
    // `lastVfcTime` / `hasDeliveredVfc` gate when it is safe to trust
    // `video.currentTime` (see the fallback condition below). `lastMediaTime` is
    // the most recent compositor-presented time, used to lock the playhead on
    // pause to the frame the user is actually looking at.
    let lastVfcTime = Date.now()
    let hasDeliveredVfc = false
    let lastMediaTime = -1

    // Reset session state whenever playback (re)starts, so each play waits for a
    // fresh compositor frame before trusting the playback clock.
    const beginSession = () => {
      lastVfcTime = Date.now()
      hasDeliveredVfc = false
      lastMediaTime = -1
    }

    const updateFrameLoop = () => {
      if (!active) return

      if (video.paused || video.ended) {
        return
      }

      const videoWithCallback = video as unknown as HtmlVideoElementWithCallback
      const rVfcSupported = !!videoWithCallback.requestVideoFrameCallback

      // Calculate dynamic stall threshold (minimum 100ms, or 3 frames of duration)
      const stallThreshold = stallThresholdMs(frameRate)
      const sinceLastVfc = Date.now() - lastVfcTime

      // Decide whether the RAF path may drive the playhead from `video.currentTime`.
      //
      // `video.currentTime` is the playback (audio) clock. On some engines
      // (notably Safari/WebKit) it runs AHEAD of the frame actually presented on
      // screen right after playback starts, so trusting it before the compositor
      // catches up makes the playhead race forward and then snap backward when the
      // first requestVideoFrameCallback (mediaTime) arrives.
      //
      // We therefore only use the currentTime fallback when:
      //   - rVFC is unsupported (it is the only driver available), or
      //   - rVFC has delivered at least one frame this session AND has since
      //     stalled (e.g. the video track ended while audio keeps playing), or
      //   - rVFC never delivered within the initial grace window (safety net so
      //     the playhead cannot freeze forever).
      const rVfcStalledAfterDelivery = hasDeliveredVfc && sinceLastVfc > stallThreshold
      const rVfcNeverDelivered = !hasDeliveredVfc && sinceLastVfc > INITIAL_VFC_GRACE_MS
      const useCurrentTimeFallback =
        !rVfcSupported || rVfcStalledAfterDelivery || rVfcNeverDelivered

      if (useCurrentTimeFallback) {
        const frame = Math.floor(video.currentTime * frameRate + 0.45)
        const clamped = Math.max(0, Math.min(frame, totalFrames - 1))
        setCurrentFrame(clamped)
      }

      // Always schedule the next update tick via requestAnimationFrame to keep the loop alive
      rafId = requestAnimationFrame(updateFrameLoop)

      // Schedule video frame callback for compositor-accurate synchronization
      if (videoWithCallback.requestVideoFrameCallback && rVfcId === null) {
        rVfcId = videoWithCallback.requestVideoFrameCallback(
          (_now: DOMHighResTimeStamp, metadata: { mediaTime: number }) => {
            rVfcId = null
            lastVfcTime = Date.now() // Reset stall timer
            hasDeliveredVfc = true
            lastMediaTime = metadata.mediaTime

            const compositorFrame = Math.floor(metadata.mediaTime * frameRate + 0.45)
            const compositorClamped = Math.max(0, Math.min(compositorFrame, totalFrames - 1))
            setCurrentFrame(compositorClamped)
          },
        )
      }
    }

    const handlePlay = () => {
      beginSession()
      updateFrameLoop()
    }

    const handlePause = () => {
      if (rVfcId !== null) {
        const videoWithCallback = video as unknown as HtmlVideoElementWithCallback
        if (videoWithCallback.cancelVideoFrameCallback) {
          try {
            videoWithCallback.cancelVideoFrameCallback(rVfcId)
          } catch {
            // Ignore error during cancellation
          }
        }
        rVfcId = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }

      // Synchronize the frame on pause. Prefer the last compositor-presented time
      // (mediaTime) when it is still fresh, because on Safari `video.currentTime`
      // can lead the on-screen frame — using it would snap the playhead forward
      // past the frame the user actually paused on. Fall back to currentTime when
      // rVFC is stale/unsupported (e.g. the video track ended while audio plays).
      const stallThreshold = stallThresholdMs(frameRate)
      const vfcFresh =
        hasDeliveredVfc && lastMediaTime >= 0 && Date.now() - lastVfcTime <= stallThreshold
      const syncTime = vfcFresh ? lastMediaTime : video.currentTime

      const frame = Math.floor(syncTime * frameRate + 0.45)
      const clamped = Math.max(0, Math.min(frame, totalFrames - 1))
      setCurrentFrame(clamped)

      // Snap the playhead to the center of the paused frame to align browser compositor
      // Skip snapping if the video has ended to preserve the native ended state and allow native replay
      if (!video.ended) {
        const safeCenterTime = calculateFrameCenterTime(clamped, frameRate)
        video.currentTime = safeCenterTime
      }
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    // If it's already playing when this effect runs
    if (!video.paused) {
      beginSession()
      updateFrameLoop()
    }

    return () => {
      active = false
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      if (rVfcId !== null) {
        const videoWithCallback = video as unknown as HtmlVideoElementWithCallback
        if (videoWithCallback.cancelVideoFrameCallback) {
          try {
            videoWithCallback.cancelVideoFrameCallback(rVfcId)
          } catch {
            // Ignore error during cancellation
          }
        }
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [videoRef.current, frameRate, totalFrames])

  const seekToFrame = useCallback(
    async (targetFrame: number) => {
      const video = videoRef.current
      if (!video) return

      const roundedFrame = Math.round(targetFrame)
      const clampedFrame = Math.max(0, Math.min(roundedFrame, totalFrames - 1))

      // If a seek is already active, queue this target and update UI state optimistically
      if (isSeekingRef.current) {
        pendingSeekFrameRef.current = clampedFrame
        setCurrentFrame(clampedFrame)
        return
      }

      isSeekingRef.current = true
      setCurrentFrame(clampedFrame) // Optimistic update for active seek

      const performSeek = async (frameToSeek: number) => {
        const safeTargetTime = calculateFrameCenterTime(frameToSeek, frameRate)
        const wasPlaying = !video.paused

        video.currentTime = safeTargetTime

        // Wait for native seek to complete (with a 500ms fallback timeout to prevent hanging)
        await new Promise<void>((resolve) => {
          let timeoutId: ReturnType<typeof setTimeout> | null = null
          const onSeeked = () => {
            if (timeoutId) clearTimeout(timeoutId)
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          timeoutId = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }, 500)
        })

        // Pause only if we started paused and the user hasn't pressed play in the meantime
        if (!wasPlaying && !isPlayingRef.current) {
          video.pause()
        }

        // Seek complete: update frame immediately using Math.floor
        const actualFrame = Math.floor(video.currentTime * frameRate + 0.45)
        const finalFrame = Math.max(0, Math.min(actualFrame, totalFrames - 1))
        setCurrentFrame(finalFrame)

        // Verify with requestVideoFrameCallback in the background (non-blocking)
        const videoWithCallback = video as unknown as HtmlVideoElementWithCallback
        if (videoWithCallback.requestVideoFrameCallback) {
          videoWithCallback.requestVideoFrameCallback((_now, metadata) => {
            const compositorFrame = Math.floor(metadata.mediaTime * frameRate + 0.45)
            const verifiedFrame = Math.max(0, Math.min(compositorFrame, totalFrames - 1))
            setCurrentFrame(verifiedFrame)
          })
        }

        // Process next seek in the queue if any came in during the seek
        if (pendingSeekFrameRef.current !== null) {
          const nextFrame = pendingSeekFrameRef.current
          pendingSeekFrameRef.current = null
          await performSeek(nextFrame)
        } else {
          isSeekingRef.current = false
        }
      }

      await performSeek(clampedFrame)
    },
    [videoRef, frameRate, totalFrames],
  )

  // Keyboard Shortcuts Keydown Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const delta = e.shiftKey ? 10 : 1
        seekToFrame(currentFrameRef.current + delta)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const delta = e.shiftKey ? 10 : 1
        seekToFrame(currentFrameRef.current - delta)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [seekToFrame])

  // Listen to external seeks (like comment clicks or VideoJS timeline clicks)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleExternalSeeked = () => {
      // Only sync if this seek was not triggered internally by seekToFrame
      if (!isSeekingRef.current) {
        const actualFrame = Math.floor(video.currentTime * frameRate + 0.45)
        const finalFrame = Math.max(0, Math.min(actualFrame, totalFrames - 1))
        setCurrentFrame(finalFrame)

        // Nudge to safe frame center to guarantee correct browser decoding
        const safeCenterTime = calculateFrameCenterTime(finalFrame, frameRate)
        const frameDuration = 1 / frameRate
        if (Math.abs(video.currentTime - safeCenterTime) > frameDuration / 4) {
          video.currentTime = safeCenterTime
        }
      }
    }

    video.addEventListener('seeked', handleExternalSeeked)
    return () => {
      video.removeEventListener('seeked', handleExternalSeeked)
    }
  }, [videoRef.current, frameRate, totalFrames])

  return {
    currentFrame,
    setCurrentFrame,
    seekToFrame,
    isSeeking: isSeekingRef,
  }
}
