import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { SeekbarScrubHandlers } from './progress-bar'
import { calculateFrameCenterTime } from './utils'

interface ScrubSession {
  resume: boolean
  removeSeekListeners?: () => void
}

interface VideoScrubOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  assetId: string | undefined
  source: string
  totalFrames: number
  frameRate: number
  pauseForScrub: () => void
  seekToFrame: (frame: number) => Promise<void>
}

export function useVideoScrub({
  videoRef,
  assetId,
  source,
  totalFrames,
  frameRate,
  pauseForScrub,
  seekToFrame,
}: VideoScrubOptions) {
  const sessionRef = useRef<ScrubSession | null>(null)
  const [scrubFrame, setScrubFrame] = useState<number | null>(null)
  const clampFrame = (frame: number) => Math.max(0, Math.min(Math.round(frame), totalFrames - 1))

  useLayoutEffect(() => {
    setScrubFrame(null)
    return () => {
      sessionRef.current?.removeSeekListeners?.()
      sessionRef.current = null
    }
  }, [assetId, source])

  const finish = (session: ScrubSession, video: HTMLVideoElement, ready: boolean) => {
    if (sessionRef.current !== session) return
    session.removeSeekListeners?.()
    sessionRef.current = null
    setScrubFrame(null)
    if (ready && session.resume) video.play().catch(() => {})
  }

  const scrub: SeekbarScrubHandlers = {
    onStart(frame) {
      const video = videoRef.current
      if (!video) return
      const previous = sessionRef.current
      previous?.removeSeekListeners?.()
      sessionRef.current = { resume: previous?.resume ?? !video.paused }
      pauseForScrub()
      setScrubFrame(clampFrame(frame))
    },
    onMove(frame) {
      if (sessionRef.current) setScrubFrame(clampFrame(frame))
    },
    onEnd(frame) {
      const session = sessionRef.current
      const video = videoRef.current
      if (!session || !video) return

      const targetFrame = clampFrame(frame)
      setScrubFrame(targetFrame)
      let seekFinished = false
      const showMainVideo = () => {
        if (seekFinished && !video.seeking && video.readyState >= 2) {
          finish(session, video, true)
        }
      }
      const handleError = () => finish(session, video, false)
      video.addEventListener('seeked', showMainVideo)
      video.addEventListener('loadeddata', showMainVideo)
      video.addEventListener('canplay', showMainVideo)
      video.addEventListener('error', handleError)
      video.addEventListener('emptied', handleError)
      session.removeSeekListeners = () => {
        video.removeEventListener('seeked', showMainVideo)
        video.removeEventListener('loadeddata', showMainVideo)
        video.removeEventListener('canplay', showMainVideo)
        video.removeEventListener('error', handleError)
        video.removeEventListener('emptied', handleError)
      }

      // The normal seek helper has a timeout. Keep the preview visible until
      // the media element can actually present the requested frame.
      void seekToFrame(targetFrame).then(() => {
        seekFinished = true
        showMainVideo()
      }, handleError)
    },
    onCancel() {
      const session = sessionRef.current
      const video = videoRef.current
      if (session && video) finish(session, video, true)
    },
  }

  return {
    scrub,
    scrubFrame,
    previewTime: scrubFrame === null ? null : calculateFrameCenterTime(scrubFrame, frameRate),
  }
}
