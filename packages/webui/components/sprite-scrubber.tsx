import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface SpriteScrubberProps {
  /** The URL of the 10x10 sprite sheet */
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
}

interface Dimensions {
  width: number
  height: number
}

const GRID_COLS = 10
const GRID_ROWS = 10
const TOTAL_FRAMES = GRID_COLS * GRID_ROWS

export const SpriteScrubber: React.FC<SpriteScrubberProps> = ({
  spriteUrl,
  thumbnailUrl,
  videoWidth,
  videoHeight,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<Dimensions>({
    width: 0,
    height: 0,
  })
  const [naturalSize, setNaturalSize] = useState<Dimensions>({
    width: 0,
    height: 0,
  })

  const [isHovering, setIsHovering] = useState(false)
  const [spriteLoaded, setSpriteLoaded] = useState(false)
  const [loadingSprite, setLoadingSprite] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [cursorX, setCursorX] = useState(0)

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

  const loadSprite = useCallback(() => {
    if (spriteLoaded || loadingSprite) return

    setLoadingSprite(true)
    const img = new Image()
    img.src = spriteUrl
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setSpriteLoaded(true)
      setLoadingSprite(false)
    }
    img.onerror = () => {
      console.error('Failed to load sprite image')
      setLoadingSprite(false)
    }
  }, [spriteUrl, spriteLoaded, loadingSprite])

  const handleMouseEnter = () => {
    setIsHovering(true)
    loadSprite()
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    const clampedX = Math.max(0, Math.min(x, rect.width))
    setCursorX(clampedX)

    const percentage = clampedX / rect.width
    const frameIndex = Math.min(Math.floor(percentage * TOTAL_FRAMES), TOTAL_FRAMES - 1)

    setCurrentFrame(frameIndex)
  }

  // Calculate styles for the inner sprite frame box
  const spriteStyle: React.CSSProperties = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return {}

    let sourceAspect = videoWidth / videoHeight
    if (naturalSize.width > 0 && naturalSize.height > 0) {
      const singleFrameNaturalW = naturalSize.width / GRID_COLS
      const singleFrameNaturalH = naturalSize.height / GRID_ROWS
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
    const bgWidth = finalW * GRID_COLS
    const bgHeight = finalH * GRID_ROWS

    const colIndex = currentFrame % GRID_COLS
    const rowIndex = Math.floor(currentFrame / GRID_COLS)

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
  }, [containerSize, videoWidth, videoHeight, currentFrame, spriteUrl, naturalSize])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden cursor-crosshair group bg-gray-900 select-none ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <img
        src={thumbnailUrl}
        alt="Thumbnail"
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
          isHovering && spriteLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        draggable={false}
      />

      {isHovering && !spriteLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {spriteLoaded && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-75 ${
            isHovering ? 'opacity-100' : 'opacity-0'
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
