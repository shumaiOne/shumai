import React from 'react'
import { cn } from '@/ui/lib/utils'

interface ProgressCircleProps {
  progress: number
  className?: string
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({ progress, className }) => {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference

  return (
    <svg viewBox="0 0 50 50" className={cn('w-12 h-12', className)}>
      <circle
        cx="25"
        cy="25"
        r={radius}
        className="stroke-muted"
        strokeWidth="4"
        fill="transparent"
      />
      <circle
        cx="25"
        cy="25"
        r={radius}
        className="stroke-primary transition-all duration-300 ease-out"
        strokeWidth="4"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 25 25)"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        className="fill-foreground text-[10px] font-bold"
      >
        {`${Math.round(progress)}%`}
      </text>
    </svg>
  )
}
