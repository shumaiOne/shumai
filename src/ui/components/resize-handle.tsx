import { useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  className?: string
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onResize,

  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const startXref = useRef(0)

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate how much the mouse has moved
      const delta = e.clientX - startXref.current
      // Update the reference point for the next frame
      startXref.current = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = '' // Reset cursor
    }

    // Attach global listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Force cursor style on body to prevent flickering during fast drags
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
    }
  }, [isDragging, onResize])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    startXref.current = e.clientX
  }

  // Common hit area that is always larger than the visible element for usability
  const HitArea = () => (
    <div className="absolute inset-y-0 -left-4 -right-4 z-20 cursor-col-resize touch-none" />
  )

  return (
    <div
      className={`group relative z-20 flex h-full w-[2px] cursor-col-resize items-center justify-center bg-border transition-all hover:bg-transparent ${className}`}
      onMouseDown={handleMouseDown}
    >
      <HitArea />

      {/* The glowing vertical line */}
      <div
        className={`absolute inset-y-0 w-[2px] transition-all duration-300 ease-out
          ${
            isDragging
              ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.6)] opacity-100'
              : 'bg-blue-400 opacity-0 group-hover:opacity-100 group-hover:shadow-[0_0_8px_rgba(96,165,250,0.5)]'
          }
        `}
      />

      {/* The central drag handle (Pill) */}
      <div
        className={`absolute top-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 transition-all duration-300 ease-out
        ${
          isDragging
            ? 'opacity-100 scale-100 shadow-[0_0_10px_rgba(37,99,235,0.5)]'
            : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
        }`}
      />
    </div>
  )
}
