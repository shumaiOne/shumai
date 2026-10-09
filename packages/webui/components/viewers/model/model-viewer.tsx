import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/ui/lib/utils'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import type { FileViewerProps, MediaController } from '../types'
import { centeredPan, fitScale, zoomAtPoint } from '../pan-zoom'
import { ModelControlBar } from './model-control-bar'
import { secondToDegree } from './index'

const TOTAL_FRAMES = 24
const FPS = 6
const FRAME_DURATION = 1 / FPS

export const ModelViewer = React.forwardRef<MediaController, FileViewerProps>(
  (
    {
      file: data,
      onPlay,
      onPause,
      onTimeUpdate,
      annotations,
      startTime,
      children,
      allowDownload = true,
      autoPlay = false,
    },
    ref,
  ) => {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(startTime || 0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Pan & Zoom
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false)

    // Drag-to-rotate state
    const [isDraggingRotation, setIsDraggingRotation] = useState(false)
    const dragStartRef = useRef<{ clientX: number; frame: number }>({ clientX: 0, frame: 0 })

    const videoSrc = data.media?.videoPreview?.url || data.media?.videoTranscodes?.[0]?.url || ''
    const downloadUrl = data.media?.original?.key ? videoSrc : undefined

    // Drawing Annotation store
    const {
      isDrawing,
      currentTool,
      currentColor,
      addAnnotation,
      annotations: draftAnnotations,
    } = useAnnotationStore()

    const displayAnnotations = [...(annotations || []), ...draftAnnotations]
    const isDrawingMode = isDrawing

    const mediaWidth = data.media?.metadata?.originalWidth || 1080
    const mediaHeight = data.media?.metadata?.originalHeight || 1080

    // Resize observer
    useEffect(() => {
      if (!containerRef.current) return
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        }
      })
      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }, [])

    // Initial scale and center
    useEffect(() => {
      if (containerSize.width > 0 && containerSize.height > 0 && !hasManuallyZoomed) {
        const scale = fitScale(containerSize.width, containerSize.height, mediaWidth, mediaHeight)
        setZoom(scale)
        setPan(
          centeredPan(containerSize.width, containerSize.height, mediaWidth, mediaHeight, scale),
        )
      }
    }, [containerSize, mediaWidth, mediaHeight, hasManuallyZoomed])

    // Current angle
    const currentDegree = secondToDegree(currentTime)

    // Seek helper
    const seekToFrame = useCallback(
      (frameIndex: number) => {
        const normalizedFrame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES
        const targetSec = normalizedFrame * FRAME_DURATION
        if (videoRef.current) {
          videoRef.current.currentTime = targetSec
        }
        setCurrentTime(targetSec)
        onTimeUpdate?.(targetSec)
      },
      [onTimeUpdate],
    )

    const seekToDegree = useCallback(
      (degree: number) => {
        const frame = Math.round((((degree % 360) + 360) % 360) / 15) % TOTAL_FRAMES
        seekToFrame(frame)
      },
      [seekToFrame],
    )

    // Play / Pause toggle
    const togglePlay = useCallback(() => {
      const video = videoRef.current
      if (!video) return
      if (video.paused || video.ended) {
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    }, [])

    // Video Imperative Controller
    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          videoRef.current?.play().catch(() => {})
        },
        pause: () => {
          videoRef.current?.pause()
        },
        seekTo: (second: number) => {
          seekToFrame(Math.floor(second * FPS))
        },
        getCurrentTime: () => videoRef.current?.currentTime || 0,
        getDuration: () => 4,
      }),
      [seekToFrame],
    )

    // Keyboard Hotkeys
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const active = document.activeElement
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            (active instanceof HTMLElement && active.isContentEditable))
        ) {
          return
        }

        if (e.key === ' ') {
          e.preventDefault()
          togglePlay()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const currentFrame = Math.round(currentTime * FPS)
          seekToFrame(currentFrame - 1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          const currentFrame = Math.round(currentTime * FPS)
          seekToFrame(currentFrame + 1)
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentTime, seekToFrame, togglePlay])

    // Pointer events for Drag-to-Rotate
    const handleViewerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDrawingMode || e.button !== 0) return
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)
      videoRef.current?.pause()

      const currentFrame = Math.floor(currentTime * FPS)
      dragStartRef.current = {
        clientX: e.clientX,
        frame: currentFrame,
      }
      setIsDraggingRotation(true)
    }

    const handleViewerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRotation) return
      const deltaX = e.clientX - dragStartRef.current.clientX
      // 12px drag movement corresponds to 1 frame (15°)
      // Dragging right (deltaX > 0) rotates turntable counterclockwise (decreasing frame index)
      const deltaFrames = Math.round(deltaX / 12)
      seekToFrame(dragStartRef.current.frame - deltaFrames)
    }

    const handleViewerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRotation) return
      setIsDraggingRotation(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // pointer may already be released
      }
    }

    // Fullscreen toggle
    const toggleFullScreen = () => {
      if (!rootRef.current) return
      if (!document.fullscreenElement) {
        rootRef.current.requestFullscreen().catch(() => {})
      } else {
        document.exitFullscreen().catch(() => {})
      }
    }

    useEffect(() => {
      const onFsChange = () => {
        setIsFullScreen(Boolean(document.fullscreenElement))
      }
      document.addEventListener('fullscreenchange', onFsChange)
      return () => document.removeEventListener('fullscreenchange', onFsChange)
    }, [])

    const handleZoomChange = (newZoom: number) => {
      setHasManuallyZoomed(true)
      const next = zoomAtPoint(
        zoom,
        pan,
        newZoom / zoom,
        containerSize.width / 2,
        containerSize.height / 2,
      )
      setZoom(next.zoom)
      setPan(next.pan)
    }

    const handleZoomReset = () => {
      setHasManuallyZoomed(false)
      if (containerSize.width > 0 && containerSize.height > 0) {
        const scale = fitScale(containerSize.width, containerSize.height, mediaWidth, mediaHeight)
        setZoom(scale)
        setPan(
          centeredPan(containerSize.width, containerSize.height, mediaWidth, mediaHeight, scale),
        )
      }
    }

    return (
      <div
        ref={rootRef}
        data-testid="model-viewer-container"
        className={cn(
          'group shadow-2xl font-sans select-none flex flex-col mx-auto relative',
          isFullScreen ? 'h-full w-full rounded-none bg-black' : 'w-full h-full',
        )}
      >
        <div className="flex-1 flex flex-col-reverse md:flex-row min-h-0 relative">
          {/* Render Carousel/Sidebar here if not fullscreen */}
          {!isFullScreen && children}

          {/* Interactive Drag Rotation Surface & Model Area */}
          <div
            ref={containerRef}
            data-testid="model-viewer-surface"
            onPointerDown={handleViewerPointerDown}
            onPointerMove={handleViewerPointerMove}
            onPointerUp={handleViewerPointerUp}
            onPointerCancel={handleViewerPointerUp}
            className={cn(
              'flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-0 touch-none',
              isDrawingMode
                ? 'cursor-crosshair'
                : isDraggingRotation
                  ? 'cursor-grabbing'
                  : 'cursor-grab',
            )}
          >
            {/* Centered Scaled Media Wrapper */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: 0,
                top: 0,
                width: mediaWidth,
                height: mediaHeight,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {videoSrc && (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  playsInline
                  loop
                  muted
                  autoPlay={autoPlay}
                  preload="auto"
                  onLoadedData={() => {
                    setIsLoading(false)
                    if (startTime && startTime > 0) {
                      seekToFrame(Math.floor(startTime * FPS))
                    }
                  }}
                  onPlay={() => {
                    setIsPlaying(true)
                    onPlay?.()
                  }}
                  onPause={() => {
                    setIsPlaying(false)
                    onPause?.()
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current && !isDraggingRotation) {
                      setCurrentTime(videoRef.current.currentTime)
                      onTimeUpdate?.(videoRef.current.currentTime)
                    }
                  }}
                  onError={() => {
                    setIsLoading(false)
                    setError('Failed to load turntable video')
                  }}
                  className="w-full h-full block object-contain pointer-events-none"
                />
              )}
            </div>

            {/* Drawing Canvas Overlay */}
            {containerSize.width > 0 && containerSize.height > 0 && (
              <DrawingCanvas
                width={containerSize.width}
                height={containerSize.height}
                mediaDimensions={{
                  width: mediaWidth,
                  height: mediaHeight,
                }}
                annotations={displayAnnotations}
                scale={zoom}
                offset={pan}
                className="absolute inset-0 pointer-events-none"
                isDrawing={isDrawing}
                currentTool={currentTool}
                currentColor={currentColor}
                onAddAnnotation={addAnnotation}
              />
            )}

            {/* Loading Spinner */}
            {isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
                <div className="w-14 h-14 bg-background/80 backdrop-blur-md rounded-full flex items-center justify-center border border-border shadow-lg">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive z-10 bg-background/90 p-4 text-center">
                <AlertCircle className="w-10 h-10" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Full-width docked bottom control bar */}
        <ModelControlBar
          isPlaying={isPlaying}
          currentDegree={currentDegree}
          zoom={zoom}
          isFullScreen={isFullScreen}
          allowDownload={allowDownload}
          downloadUrl={downloadUrl}
          fileName={data.name}
          togglePlay={togglePlay}
          onSeekDegree={seekToDegree}
          onZoomChange={handleZoomChange}
          onZoomReset={handleZoomReset}
          toggleFullScreen={toggleFullScreen}
        />
      </div>
    )
  },
)

ModelViewer.displayName = 'ModelViewer'
export default ModelViewer
