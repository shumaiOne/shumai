import { m } from '@/ui/paraglide/messages.js'
import type { Annotation } from '@/ui/types'
import { ImageOff, Loader2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { AnnotationOverlaySvg } from './annotation-overlay-svg'

const BOX_WIDTH = 200
const BOX_HEIGHT = 112

interface CommentFrameThumbnailProps {
  src: string
  annotations: Annotation[]
  alt?: string
  onStatusChange?: (status: 'loaded' | 'error') => void
}

export const CommentFrameThumbnail: React.FC<CommentFrameThumbnailProps> = ({
  src,
  annotations,
  alt = '',
  onStatusChange,
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
  })
  const imgRef = useRef<HTMLImageElement>(null)
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  useEffect(() => {
    setStatus('loading')
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setStatus('loaded')
      onStatusChangeRef.current?.('loaded')
    }
  }, [src])

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const nw = img.naturalWidth || BOX_WIDTH
    const nh = img.naturalHeight || BOX_HEIGHT
    setNaturalSize({ width: nw, height: nh })
    setStatus('loaded')
    onStatusChangeRef.current?.('loaded')
  }

  const handleError = () => {
    setStatus('error')
    onStatusChangeRef.current?.('error')
  }

  // Fit the actual image rect inside 200x112 while preserving aspect ratio so the
  // SVG markup overlay aligns accurately for portrait, square, PDF, and ultrawide media.
  const scale = Math.min(BOX_WIDTH / naturalSize.width, BOX_HEIGHT / naturalSize.height)
  const fittedWidth = Math.max(1, Math.round(naturalSize.width * scale))
  const fittedHeight = Math.max(1, Math.round(naturalSize.height * scale))

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-sm border border-border transparency-checkerboard shrink-0"
      style={{ width: BOX_WIDTH, height: BOX_HEIGHT }}
      data-testid="print-comment-frame"
    >
      {status === 'loading' && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-muted/95 text-muted-foreground"
          data-testid="print-frame-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[11px] leading-none">{m.print_comments_frame_loading()}</span>
        </div>
      )}

      {status === 'error' ? (
        <div
          className="flex flex-col items-center justify-center gap-1.5 px-2 text-center text-muted-foreground"
          data-testid="print-frame-error"
        >
          <ImageOff className="h-4 w-4" />
          <span className="text-[11px] leading-tight">{m.print_comments_frame_unavailable()}</span>
        </div>
      ) : (
        <div
          className="relative"
          style={{
            width: status === 'loaded' ? fittedWidth : BOX_WIDTH,
            height: status === 'loaded' ? fittedHeight : BOX_HEIGHT,
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`block h-full w-full object-contain transition-opacity duration-150 ${
              status === 'loaded' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {status === 'loaded' && annotations.length > 0 && (
            <AnnotationOverlaySvg
              annotations={annotations}
              width={fittedWidth}
              height={fittedHeight}
              className="pointer-events-none absolute inset-0 h-full w-full z-10"
            />
          )}
        </div>
      )}
    </div>
  )
}
