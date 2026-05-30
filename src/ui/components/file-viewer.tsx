import type { AssetInfo } from '@/dtos/asset'
import { useScreenSize } from '@/ui/hooks/useScreenSize'
import { getBestTranscode } from '@/ui/lib/media'
import { Minus, Plus, Copy, Download, Check } from 'lucide-react'
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import type Player from 'video.js/dist/types/player'
import DrawingCanvas from './drawing-canvas'
import VideoPlayer from './viewers/video-player'

import type { Annotation } from '@/ui/types'
import { useAnnotationStore } from '@/ui/stores/annotation-store'

type FileViewerProps = {
  file: AssetInfo
  videoRef?: RefObject<Player | null>
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (time: number) => void
  annotations?: Annotation[]
}

export function FileViewer({
  file,
  videoRef,
  onPlay,
  onPause,
  onTimeUpdate,
  annotations,
}: FileViewerProps) {
  const { width: screenWidth } = useScreenSize()
  const isImage = file.mediaType?.startsWith('image/')
  const isVideo = file.mediaType?.startsWith('video/')

  // Annotation Store
  const {
    isDrawing,
    currentTool,
    currentColor,
    addAnnotation,
    annotations: draftAnnotations,
    reset: resetAnnotations,
  } = useAnnotationStore()

  // Reset annotations when file changes
  useEffect(() => {
    resetAnnotations()
  }, [file.id, resetAnnotations])

  // State for Image Viewer
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)

  const imgW = file.media?.metadata?.originalWidth ?? 1920
  const imgH = file.media?.metadata?.originalHeight ?? 1080
  const conW = containerSize.width
  const conH = containerSize.height

  let baseScale = 1

  if (conW > 0 && conH > 0) {
    baseScale = Math.min(conW / imgW, conH / imgH)
  }

  // Reset/Fit logic
  useEffect(() => {
    if (conW > 0 && conH > 0 && isImage) {
      setZoom(baseScale)
      // Center
      const x = (conW - imgW * baseScale) / 2
      const y = (conH - imgH * baseScale) / 2
      setPan({ x, y })
    }
  }, [file.id, conW, conH, isImage, baseScale, imgW, imgH])

  // Resize Observer
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

  const handleZoom = (factor: number) => {
    const cx = conW / 2
    const cy = conH / 2

    // Limit min/max zoom if needed?
    const newZoom = zoom * factor
    if (newZoom < 0.01 || newZoom > 50) return

    const newPanX = cx - (cx - pan.x) * (newZoom / zoom)
    const newPanY = cy - (cy - pan.y) * (newZoom / zoom)

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }

  const handleFit = () => {
    setZoom(baseScale)
    const x = (conW - imgW * baseScale) / 2
    const y = (conH - imgH * baseScale) / 2
    setPan({ x, y })
  }

  let bestUrl = file.media?.original?.downloadUrl

  if (isImage) {
    const bestTranscode = getBestTranscode(file.media?.imageTranscodes, screenWidth)
    if (bestTranscode?.url) {
      bestUrl = bestTranscode.url
    }
  }

  const handleDownload = () => {
    const url = file.media?.original?.downloadUrl
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = file.name || 'image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopy = async () => {
    const webpUrl = bestUrl
    if (!webpUrl) return
    try {
      const response = await fetch(webpUrl)
      const blob = await response.blob()

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = URL.createObjectURL(blob)
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')
      ctx.drawImage(img, 0, 0)

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) return
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': pngBlob,
            }),
          ])
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Failed to copy image to clipboard:', err)
        }
      }, 'image/png')
    } catch (err) {
      console.error('Failed to copy image:', err)
    }
  }

  if (!bestUrl) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Preview unavailable</p>
      </div>
    )
  }

  // Combine saved annotations and draft annotations
  const displayAnnotations = [...(annotations || []), ...draftAnnotations]

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-gray-100 dark:bg-gray-950 relative">
      {isImage && (
        <>
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
            <DrawingCanvas
              width={conW}
              height={conH}
              mediaDimensions={{
                width: imgW,
                height: imgH,
              }}
              imageUrl={bestUrl}
              annotations={displayAnnotations}
              scale={zoom}
              offset={pan}
              onPan={setPan}
              className="absolute inset-0 z-0"
              // Drawing Props
              isDrawing={isDrawing}
              currentTool={currentTool}
              currentColor={currentColor}
              onAddAnnotation={addAnnotation}
            />
          </div>
          {/* Zoom Toolbar */}
          <div className="relative px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10 flex items-center justify-end gap-2 transition-colors duration-200">
            <div className="flex items-center gap-1 bg-gray-200/50 dark:bg-white/10 rounded-md p-0.5 mr-auto">
              <button
                onClick={() => handleZoom(0.8)}
                className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                title="Zoom Out"
              >
                <Minus size={16} />
              </button>
              <span className="w-12 text-center text-xs font-mono font-medium text-gray-900 dark:text-gray-100 select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => handleZoom(1.2)}
                className="p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                title="Zoom In"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={handleFit}
              className="text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent animate-in fade-in zoom-in-95 duration-200"
            >
              Fit
            </button>
            <button
              onClick={handleCopy}
              disabled={!bestUrl}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
              title="Copy optimized image to clipboard"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              disabled={!file.media?.original?.downloadUrl}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors border border-transparent disabled:opacity-50 animate-in fade-in zoom-in-95 duration-200"
              title="Download original image"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </>
      )}
      {isVideo && (
        <VideoPlayer
          data={file}
          playerRef={videoRef}
          onPlay={onPlay}
          onPause={onPause}
          onTimeUpdate={onTimeUpdate}
          annotations={displayAnnotations}
        />
      )}
    </div>
  )
}
