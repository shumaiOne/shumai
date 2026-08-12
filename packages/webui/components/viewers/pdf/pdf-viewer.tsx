import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import * as pdfjsLib from 'pdfjs-dist'
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FileViewerProps, MediaController } from '../types'
import { PdfControlBar } from './pdf-control-bar'
import { centeredPan, fitScale, zoomAtPoint } from '../pan-zoom'
import { usePanZoomGestures } from '../use-pan-zoom'

import pdfworker from '@/ui/public/pdf.worker.min.mjs' with { type: 'file' }
import './text-layer.css'

/**
 * Cap on the page render canvas area (in device pixels) to bound memory usage
 * when re-rasterizing at high zoom levels.
 */
const MAX_RENDER_PIXELS = 32_000_000
/** Hard cap on the page render scale (device pixels per CSS pixel at zoom 1). */
const MAX_RENDER_SCALE = 16

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  const workerPath =
    typeof pdfworker === 'string'
      ? pdfworker.startsWith('/')
        ? pdfworker
        : '/' + pdfworker.replace(/^\.\//, '')
      : pdfworker
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath
}

export const PdfViewer = React.forwardRef<MediaController, FileViewerProps>(
  (
    {
      file,
      annotations,
      shareId,
      children,
      onPlay,
      onPause,
      onTimeUpdate,
      startTime,
      allowDownload,
    },
    ref,
  ) => {
    const {
      isDrawing,
      currentTool,
      currentColor,
      addAnnotation,
      annotations: draftAnnotations,
    } = useAnnotationStore()

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
    const [currentPage, setCurrentPage] = useState<number>(() =>
      startTime && !isNaN(startTime) ? Math.max(1, Math.round(startTime)) : 1,
    )
    const [totalPages, setTotalPages] = useState(1)
    const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null)
    const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 1000 })
    /** Scale at which the active page is rasterized; tracks the current zoom. */
    const [renderScale, setRenderScale] = useState(2)
    const textLayerContainerRef = useRef<HTMLDivElement | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          onPlay?.()
        },
        pause: () => {
          onPause?.()
        },
        seekTo: (second: number) => {
          if (second && !isNaN(second)) {
            const targetPage = Math.max(1, Math.min(totalPages, Math.round(second)))
            setCurrentPage(targetPage)
          }
        },
      }),
      [totalPages, onPlay, onPause],
    )

    useEffect(() => {
      onTimeUpdate?.(currentPage)
    }, [currentPage, onTimeUpdate])

    // Keyboard navigation shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeEl = document.activeElement
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            (activeEl instanceof HTMLElement && activeEl.isContentEditable))
        ) {
          return
        }

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault()
          setCurrentPage((prev) => {
            const next = Math.min(totalPages, prev + 1)
            if (next !== prev) onPlay?.()
            return next
          })
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault()
          setCurrentPage((prev) => {
            const next = Math.max(1, prev - 1)
            if (next !== prev) onPlay?.()
            return next
          })
        } else if (e.key === 'Home') {
          e.preventDefault()
          setCurrentPage(1)
          onPlay?.()
        } else if (e.key === 'End') {
          e.preventDefault()
          setCurrentPage(totalPages)
          onPlay?.()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [totalPages, onPlay])

    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [hasManuallyZoomed, setHasManuallyZoomed] = useState(false)

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

    const fileUrl = file.media?.pdfTranscode?.url

    // Load PDF Document
    useEffect(() => {
      if (!fileUrl) {
        setError('No PDF URL available')
        setLoading(false)
        return
      }

      let active = true
      setLoading(true)
      setError(null)

      const loadingTask = pdfjsLib.getDocument({ url: fileUrl })
      loadingTask.promise
        .then((doc) => {
          if (!active) return
          setPdfDoc(doc)
          setTotalPages(doc.numPages)
          setCurrentPage((prevPage) =>
            startTime && !isNaN(startTime)
              ? Math.max(1, Math.min(doc.numPages, Math.round(startTime)))
              : prevPage,
          )
          setLoading(false)
        })
        .catch((err) => {
          if (!active) return
          console.error('Failed to load PDF:', err)
          setError('Failed to load PDF document')
          setLoading(false)
        })

      return () => {
        active = false
        loadingTask.destroy().catch(() => {})
      }
    }, [fileUrl, startTime])

    // Render the active PDF page directly onto a canvas (vector output, not a
    // frozen PNG). The scale tracks the current zoom so text stays crisp when
    // zoomed in; re-rendering is debounced via `renderScale`.
    useEffect(() => {
      if (!pdfDoc) return

      let active = true
      let renderTask: pdfjsLib.RenderTask | null = null

      pdfDoc
        .getPage(currentPage)
        .then((page) => {
          if (!active) return
          const unscaledViewport = page.getViewport({ scale: 1.0 })
          const viewport = page.getViewport({ scale: renderScale })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')

          if (!ctx) return

          renderTask = page.render({ canvasContext: ctx, viewport, canvas })
          if (!active) {
            renderTask.cancel()
            return
          }

          renderTask.promise
            .then(() => {
              if (!active) return
              // Swap in the freshly rendered canvas only once complete, so the
              // previous frame stays visible while re-rasterizing.
              setPageCanvas(canvas)
              setPageDimensions({
                width: unscaledViewport.width,
                height: unscaledViewport.height,
              })
            })
            .catch((err) => {
              if (
                !active ||
                (err &&
                  typeof err === 'object' &&
                  'name' in err &&
                  err.name === 'RenderingCancelledException')
              ) {
                return
              }
              console.error('Failed to render page:', err)
            })
        })
        .catch((err) => {
          if (!active) return
          console.error('Failed to get page:', err)
        })

      return () => {
        active = false
        if (renderTask) {
          renderTask.cancel()
        }
      }
    }, [pdfDoc, currentPage, renderScale])

    // Debounce zoom changes: once the user stops zooming, re-rasterize the
    // vector page at a scale that yields 1:1 device pixels for the current
    // zoom (capped to keep canvas memory bounded).
    useEffect(() => {
      const id = window.setTimeout(() => {
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
        const pageArea = pageDimensions.width * pageDimensions.height
        const maxByArea = pageArea > 0 ? Math.sqrt(MAX_RENDER_PIXELS / pageArea) : MAX_RENDER_SCALE
        const next = Math.min(Math.max(0.5, zoom * dpr), maxByArea, MAX_RENDER_SCALE)
        setRenderScale(next)
      }, 150)
      return () => window.clearTimeout(id)
    }, [zoom, pageDimensions])

    // Build the pdf.js TextLayer overlay for the current page: invisible,
    // natively selectable text spans positioned exactly over the page canvas.
    // The overlay sits on top of the Konva stage so the selection highlight
    // is visible; pointer events are gated on `isDrawing` (see the JSX), so
    // left-drag selects text when not in draw mode and draws when in draw mode.
    useEffect(() => {
      const container = textLayerContainerRef.current
      if (!pdfDoc || !container) return

      let active = true
      let textLayer: InstanceType<typeof pdfjsLib.TextLayer> | null = null

      // Drop the previous page's text runs.
      container.innerHTML = ''

      pdfDoc
        .getPage(currentPage)
        .then((page) => {
          if (!active) return
          textLayer = new pdfjsLib.TextLayer({
            textContentSource: page.streamTextContent(),
            container,
            viewport: page.getViewport({ scale: 1.0 }),
          })
          // Cancellation rejects the render promise; ignore it here.
          textLayer.render().catch(() => {})
        })
        .catch((err) => {
          if (!active) return
          console.error('Failed to build text layer:', err)
        })

      return () => {
        active = false
        textLayer?.cancel()
      }
    }, [pdfDoc, currentPage])

    // Keep the text layer's DOM transform in lockstep with the Konva stage so
    // the invisible text spans stay exactly over the rendered page.
    useEffect(() => {
      const el = textLayerContainerRef.current
      if (!el) return
      el.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
    }, [pan, zoom])

    const conW = containerSize.width
    const conH = containerSize.height
    const pdfW = pageDimensions.width
    const pdfH = pageDimensions.height

    const baseScale = fitScale(conW, conH, pdfW, pdfH)

    // Auto-fit when the container or page changes, unless the user has
    // manually zoomed (their view is preserved across resizes / page flips).
    useEffect(() => {
      if (conW <= 0 || conH <= 0 || pdfW <= 0 || pdfH <= 0) return
      if (hasManuallyZoomed) return
      setZoom(baseScale)
      setPan(centeredPan(conW, conH, pdfW, pdfH, baseScale))
    }, [conW, conH, baseScale, pdfW, pdfH, hasManuallyZoomed])

    const handleZoom = (factor: number) => {
      setHasManuallyZoomed(true)
      const next = zoomAtPoint(zoom, pan, factor, conW / 2, conH / 2)
      setZoom(next.zoom)
      setPan(next.pan)
    }

    const handleFit = () => {
      setHasManuallyZoomed(false)
      setZoom(baseScale)
      setPan(centeredPan(conW, conH, pdfW, pdfH, baseScale))
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
        link.download = file.name || 'document.pdf'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch {
        // fail silently
      }
    }

    const displayAnnotations = [...(annotations || []), ...draftAnnotations]

    return (
      <div className="flex flex-col flex-1 h-full overflow-hidden bg-gray-100 dark:bg-gray-950 relative">
        <div className="flex-1 flex flex-col-reverse md:flex-row min-h-0 relative">
          {children}
          <div ref={containerRef} className="flex-1 relative overflow-hidden touch-none">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                {error}
              </div>
            ) : (
              <DrawingCanvas
                width={conW}
                height={conH}
                mediaDimensions={pageDimensions}
                canvasElement={pageCanvas}
                annotations={displayAnnotations}
                scale={zoom}
                offset={pan}
                className="absolute inset-0 z-0"
                isDrawing={isDrawing}
                currentTool={currentTool}
                currentColor={currentColor}
                onAddAnnotation={addAnnotation}
              />
            )}
            {/* Invisible selectable text overlay, transformed to match the Konva
                stage. It sits ON TOP of the page canvas so the native selection
                highlight is visible; pointer events are enabled only when not
                drawing, so drags reach the stage below in draw mode. */}
            <div
              ref={textLayerContainerRef}
              className="pdf-text-layer"
              onMouseDown={(e) => {
                // The container is user-select:none, so Chromium no longer
                // clears the selection when clicking empty space (only text
                // spans move the caret). Restore the expected behavior: a
                // press on the container/br (not a text span) deselects.
                if (e.target instanceof HTMLElement && e.target.tagName !== 'SPAN') {
                  window.getSelection()?.removeAllRanges()
                }
              }}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                pointerEvents: isDrawing ? 'none' : 'auto',
              }}
            />
          </div>
        </div>
        <PdfControlBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            setCurrentPage(page)
            onPlay?.()
          }}
          zoom={zoom}
          onZoomIn={() => handleZoom(1.2)}
          onZoomOut={() => handleZoom(0.8)}
          onFit={handleFit}
          onDownload={handleDownload}
          canDownload={!!file.media?.original?.key}
          allowDownload={allowDownload}
        />
      </div>
    )
  },
)

export default PdfViewer
