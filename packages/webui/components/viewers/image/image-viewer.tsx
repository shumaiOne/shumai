import { useScreenSize } from '@/ui/hooks/useScreenSize'
import { client } from '@/ui/api/client'
import { getBestTranscode } from '@/ui/lib/media'
import React, { useEffect, useRef, useState, useImperativeHandle } from 'react'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { ImageControlBar } from './image-control-bar'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import { FileViewerProps, MediaController } from '../types'
import { centeredPan, fitScale, isZoomed, zoomAtPoint } from '../pan-zoom'
import { usePanZoomGestures } from '../use-pan-zoom'

export const ImageViewer = React.forwardRef<MediaController, FileViewerProps>(
  ({ file, annotations, shareId, allowDownload }, ref) => {
    // Implement no-op media controller since images are static
    useImperativeHandle(ref, () => ({
      play: () => {},
      pause: () => {},
      seekTo: () => {},
    }))

    const { width: screenWidth } = useScreenSize()
    const {
      isDrawing,
      currentTool,
      currentColor,
      addAnnotation,
      annotations: draftAnnotations,
    } = useAnnotationStore()

    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false)
    const [copied, setCopied] = useState(false)

    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      const node = containerRef.current
      if (!node) return
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        }
      })
      observer.observe(node)
      return () => observer.disconnect()
    }, [])

    const imgW = file.media?.metadata?.originalWidth ?? 1920
    const imgH = file.media?.metadata?.originalHeight ?? 1080
    const conW = containerSize.width
    const conH = containerSize.height

    const baseScale = fitScale(conW, conH, imgW, imgH)

    // Auto-fit when the container size changes, unless the user has manually
    // zoomed (their view is preserved across resizes, e.g. sidebar toggles).
    useEffect(() => {
      if (conW <= 0 || conH <= 0) return
      if (hasManuallyZoomed) return
      setZoom(baseScale)
      setPan(centeredPan(conW, conH, imgW, imgH, baseScale))
    }, [conW, conH, baseScale, imgW, imgH, hasManuallyZoomed])

    const handleZoom = (factor: number) => {
      setHasManuallyZoomed(true)
      const next = zoomAtPoint(zoom, pan, factor, conW / 2, conH / 2)
      setZoom(next.zoom)
      setPan(next.pan)
    }

    const handleFit = () => {
      setHasManuallyZoomed(false)
      setZoom(baseScale)
      setPan(centeredPan(conW, conH, imgW, imgH, baseScale))
    }

    usePanZoomGestures({
      containerRef,
      zoom,
      pan,
      baseScale,
      onZoomChange: (next) => {
        setHasManuallyZoomed(true)
        setZoom(next.zoom)
        setPan(next.pan)
      },
      onPanChange: setPan,
    })

    const bestUrl = getBestTranscode(file.media?.imageTranscodes, screenWidth)?.url ?? ''

    const handleDownload = async () => {
      const key = file.media?.original?.key
      if (!key || !file.id) return
      try {
        const res = shareId
          ? await client.api.shares[':shareId'].files[':fileId']['download-url'].$post({
              param: { shareId, fileId: file.id },
              json: { key },
            })
          : await client.api.files['download-url'].$post({
              json: { key, assetId: file.id },
            })
        if (!res.ok) return
        const { url } = await res.json()
        const link = document.createElement('a')
        link.href = url
        link.download = ''
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch {
        // silently fail
      }
    }

    const handleCopy = async () => {
      const webpUrl = bestUrl
      if (!webpUrl) return
      try {
        const copyPromise = (async () => {
          const response = await fetch(webpUrl)
          const blob = await response.blob()

          const img = new Image()
          img.crossOrigin = 'anonymous'
          const objectUrl = URL.createObjectURL(blob)
          img.src = objectUrl

          try {
            await new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = (e) => reject(new Error('Failed to load image: ' + String(e)))
            })

            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Could not get canvas context')
            ctx.drawImage(img, 0, 0)

            const pngBlob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, 'image/png')
            })

            if (!pngBlob) throw new Error('Failed to convert image to PNG')
            return pngBlob
          } finally {
            URL.revokeObjectURL(objectUrl)
          }
        })()

        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': copyPromise,
          }),
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy image to clipboard:', err)
      }
    }

    const displayAnnotations = [...(annotations || []), ...draftAnnotations]

    return (
      <div className="flex flex-col flex-1 h-full overflow-hidden bg-gray-100 dark:bg-gray-950 relative">
        <div ref={containerRef} className="flex-1 relative overflow-hidden touch-none">
          {bestUrl ? (
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
              onPan={isZoomed(zoom, baseScale) ? setPan : undefined}
              className="absolute inset-0 z-0"
              isDrawing={isDrawing}
              currentTool={currentTool}
              currentColor={currentColor}
              onAddAnnotation={addAnnotation}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-muted-foreground">Preview unavailable</p>
            </div>
          )}
        </div>
        <ImageControlBar
          zoom={zoom}
          onZoomIn={() => handleZoom(1.2)}
          onZoomOut={() => handleZoom(0.8)}
          onFit={handleFit}
          onDownload={handleDownload}
          canDownload={!!file.media?.original?.key}
          onCopy={handleCopy}
          copied={copied}
          canCopy={!!bestUrl}
          allowDownload={allowDownload}
        />
      </div>
    )
  },
)

export default ImageViewer
