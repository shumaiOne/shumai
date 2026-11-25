import { m } from '@/ui/paraglide/messages.js'
import type { Annotation } from '@/ui/types'
import { ImageOff, Loader2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { AnnotationOverlaySvg } from './annotation-overlay-svg'
import { computeCommentFrameBox, ERROR_MIN_HEIGHT, type Dimensions } from './sizing'

interface CommentFrameThumbnailProps {
  src: string
  annotations: Annotation[]
  initialDimensions?: Dimensions | null
  alt?: string
  onStatusChange?: (status: 'loaded' | 'error') => void
}

export const CommentFrameThumbnail: React.FC<CommentFrameThumbnailProps> = ({
  src,
  annotations,
  initialDimensions = null,
  alt = '',
  onStatusChange,
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [naturalSize, setNaturalSize] = useState<Dimensions | null>(initialDimensions)
  const imgRef = useRef<HTMLImageElement>(null)
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  useEffect(() => {
    setStatus('loading')
    setNaturalSize(initialDimensions)
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setStatus('loaded')
      onStatusChangeRef.current?.('loaded')
    }
  }, [src, initialDimensions])

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    setStatus('loaded')
    onStatusChangeRef.current?.('loaded')
  }

  const handleError = () => {
    setStatus('error')
    onStatusChangeRef.current?.('error')
  }

  const { width: boxWidth, height: boxHeight } = computeCommentFrameBox(naturalSize)
  const containerHeight = status === 'error' ? Math.max(boxHeight, ERROR_MIN_HEIGHT) : boxHeight

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-sm border border-border transparency-checkerboard shrink-0"
      style={{ width: boxWidth, height: containerHeight }}
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
        <>
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`block h-full w-full ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          />
          {status === 'loaded' && annotations.length > 0 && (
            <AnnotationOverlaySvg
              annotations={annotations}
              width={boxWidth}
              height={boxHeight}
              className="pointer-events-none absolute inset-0 h-full w-full z-10"
            />
          )}
        </>
      )}
    </div>
  )
}
