import React from 'react'

interface ProgressCircleProps {
  progress: number
  className?: string
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({ progress, className }) => {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width="50" height="50" viewBox="0 0 50 50" className={className}>
      <circle
        cx="25"
        cy="25"
        r={radius}
        className="stroke-current text-gray-200"
        strokeWidth="4"
        fill="transparent"
      />
      <circle
        cx="25"
        cy="25"
        r={radius}
        className="stroke-current text-blue-600"
        strokeWidth="4"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.3s' }}
        transform="rotate(-90 25 25)"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        className="text-xs font-semibold text-gray-700"
      >
        {`${Math.round(progress)}%`}
      </text>
    </svg>
  )
}
