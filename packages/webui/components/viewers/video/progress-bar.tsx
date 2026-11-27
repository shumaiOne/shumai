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

export interface SeekbarScrubHandlers {
  onStart: (frame: number) => void
  onMove: (frame: number) => void
  onEnd: (frame: number) => void
  onCancel: () => void
}

interface ProgressBarProps {
  totalFrames: number
  currentFrame: number
  fps: number
  previewUrl?: string
  onSeek: (frame: number) => void
  scrub?: SeekbarScrubHandlers
  buffered?: number
  metadata?: MediaMetadata
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  totalFrames,
  currentFrame,
  fps,
  previewUrl,
  onSeek,
  scrub,
  buffered = 0,
  metadata,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null) // 0 to 1
  const [isHovering, setIsHovering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  // Tracks whether the pointer actually moved during a drag. A plain tap/click
  // already seeks on pointer-down; re-seeking to the same frame on release
  // restarts the native seek and stalls playback on slow connections.
  const didDragMoveRef = useRef(false)
  const lastSeekPosRef = useRef<number | null>(null)
  // After a touch interaction, mobile browsers fire synthetic mouse events
  // (mousedown/mouseup) for the same tap. Suppress them so one tap does not
  // trigger a second seek through the mouse path.
  const lastTouchEndAtRef = useRef(0)

  const handlersRef = useRef({ onSeek, scrub })
  useEffect(() => {
    handlersRef.current = { onSeek, scrub }
  }, [onSeek, scrub])

  useEffect(
    () => () => {
      if (didDragMoveRef.current) handlersRef.current.scrub?.onCancel()
    },
    [],
  )

  // Load the preview video in background
  useEffect(() => {
    if (previewVideoRef.current && previewUrl) {
      previewVideoRef.current.load()
    }
  }, [previewUrl])

  const getPercentageFromEvent = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect?.width) return 0
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return x / rect.width
  }, [])

  const seekPreview = useCallback(
    (percentage: number) => {
      const video = previewVideoRef.current
      const seekTime = (percentage * totalFrames + 0.5) / fps
      if (video && totalFrames > 0 && Number.isFinite(seekTime)) {
        video.currentTime = seekTime
      }
    },
    [totalFrames, fps],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return
      const percentage = getPercentageFromEvent(e.clientX)
      setHoverPosition(percentage)
      setIsHovering(true)
      seekPreview(percentage)
    },
    [getPercentageFromEvent, isDragging, seekPreview],
  )

  const handleMouseLeave = () => {
    if (!isDragging) {
      setIsHovering(false)
      setHoverPosition(null)
    }
  }

  const startInteraction = (clientX: number) => {
    if (isDragging || totalFrames <= 0) return
    setIsDragging(true)
    didDragMoveRef.current = false
    lastSeekPosRef.current = clientX
    const percentage = getPercentageFromEvent(clientX)
    setHoverPosition(percentage)
    setIsHovering(true)
    if (!scrub) onSeek(percentage * totalFrames)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || Date.now() - lastTouchEndAtRef.current < 700) return
    e.preventDefault()
    startInteraction(e.clientX)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) startInteraction(e.touches[0].clientX)
  }

  useEffect(() => {
    if (!isDragging) return

    const moveInteraction = (clientX: number) => {
      const start = lastSeekPosRef.current
      if (start === null) return
      const alreadyMoved = didDragMoveRef.current
      if (!alreadyMoved && Math.abs(clientX - start) < 2) return
      didDragMoveRef.current = true
      const percentage = getPercentageFromEvent(clientX)
      setHoverPosition(percentage)
      setIsHovering(true)

      const { onSeek, scrub } = handlersRef.current
      const frame = percentage * totalFrames
      if (scrub) {
        if (alreadyMoved) scrub.onMove(frame)
        else scrub.onStart(frame)
      } else {
        seekPreview(percentage)
        onSeek(frame)
      }
    }

    const finishInteraction = (clientX: number, clientY: number, isTouch = false) => {
      if (lastSeekPosRef.current === null) return
      const { onSeek, scrub } = handlersRef.current
      const moved = didDragMoveRef.current
      didDragMoveRef.current = false
      lastSeekPosRef.current = null
      setIsDragging(false)
      const percentage = getPercentageFromEvent(clientX)
      const rect = containerRef.current?.getBoundingClientRect()
      if (
        !rect ||
        (isTouch && scrub) ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsHovering(false)
        setHoverPosition(null)
      } else if (scrub) {
        setHoverPosition(percentage)
        seekPreview(percentage)
      }

      const frame = percentage * totalFrames
      if (scrub && moved) {
        scrub.onEnd(frame)
      } else if (scrub || moved) {
        // Compare and audio already seek on press, so only commit moved gestures here.
        onSeek(frame)
      }
    }

    const cancelInteraction = () => {
      if (didDragMoveRef.current) handlersRef.current.scrub?.onCancel()
      didDragMoveRef.current = false
      lastSeekPosRef.current = null
      setIsDragging(false)
      setIsHovering(false)
      setHoverPosition(null)
    }

    const handleWindowMouseMove = (e: MouseEvent) => moveInteraction(e.clientX)
    const handleWindowMouseUp = (e: MouseEvent) => finishInteraction(e.clientX, e.clientY)
    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) moveInteraction(e.touches[0].clientX)
    }
    const handleWindowTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return
      lastTouchEndAtRef.current = Date.now()
      const touch = e.changedTouches[0]
      if (touch) finishInteraction(touch.clientX, touch.clientY, true)
      else cancelInteraction()
    }
    const handleWindowTouchCancel = () => {
      lastTouchEndAtRef.current = Date.now()
      cancelInteraction()
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true })
    window.addEventListener('touchend', handleWindowTouchEnd)
    window.addEventListener('touchcancel', handleWindowTouchCancel)
    window.addEventListener('blur', cancelInteraction)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('touchmove', handleWindowTouchMove)
      window.removeEventListener('touchend', handleWindowTouchEnd)
      window.removeEventListener('touchcancel', handleWindowTouchCancel)
      window.removeEventListener('blur', cancelInteraction)
    }
  }, [isDragging, totalFrames, getPercentageFromEvent, seekPreview])

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
      data-testid="seekbar"
    >
      {/* Hidden Preview Video Element */}
      <video
        ref={previewVideoRef}
        src={previewUrl}
        className="hidden"
        preload="metadata"
        muted
        playsInline
      />

      {/* Hover Preview Tooltip */}
      {isHovering && totalFrames > 0 && !(scrub && isDragging) && (
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
        data-testid="seekbar-fill"
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
