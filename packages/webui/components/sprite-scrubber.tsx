import React, { useEffect, useMemo, useRef, useState } from 'react'

interface SpriteScrubberProps {
  /** The URL of the sprite sheet, which defaults to a 10x10 layout. */
  spriteUrl: string
  /** The URL of the static thumbnail */
  thumbnailUrl: string
  /** The width of the original video source */
  videoWidth: number
  /** The height of the original video source */
  videoHeight: number
  /** The fixed width of a single frame in the sprite sheet (default 480) */
  frameWidth?: number
  /** Optional custom class name for the container */
  className?: string
  /** Whether to reverse scrubbing order (e.g. for 3D model rotation so moving right rotates right) */
  reverse?: boolean
  active?: boolean
  columns?: number
  rows?: number
  frames?: ReadonlyArray<{ index: number; position: number }>
}

interface Dimensions {
  width: number
  height: number
}

export const SpriteScrubber: React.FC<SpriteScrubberProps> = ({
  spriteUrl,
  thumbnailUrl,
  videoWidth,
  videoHeight,
  className = '',
  reverse = false,
  active,
  columns = 10,
  rows = 10,
  frames,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<Dimensions>({
    width: 0,
    height: 0,
  })
  const [isHovering, setIsHovering] = useState(false)
  const [loadedSprite, setLoadedSprite] = useState<(Dimensions & { url: string }) | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [cursorX, setCursorX] = useState(0)
  const showingPreview = active ?? isHovering
  const naturalSize = loadedSprite?.url === spriteUrl ? loadedSprite : null
  const totalFrames = columns * rows
  let currentFrame = 0
  if (frames?.length) {
    const cursorPosition = position ?? 0.5
    currentFrame = frames.reduce((closest, frame) =>
      Math.abs(cursorPosition - frame.position) < Math.abs(cursorPosition - closest.position)
        ? frame
        : closest,
    ).index
  } else if (position !== null) {
    const frame = Math.min(Math.floor(position * totalFrames), totalFrames - 1)
    currentFrame = reverse ? totalFrames - 1 - frame : frame
  }

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!showingPreview || naturalSize) return
    const img = new Image()
    img.onload = () => {
      setLoadedSprite({ url: spriteUrl, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      console.error('Failed to load sprite image')
    }
    img.src = spriteUrl
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [spriteUrl, showingPreview, naturalSize])

  const handleMouseEnter = () => {
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width <= 0) return
    const x = e.clientX - rect.left

    const clampedX = Math.max(0, Math.min(x, rect.width))
    setCursorX(clampedX)

    setPosition(clampedX / rect.width)
  }

  // Calculate styles for the inner sprite frame box
  const spriteStyle: React.CSSProperties = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return {}

    let sourceAspect = videoWidth / videoHeight
    if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
      const singleFrameNaturalW = naturalSize.width / columns
      const singleFrameNaturalH = naturalSize.height / rows
      sourceAspect = singleFrameNaturalW / singleFrameNaturalH
    }

    const containerAspect = containerSize.width / containerSize.height

    let renderWidth, renderHeight

    if (containerAspect > sourceAspect) {
      renderHeight = containerSize.height
      renderWidth = renderHeight * sourceAspect
    } else {
      renderWidth = containerSize.width
      renderHeight = renderWidth / sourceAspect
    }

    // Using Math.ceil ensures we never have sub-pixel gaps (black lines)
    // caused by flooring or rounding down.
    const finalW = Math.ceil(renderWidth)
    const finalH = Math.ceil(renderHeight)

    // IMPORTANT: We calculate the sheet size based on the SNAPPED frame size.
    // This slightly stretches the sprite if needed but ensures that every frame
    // falls exactly on an integer pixel boundary, preventing "shaking" during playback.
    const bgWidth = finalW * columns
    const bgHeight = finalH * rows

    const colIndex = currentFrame % columns
    const rowIndex = Math.floor(currentFrame / columns)

    const bgPosX = -(colIndex * finalW)
    const bgPosY = -(rowIndex * finalH)

    return {
      backgroundImage: `url(${spriteUrl})`,
      backgroundSize: `${bgWidth}px ${bgHeight}px`,
      backgroundPosition: `${bgPosX}px ${bgPosY}px`,
      backgroundRepeat: 'no-repeat',
      width: `${finalW}px`,
      height: `${finalH}px`,
      // Optional: helps with crisp edges on some screens, though default is usually fine
      imageRendering: 'auto',
    }
  }, [containerSize, videoWidth, videoHeight, currentFrame, spriteUrl, naturalSize, columns, rows])

  return (
    <div
      ref={containerRef}
      data-testid="sprite-scrubber"
      data-frame={currentFrame}
      className={`relative w-full h-full overflow-hidden cursor-pointer group bg-black select-none ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <img
        src={thumbnailUrl}
        alt="Thumbnail"
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
          showingPreview && naturalSize ? 'opacity-0' : 'opacity-100'
        }`}
        draggable={false}
      />

      {showingPreview && !naturalSize && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {naturalSize && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-75 ${
            showingPreview ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div style={spriteStyle} />
        </div>
      )}

      {isHovering && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_4px_rgba(255,0,0,0.8)] z-20 pointer-events-none"
          style={{ transform: `translateX(${cursorX}px)` }}
        />
      )}
    </div>
  )
}
