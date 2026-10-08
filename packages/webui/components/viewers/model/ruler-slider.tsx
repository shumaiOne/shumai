import React, { useCallback, useRef, useState } from 'react'
import { cn } from '@/ui/lib/utils'

interface RulerSliderProps {
  currentDegree: number // 0 to 360
  onChange: (degree: number) => void
  className?: string
  disabled?: boolean
}

const TICKS = Array.from({ length: 25 }, (_, i) => i * 15)
const MAJOR_TICKS = new Set([0, 90, 180, 270, 360])

export const RulerSlider: React.FC<RulerSliderProps> = ({
  currentDegree,
  onChange,
  className,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const target = containerRef.current
      if (!target) return
      target.setPointerCapture(e.pointerId)
      setIsDragging(true)

      const rect = target.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const snapped = Math.min(360, Math.max(0, Math.round((ratio * 360) / 15) * 15))
      onChange(snapped)
    },
    [disabled, onChange],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || disabled) return
      const target = containerRef.current
      if (!target) return

      const rect = target.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const snapped = Math.min(360, Math.max(0, Math.round((ratio * 360) / 15) * 15))
      onChange(snapped)
    },
    [isDragging, disabled, onChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      setIsDragging(false)
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
        onChange(Math.max(0, currentDegree - 15))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        onChange(Math.min(360, currentDegree + 15))
      } else if (e.key === 'Home') {
        e.preventDefault()
        onChange(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        onChange(360)
      }
    },
    [disabled, currentDegree, onChange],
  )

  const clampedDegree = Math.min(360, Math.max(0, currentDegree))
  const percent = (clampedDegree / 360) * 100

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Turntable angle"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={clampedDegree}
      aria-valuetext={`${clampedDegree}°`}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative select-none cursor-pointer flex flex-col justify-end h-11 px-2.5 touch-none group',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {/* Major tick labels */}
      <div className="relative w-full h-3 mb-1 pointer-events-none">
        {Array.from(MAJOR_TICKS).map((deg) => (
          <span
            key={`label-${deg}`}
            className="absolute text-[10px] leading-none font-mono text-muted-foreground -translate-x-1/2"
            style={{ left: `${(deg / 360) * 100}%` }}
          >
            {deg}°
          </span>
        ))}
      </div>

      {/* Track & Ticks */}
      <div className="relative w-full h-4 flex items-end">
        {/* Baseline bar */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted-foreground/30 rounded-full" />

        {/* Ticks */}
        {TICKS.map((deg) => {
          const isMajor = MAJOR_TICKS.has(deg)
          return (
            <div
              key={`tick-${deg}`}
              className={cn(
                'absolute bottom-0 -translate-x-1/2 transition-colors',
                isMajor
                  ? 'w-0.5 h-3.5 bg-foreground/70'
                  : 'w-px h-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/70',
              )}
              style={{ left: `${(deg / 360) * 100}%` }}
            />
          )
        })}

        {/* Current Position Thumb */}
        <div
          className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-[left] duration-75 ease-out"
          style={{ left: `${percent}%` }}
        >
          {/* Degree Tooltip on drag/hover */}
          <div className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-primary text-primary-foreground mb-1 shadow-xs whitespace-nowrap">
            {clampedDegree}°
          </div>
          {/* Thumb needle */}
          <div className="w-1.5 h-5 bg-primary rounded-full ring-2 ring-background shadow-md" />
        </div>
      </div>
    </div>
  )
}
