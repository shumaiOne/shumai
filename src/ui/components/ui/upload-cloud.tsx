import React from 'react'

interface UploadCloudIconProps extends React.SVGProps<SVGSVGElement> {
  uploading?: boolean
  className?: string
}

/**
 * Custom UploadCloudIcon component.
 * Replaces the animated version with a custom SVG while maintaining prop compatibility.
 */
export function UploadCloudIcon({
  uploading = false,
  className = '',
  ...props
}: UploadCloudIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={30}
      height={30}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M 44.4 75 H 30 A 15 15 0 0 1 30 45 A 20 20 0 0 1 70 45 A 15 15 0 0 1 70 75 H 55.6 V 61 H 61.2 L 50 47 L 38.8 61 H 44.4 Z"
        fill="currentColor"
        transform="scale(1.01, 1.05)"
      />
      {uploading && (
        <circle
          cx="50"
          cy="50"
          r="48"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="10 20"
          fill="none"
          className="animate-spin"
          style={{ transformOrigin: 'center' }}
        />
      )}
    </svg>
  )
}
