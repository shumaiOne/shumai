import type { SpriteLayout } from '@shumai/dtos'
import React, { useEffect, useMemo, useRef, useState } from 'react'

interface SpriteScrubberProps {
  spriteUrl: string
  spriteLayout?: SpriteLayout
  /** A full-asset 10x10 sprite to try when the primary sprite fails. */
  fallbackSpriteUrl?: string
  /** The URL of the static thumbnail */
  thumbnailUrl?: string
  /** The width of the original video source */
  videoWidth?: number
  /** The height of the original video source */
  videoHeight?: number
  /** The fixed width of a single frame in the sprite sheet (default 480) */
  frameWidth?: number
  /** Optional custom class name for the container */
  className?: string
  /** Whether to reverse scrubbing order (e.g. for 3D model rotation so moving right rotates right) */
  reverse?: boolean
}

interface Dimensions {
  width: number
  height: number
}

const FULL_SPRITE_LAYOUT: SpriteLayout = { columns: 10, rows: 10, frameCount: 100 }

interface SpriteLoadResult {
  primaryUrl: string
  fallbackUrl?: string
  image?: Dimensions & { url: string; isFallback: boolean }
}

export const SpriteScrubber: React.FC<SpriteScrubberProps> = ({
  spriteUrl,
  spriteLayout = FULL_SPRITE_LAYOUT,
  fallbackSpriteUrl,
  thumbnailUrl,
  videoWidth = 1,
  videoHeight = 1,
  className = '',
  reverse = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<Dimensions>({
    width: 0,
    height: 0,
  })
  const [isHovering, setIsHovering] = useState(false)
  const [hasHovered, setHasHovered] = useState(false)
  const [loadResult, setLoadResult] = useState<SpriteLoadResult>()
  const [cursorX, setCursorX] = useState(0)
  const [progress, setProgress] = useState<number>()

  const result =
    loadResult?.primaryUrl === spriteUrl && loadResult.fallbackUrl === fallbackSpriteUrl
      ? loadResult
      : undefined
  const sprite = result?.image
  const { columns, rows, frameCount } = sprite?.isFallback ? FULL_SPRITE_LAYOUT : spriteLayout
  const frame = Math.min(Math.floor((progress ?? 0) * frameCount), frameCount - 1)
  const currentFrame = reverse && progress !== undefined ? frameCount - 1 - frame : frame

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
    if (!hasHovered) return
    const img = new Image()
    const request = { primaryUrl: spriteUrl, fallbackUrl: fallbackSpriteUrl }
    const load = (url: string, isFallback: boolean) => {
      img.onload = () => {
        setLoadResult({
          ...request,
          image: { url, isFallback, width: img.naturalWidth, height: img.naturalHeight },
        })
      }
      img.onerror = () => {
        if (!isFallback && fallbackSpriteUrl && fallbackSpriteUrl !== spriteUrl) {
          load(fallbackSpriteUrl, true)
          return
        }
        setLoadResult(request)
      }
      img.src = url
    }
    load(spriteUrl, false)
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [fallbackSpriteUrl, hasHovered, spriteUrl])

  const handleMouseEnter = () => {
    setIsHovering(true)
    setHasHovered(true)
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
    setProgress(rect.width > 0 ? clampedX / rect.width : 0)
  }

  // Calculate styles for the inner sprite frame box
  const spriteStyle: React.CSSProperties = useMemo(() => {
    if (!sprite || containerSize.width === 0 || containerSize.height === 0) return {}

    let sourceAspect = videoWidth / videoHeight
    if (sprite.width > 0 && sprite.height > 0) {
      const singleFrameNaturalW = sprite.width / columns
      const singleFrameNaturalH = sprite.height / rows
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
      backgroundImage: `url(${sprite.url})`,
      backgroundSize: `${bgWidth}px ${bgHeight}px`,
      backgroundPosition: `${bgPosX}px ${bgPosY}px`,
      backgroundRepeat: 'no-repeat',
      width: `${finalW}px`,
      height: `${finalH}px`,
      // Optional: helps with crisp edges on some screens, though default is usually fine
      imageRendering: 'auto',
    }
  }, [containerSize, videoWidth, videoHeight, currentFrame, sprite, columns, rows])

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
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt="Thumbnail"
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
            isHovering && sprite ? 'opacity-0' : 'opacity-100'
          }`}
          draggable={false}
        />
      )}

      {isHovering && !result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {sprite && (
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-75 ${
            isHovering ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div style={spriteStyle} />
        </div>
      )}

      {isHovering && (!result || sprite) && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_4px_rgba(255,0,0,0.8)] z-20 pointer-events-none"
          style={{ transform: `translateX(${cursorX}px)` }}
        />
      )}
    </div>
  )
}
