import React, { useCallback, useEffect, useRef, useState } from 'react'
import { calculateFrameCenterTime } from './utils'

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
    let lastVfcTime = Date.now()

    const updateFrameLoop = () => {
      if (!active) return

      if (video.paused || video.ended) {
        return
      }

      const videoWithCallback = video as unknown as HtmlVideoElementWithCallback

      // Calculate dynamic stall threshold (minimum 100ms, or 3 frames of duration)
      const stallThreshold = Math.max(100, 3000 / frameRate)
      const isVfcStalled = Date.now() - lastVfcTime > stallThreshold

      // Print debug log roughly once per second during playback
      if (Math.floor(video.currentTime * frameRate + 0.001) % 30 === 0) {
        console.log(
          `[useFramePlayer] currentTime: ${video.currentTime}, isVfcStalled: ${isVfcStalled}, stallThreshold: ${stallThreshold}, totalFrames: ${totalFrames}`,
        )
      }

      // Only update playhead via currentTime (RAF) if rVFC has stalled or isn't supported
      if (!videoWithCallback.requestVideoFrameCallback || isVfcStalled) {
        const frame = Math.floor(video.currentTime * frameRate + 0.001)
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

            const compositorFrame = Math.floor(metadata.mediaTime * frameRate + 0.001)
            const compositorClamped = Math.max(0, Math.min(compositorFrame, totalFrames - 1))
            setCurrentFrame(compositorClamped)
          },
        )
      }
    }

    const handlePlay = () => {
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

      // Synchronize frame on pause
      const frame = Math.floor(video.currentTime * frameRate + 0.001)
      const clamped = Math.max(0, Math.min(frame, totalFrames - 1))
      setCurrentFrame(clamped)
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    // If it's already playing when this effect runs
    if (!video.paused) {
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

        // Seek complete: update frame immediately using Math.floor (accounts for half-frame offset)
        const actualFrame = Math.floor(video.currentTime * frameRate)
        const finalFrame = Math.max(0, Math.min(actualFrame, totalFrames - 1))
        setCurrentFrame(finalFrame)

        // Verify with requestVideoFrameCallback in the background (non-blocking)
        const videoWithCallback = video as unknown as HtmlVideoElementWithCallback
        if (videoWithCallback.requestVideoFrameCallback) {
          videoWithCallback.requestVideoFrameCallback((_now, metadata) => {
            const compositorFrame = Math.floor(metadata.mediaTime * frameRate + 0.001)
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
        const actualFrame = Math.floor(video.currentTime * frameRate + 0.001)
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
