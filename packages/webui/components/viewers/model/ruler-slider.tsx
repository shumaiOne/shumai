import React, { useCallback, useRef, useState } from 'react'
import { cn } from '@/ui/lib/utils'

interface RulerSliderProps {
  currentDegree: number // 0 to 360 (or normalized modulo 360)
  onChange: (degree: number) => void
  className?: string
  disabled?: boolean
}

const PX_PER_DEGREE = 1.6 // 24px per 15° step
const STEP = 15
const BUFFER_DEGREE = 240 // Render buffer on each side of the active degree

export const RulerSlider: React.FC<RulerSliderProps> = ({
  currentDegree,
  onChange,
  className,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragDegree, setDragDegree] = useState<number | null>(null)
  const dragStartRef = useRef<{ clientX: number; startDegree: number }>({
    clientX: 0,
    startDegree: 0,
  })

  const normalizedDegree = (((Math.round(currentDegree / STEP) * STEP) % 360) + 360) % 360
  const activeDegree = isDragging && dragDegree !== null ? dragDegree : normalizedDegree
  const displayedDegree = (((Math.round(activeDegree / STEP) * STEP) % 360) + 360) % 360

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const target = containerRef.current
      if (!target) return
      target.setPointerCapture(e.pointerId)

      dragStartRef.current = {
        clientX: e.clientX,
        startDegree: currentDegree,
      }
      setIsDragging(true)
      setDragDegree(currentDegree)
    },
    [disabled, currentDegree],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || disabled) return
      const deltaX = e.clientX - dragStartRef.current.clientX
      // Dragging left (deltaX < 0) rotates turntable forward (angle increases)
      const nextRawDegree = dragStartRef.current.startDegree - deltaX / PX_PER_DEGREE
      setDragDegree(nextRawDegree)

      const snapped = (((Math.round(nextRawDegree / STEP) * STEP) % 360) + 360) % 360
      onChange(snapped)
    },
    [isDragging, disabled, onChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      setIsDragging(false)
      setDragDegree(null)
      try {
        containerRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        // pointer may have already been released
      }
    },
    [isDragging],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        onChange((((normalizedDegree - STEP) % 360) + 360) % 360)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        onChange((normalizedDegree + STEP) % 360)
      } else if (e.key === 'Home') {
        e.preventDefault()
        onChange(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        onChange(345)
      }
    },
    [disabled, normalizedDegree, onChange],
  )

  // Compute visible ticks dynamically around activeDegree for seamless cyclic looping
  const minTickIndex = Math.floor((activeDegree - BUFFER_DEGREE) / STEP)
  const maxTickIndex = Math.ceil((activeDegree + BUFFER_DEGREE) / STEP)
  const ticks: number[] = []
  for (let i = minTickIndex; i <= maxTickIndex; i++) {
    ticks.push(i * STEP)
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Turntable angle"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={displayedDegree}
      aria-valuetext={`${displayedDegree}°`}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative select-none cursor-ew-resize flex flex-col justify-end h-9 touch-none overflow-hidden group',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {/* Tooltip above center indicator (visible only when dragging) */}
      {isDragging && (
        <div
          data-testid="ruler-slider-tooltip"
          className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-mono font-medium shadow-md whitespace-nowrap pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-100"
        >
          {displayedDegree}°
        </div>
      )}

      {/* Moving Track & Ticks with Edge Mask */}
      <div
        className="relative w-full h-5 flex items-end overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
          webkitMaskImage:
            'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
        }}
      >
        {/* Baseline bar */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted-foreground/20 rounded-full" />

        {/* Cyclic Ticks */}
        {ticks.map((tickAngle) => {
          const offsetPx = (tickAngle - activeDegree) * PX_PER_DEGREE
          const deg = ((tickAngle % 360) + 360) % 360
          const isMajor = deg % 60 === 0

          return (
            <div
              key={`tick-${tickAngle}`}
              data-testid={`tick-${deg}`}
              data-major={isMajor}
              className={cn(
                'absolute bottom-0 -translate-x-1/2 transition-colors pointer-events-none',
                isMajor
                  ? 'w-0.5 h-4 bg-foreground/75'
                  : 'w-px h-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/60',
              )}
              style={{ left: `calc(50% + ${offsetPx}px)` }}
            />
          )
        })}
      </div>

      {/* Fixed Center Indicator (Pinned at 50% horizontally) */}
      <div
        data-testid="ruler-center-indicator"
        className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-20"
      >
        <div className="w-0.5 h-5 bg-primary rounded-full shadow-xs ring-1 ring-background/50" />
      </div>
    </div>
  )
}
