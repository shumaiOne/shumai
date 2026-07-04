import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useScreenSize } from '@/ui/hooks/useScreenSize'
import { getBestTranscode } from '@/ui/lib/media'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import type { Annotation } from '@/ui/types'
import type { AssetInfo } from '@shumai/dtos'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ComparePaneHandle, PaneReportedState } from './types'

interface CompareImagePaneProps {
  file: AssetInfo
  shareId?: string
  isActive: boolean
  annotations: Annotation[]
  onStateChange: (state: PaneReportedState) => void
  onUserPan?: (dx: number, dy: number) => void
  onActivate?: () => void
}

const MIN_ZOOM = 0.01
const MAX_ZOOM = 50

export const CompareImagePane = forwardRef<ComparePaneHandle, CompareImagePaneProps>(
  function CompareImagePane(
    { file, shareId, isActive, annotations, onStateChange, onUserPan, onActivate },
    ref,
  ) {
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

    const observerRef = useRef<ResizeObserver | null>(null)
    const zoomRef = useRef(zoom)
    zoomRef.current = zoom
    const panRef = useRef(pan)
    panRef.current = pan

    const containerRef = useCallback((node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (node !== null) {
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
        observerRef.current = observer
      }
    }, [])

    const imgW = file.media?.metadata?.originalWidth ?? 1920
    const imgH = file.media?.metadata?.originalHeight ?? 1080
    const conW = containerSize.width
    const conH = containerSize.height

    let baseScale = 1
    if (conW > 0 && conH > 0) {
      baseScale = Math.min(conW / imgW, conH / imgH)
    }

    // Fit on mount / container resize / file change
    useEffect(() => {
      if (conW > 0 && conH > 0) {
        setZoom(baseScale)
        setPan({
          x: (conW - imgW * baseScale) / 2,
          y: (conH - imgH * baseScale) / 2,
        })
      }
    }, [file.id, conW, conH, baseScale, imgW, imgH])

    const applyZoom = useCallback(
      (factor: number) => {
        const cx = conW / 2
        const cy = conH / 2
        const cur = zoomRef.current
        const newZoom = cur * factor
        if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return
        const curPan = panRef.current
        setPan({
          x: cx - (cx - curPan.x) * (newZoom / cur),
          y: cy - (cy - curPan.y) * (newZoom / cur),
        })
        setZoom(newZoom)
      },
      [conW, conH],
    )

    const fit = useCallback(() => {
      setZoom(baseScale)
      setPan({
        x: (conW - imgW * baseScale) / 2,
        y: (conH - imgH * baseScale) / 2,
      })
    }, [baseScale, conW, conH, imgW, imgH])

    let bestUrl = file.media?.original?.downloadUrl
    const bestTranscode = getBestTranscode(file.media?.imageTranscodes, screenWidth)
    if (bestTranscode?.url) {
      bestUrl = bestTranscode.url
    }

    const handleDownload = useCallback(async () => {
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
    }, [file.id, file.media?.original?.key, shareId])

    useImperativeHandle(
      ref,
      (): ComparePaneHandle => ({
        getKind: () => 'image',
        play: () => {},
        pause: () => {},
        togglePlay: () => {},
        seekToFrame: () => {},
        seekToSecond: () => {},
        stepFrame: () => {},
        setMuted: () => {},
        setVolume: () => {},
        setPlaybackRate: () => {},
        toggleLoop: () => {},
        changeResolution: () => {},
        zoomBy: (factor) => applyZoom(factor),
        fit,
        panBy: (dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy })),
        download: handleDownload,
      }),
      [applyZoom, fit, handleDownload],
    )

    // Report state upward
    useEffect(() => {
      onStateChange({ kind: 'image', zoom })
    }, [zoom, onStateChange])

    const displayAnnotations = [...annotations, ...(isActive ? draftAnnotations : [])]

    const handlePan = useCallback(
      (newOffset: { x: number; y: number }) => {
        const prev = panRef.current
        const dx = newOffset.x - prev.x
        const dy = newOffset.y - prev.y
        setPan(newOffset)
        if (dx !== 0 || dy !== 0) onUserPan?.(dx, dy)
      },
      [onUserPan],
    )

    if (!bestUrl) {
      return (
        <div className="flex flex-1 items-center justify-center bg-gray-100 dark:bg-gray-950">
          <p className="text-muted-foreground">Preview unavailable</p>
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950"
        onMouseDown={onActivate}
      >
        <DrawingCanvas
          width={conW}
          height={conH}
          mediaDimensions={{ width: imgW, height: imgH }}
          imageUrl={bestUrl}
          annotations={displayAnnotations}
          scale={zoom}
          offset={pan}
          onPan={handlePan}
          className="absolute inset-0 z-0"
          isDrawing={isActive && isDrawing}
          currentTool={currentTool}
          currentColor={currentColor}
          onAddAnnotation={isActive ? addAnnotation : undefined}
        />
      </div>
    )
  },
)
