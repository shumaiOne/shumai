import { cn } from '@/ui/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

export function ScrubPreview({ url, time }: { url: string; time: number | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const requestedTimeRef = useRef<number | null>(null)
  const [hasFrame, setHasFrame] = useState(false)

  const seekPreview = useCallback(() => {
    const video = videoRef.current
    if (time === null || !video || !Number.isFinite(video.duration) || video.seeking) return
    const targetTime = Math.min(time, Math.max(0, video.duration - 0.001))
    if (requestedTimeRef.current !== targetTime) {
      requestedTimeRef.current = targetTime
      if (Math.abs(video.currentTime - targetTime) > 0.001) {
        video.currentTime = targetTime
        return
      }
    }
    if (video.readyState >= 2) setHasFrame(true)
  }, [time])

  useEffect(() => {
    if (time === null) setHasFrame(false)
    else seekPreview()
  }, [time, seekPreview])

  return (
    <video
      ref={videoRef}
      src={url}
      className={cn(
        'absolute inset-0 h-full w-full bg-black object-contain',
        (time === null || !hasFrame) && 'invisible',
      )}
      aria-hidden="true"
      data-testid="scrub-preview"
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={seekPreview}
      onLoadedData={seekPreview}
      onSeeked={() => {
        if (time === null) return
        setHasFrame(true)
        // Consume the latest pointer position after the current seek finishes.
        seekPreview()
      }}
      onError={() => setHasFrame(false)}
    />
  )
}
