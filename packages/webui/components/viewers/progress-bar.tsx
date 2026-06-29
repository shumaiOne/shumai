import { cn } from '@/ui/lib/utils'
import type { MediaMetadata } from '@shumai/dtos'
import React, { useCallback, useEffect, useRef, useState } from 'react'

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '00:00'
  const date = new Date(seconds * 1000)
  const hh = date.getUTCHours()
  const mm = date.getUTCMinutes()
  const ss = date.getUTCSeconds().toString().padStart(2, '0')
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`
  }
  return `${mm}:${ss}`
}

interface ProgressBarProps {
  totalFrames: number
  currentFrame: number
  fps: number
  previewUrl?: string
  onSeek: (frame: number) => void
  buffered?: number
  metadata?: MediaMetadata
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  totalFrames,
  currentFrame,
  fps,
  previewUrl,
  onSeek,
  buffered = 0,
  metadata,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null) // 0 to 1
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const onSeekRef = useRef(onSeek)
  useEffect(() => {
    onSeekRef.current = onSeek
  }, [onSeek])

  // Load the preview video in background
  useEffect(() => {
    if (previewVideoRef.current && previewUrl) {
      previewVideoRef.current.load()
    }
  }, [previewUrl])

  const getPercentageFromEvent = useCallback((clientX: number) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return x / rect.width
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const percentage = x / rect.width

      setHoverPosition(percentage)
      setIsHovering(true)

      if (previewVideoRef.current && totalFrames) {
        const targetFrame = percentage * totalFrames
        const frameDuration = 1 / fps
        const seekTime = targetFrame * frameDuration + frameDuration / 2
        const vid = previewVideoRef.current
        if (Number.isFinite(seekTime)) {
          vid.currentTime = seekTime
        }
      }
    },
    [totalFrames, fps, isDragging],
  )

  const handleMouseLeave = () => {
    if (!isDragging) {
      setIsHovering(false)
      setHoverPosition(null)
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    const percentage = getPercentageFromEvent(e.clientX)
    setHoverPosition(percentage)
    setIsHovering(true)
    onSeekRef.current(percentage * totalFrames)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true)
    const percentage = getPercentageFromEvent(e.touches[0].clientX)
    setHoverPosition(percentage)
    setIsHovering(true)
    onSeekRef.current(percentage * totalFrames)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      const percentage = getPercentageFromEvent(e.clientX)
      setHoverPosition(percentage)
      setIsHovering(true)

      if (previewVideoRef.current && totalFrames) {
        const targetFrame = percentage * totalFrames
        const frameDuration = 1 / fps
        const seekTime = targetFrame * frameDuration + frameDuration / 2
        const vid = previewVideoRef.current
        if (Number.isFinite(seekTime)) {
          vid.currentTime = seekTime
        }
      }

      onSeekRef.current(percentage * totalFrames)
    }

    const handleWindowMouseUp = (e: MouseEvent) => {
      setIsDragging(false)

      let stillHovering = false
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        stillHovering =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
      }

      if (!stillHovering) {
        setIsHovering(false)
        setHoverPosition(null)
      }

      const percentage = getPercentageFromEvent(e.clientX)
      onSeekRef.current(percentage * totalFrames)
    }

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const percentage = getPercentageFromEvent(e.touches[0].clientX)
      setHoverPosition(percentage)
      setIsHovering(true)

      if (previewVideoRef.current && totalFrames) {
        const targetFrame = percentage * totalFrames
        const frameDuration = 1 / fps
        const seekTime = targetFrame * frameDuration + frameDuration / 2
        const vid = previewVideoRef.current
        if (Number.isFinite(seekTime)) {
          vid.currentTime = seekTime
        }
      }

      onSeekRef.current(percentage * totalFrames)
    }

    const handleWindowTouchEnd = (e: TouchEvent) => {
      setIsDragging(false)

      const clientX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : null
      const clientY = e.changedTouches.length > 0 ? e.changedTouches[0].clientY : null

      let stillHovering = false
      if (clientX !== null && clientY !== null && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        stillHovering =
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
      }

      if (!stillHovering) {
        setIsHovering(false)
        setHoverPosition(null)
      }

      if (clientX !== null) {
        const percentage = getPercentageFromEvent(clientX)
        onSeekRef.current(percentage * totalFrames)
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true })
    window.addEventListener('touchend', handleWindowTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('touchmove', handleWindowTouchMove)
      window.removeEventListener('touchend', handleWindowTouchEnd)
    }
  }, [isDragging, totalFrames, fps, getPercentageFromEvent])

  const progressPercent =
    isDragging && hoverPosition !== null
      ? hoverPosition * 100
      : totalFrames > 0
        ? (currentFrame / totalFrames) * 100
        : 0
  const hoverPercent = hoverPosition !== null ? hoverPosition * 100 : 0

  // Calculate preview tooltip position
  const getTooltipStyle = () => {
    if (hoverPosition === null) return {}
    return {
      left: `${hoverPercent}%`,
      transform: `translateX(-${hoverPercent}%)`,
    }
  }

  // Dynamic Size Calculation
  const MAX_PREVIEW_SIZE = 180
  let previewDimensions: React.CSSProperties = {
    width: `${MAX_PREVIEW_SIZE}px`,
    height: 'auto',
  }

  if (metadata && metadata.originalWidth && metadata.originalHeight) {
    const { originalWidth, originalHeight } = metadata

    if (originalWidth >= originalHeight) {
      // Landscape or Square: Constrain width
      const height = (MAX_PREVIEW_SIZE * originalHeight) / originalWidth
      previewDimensions = {
        width: `${MAX_PREVIEW_SIZE}px`,
        height: `${height}px`,
      }
    } else {
      // Portrait: Constrain height
      const width = (MAX_PREVIEW_SIZE * originalWidth) / originalHeight
      previewDimensions = {
        width: `${width}px`,
        height: `${MAX_PREVIEW_SIZE}px`,
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="group relative h-1.5 w-full cursor-pointer touch-none rounded-full bg-muted transition-colors duration-200"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Hidden Preview Video Element */}
      <video
        ref={previewVideoRef}
        src={previewUrl}
        className="hidden"
        preload="auto"
        muted
        playsInline
      />

      {/* Hover Preview Tooltip */}
      {isHovering && totalFrames > 0 && (
        <div
          className="pointer-events-none absolute bottom-full z-50 mb-3 flex w-max flex-col"
          style={getTooltipStyle()}
        >
          <div className="relative overflow-hidden rounded-lg border-2 border-border bg-popover shadow-2xl">
            <video
              src={previewUrl}
              className="bg-black object-cover"
              style={previewDimensions}
              muted
              ref={(el) => {
                if (el && previewVideoRef.current) {
                  el.currentTime = previewVideoRef.current.currentTime
                }
              }}
            />
            <div className="absolute bottom-0 w-full bg-popover/80 py-0.5 text-center text-xs font-medium text-popover-foreground">
              {formatTime((hoverPosition! * totalFrames) / fps)}
            </div>
          </div>
        </div>
      )}

      {/* Buffered Bar */}
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-muted-foreground/30 transition-all duration-200"
        style={{ width: `${buffered}%` }}
      />

      {/* Hover Highlight Bar */}
      {isHovering && (
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-primary/30"
          style={{ width: `${hoverPercent}%` }}
        />
      )}

      {/* Play Progress Bar */}
      <div
        className="relative absolute top-0 left-0 h-full rounded-full bg-primary"
        style={{ width: `${progressPercent}%` }}
      >
        {/* Thumb (Playhead) - visible on group hover or active */}
        <div
          className={cn(
            'absolute top-1/2 right-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border border-border bg-primary shadow-md transition-transform duration-100',
            isHovering || isDragging ? 'scale-100' : 'scale-0 group-hover:scale-100',
          )}
        />
      </div>
    </div>
  )
}

export default ProgressBar
