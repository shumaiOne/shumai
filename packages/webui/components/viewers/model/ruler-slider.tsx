import { cn } from '@/ui/lib/utils'
import { Minus, Plus } from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'

export interface RulerSliderProps {
  currentDegree: number // 0 to 360 (or normalized modulo 360)
  onChange: (degree: number) => void
  className?: string
  disabled?: boolean
}

const STEP = 15
const PX_PER_STEP = 20 // 20px per 15° step
const PX_PER_DEGREE = PX_PER_STEP / STEP // ~1.333px per degree
const BUFFER_DEGREE = 240 // Render buffer on each side of the active degree

export const RulerSlider: React.FC<RulerSliderProps> = ({
  currentDegree,
  onChange,
  className,
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragDegree, setDragDegree] = useState<number | null>(null)
  const dragStartRef = useRef<{ clientX: number; startDegree: number }>({
    clientX: 0,
    startDegree: 0,
  })

  const normalizedDegree = (((Math.round(currentDegree / STEP) * STEP) % 360) + 360) % 360
  const activeDegree = isDragging && dragDegree !== null ? dragDegree : normalizedDegree
  const displayedDegree = (((Math.round(activeDegree / STEP) * STEP) % 360) + 360) % 360

  const handleStep = useCallback(
    (delta: number) => {
      if (disabled) return
      const next = (((normalizedDegree + delta) % 360) + 360) % 360
      onChange(next)
    },
    [disabled, normalizedDegree, onChange],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const target = trackRef.current
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
      const snapped = (((Math.round(nextRawDegree / STEP) * STEP) % 360) + 360) % 360
      setDragDegree(nextRawDegree)
      onChange(snapped)
    },
    [isDragging, disabled, onChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      setIsDragging(false)
      if (dragDegree !== null) {
        const snapped = (((Math.round(dragDegree / STEP) * STEP) % 360) + 360) % 360
        onChange(snapped)
      }
      setDragDegree(null)
      try {
        trackRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        // pointer may have already been released
      }
    },
    [isDragging, dragDegree, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        handleStep(-STEP)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        handleStep(STEP)
      } else if (e.key === 'Home') {
        e.preventDefault()
        e.stopPropagation()
        onChange(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        e.stopPropagation()
        onChange(345)
      }
    },
    [disabled, handleStep, onChange],
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
      className={cn(
        'relative select-none flex items-center gap-1 sm:gap-2.5 w-full min-w-0 sm:min-w-[140px]',
        disabled && 'opacity-50',
        className,
      )}
    >
      {/* Minus button on left */}
      <button
        type="button"
        onClick={() => handleStep(-STEP)}
        disabled={disabled}
        title="Decrease 15°"
        aria-label="Decrease 15°"
        data-testid="ruler-step-minus"
        className="p-0.5 sm:p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      {/* Center Capsule Slider Track Container */}
      <div className="relative flex-1 min-w-0">
        {/* Tooltip above center indicator (visible only when dragging) */}
        {isDragging && (
          <div
            data-testid="ruler-slider-tooltip"
            className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-mono font-medium shadow-md whitespace-nowrap pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-100"
          >
            {displayedDegree}°
          </div>
        )}

        {/* Capsule track with rounded pill shape, clipping scrolling ticks */}
        <div
          ref={trackRef}
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
            'relative w-full h-7 rounded-full bg-muted border border-border overflow-hidden cursor-ew-resize touch-none select-none group focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            disabled && 'cursor-not-allowed',
          )}
        >
          {/* Cyclic Ticks - vertically centered */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
                    'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-colors pointer-events-none rounded-[0.5px]',
                    isMajor
                      ? 'w-0.5 h-2.5 bg-foreground/75'
                      : 'w-px h-1.5 bg-muted-foreground/45 group-hover:bg-muted-foreground/65',
                  )}
                  style={{ left: `calc(50% + ${offsetPx}px)` }}
                />
              )
            })}
          </div>

          {/* Fixed Center Red Indicator (Pinned at 50% horizontally, spans full height) */}
          <div
            data-testid="ruler-center-indicator"
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="w-full h-full bg-[#ea3349] rounded-full" />
          </div>
        </div>
      </div>

      {/* Plus button on right */}
      <button
        type="button"
        onClick={() => handleStep(STEP)}
        disabled={disabled}
        title="Increase 15°"
        aria-label="Increase 15°"
        data-testid="ruler-step-plus"
        className="p-0.5 sm:p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
