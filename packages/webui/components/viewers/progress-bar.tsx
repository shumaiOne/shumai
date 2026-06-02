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
  duration: number
  currentTime: number
  previewUrl?: string
  onSeek: (time: number) => void
  buffered?: number
  metadata?: MediaMetadata
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  duration,
  currentTime,
  previewUrl,
  onSeek,
  buffered = 0,
  metadata,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null) // 0 to 1
  const [isHovering, setIsHovering] = useState(false)

  // Load the preview video in background
  useEffect(() => {
    if (previewVideoRef.current && previewUrl) {
      previewVideoRef.current.load()
    }
  }, [previewUrl])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const percentage = x / rect.width

      setHoverPosition(percentage)
      setIsHovering(true)

      if (previewVideoRef.current && duration) {
        const seekTime = percentage * duration
        // Use fastSeek if available for smoother scrubbing, otherwise currentTime
        const vid = previewVideoRef.current
        if (Number.isFinite(seekTime)) {
          vid.currentTime = seekTime
        }
      }
    },
    [duration],
  )

  const handleMouseLeave = () => {
    setIsHovering(false)
    setHoverPosition(null)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !duration) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    onSeek(percentage * duration)
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const hoverPercent = hoverPosition !== null ? hoverPosition * 100 : 0

  // Calculate preview tooltip position
  // Logic: Interpolate translation based on position to keep preview fully visible
  // 0% -> translateX(0%) (Left aligned)
  // 50% -> translateX(-50%) (Center aligned)
  // 100% -> translateX(-100%) (Right aligned)
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
      className="group relative h-1.5 w-full cursor-pointer touch-none rounded-full bg-gray-300 transition-colors duration-200 dark:bg-white/20"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
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
      {isHovering && duration > 0 && (
        <div
          className="pointer-events-none absolute bottom-full z-50 mb-3 flex w-max flex-col"
          style={getTooltipStyle()}
        >
          <div className="relative overflow-hidden rounded-lg border-2 border-gray-300 bg-white shadow-2xl dark:border-white/50 dark:bg-black">
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
            <div className="absolute bottom-0 w-full bg-white/80 py-0.5 text-center text-xs font-medium text-gray-900 dark:bg-black/60 dark:text-white">
              {formatTime(hoverPosition! * duration)}
            </div>
          </div>
        </div>
      )}

      {/* Buffered Bar */}
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-gray-400 transition-all duration-200 dark:bg-white/30"
        style={{ width: `${buffered}%` }}
      />

      {/* Hover Highlight Bar */}
      {isHovering && (
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-gray-500/40 dark:bg-white/40"
          style={{ width: `${hoverPercent}%` }}
        />
      )}

      {/* Play Progress Bar */}
      <div
        className="relative absolute top-0 left-0 h-full rounded-full bg-blue-600 dark:bg-blue-500"
        style={{ width: `${progressPercent}%` }}
      >
        {/* Thumb (Playhead) - visible on group hover or active */}
        <div className="absolute top-1/2 right-0 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 scale-0 rounded-full border border-gray-200 bg-white shadow-md transition-transform duration-100 group-hover:scale-100 dark:border-none" />
      </div>
    </div>
  )
}

export default ProgressBar
