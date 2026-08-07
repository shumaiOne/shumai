import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import * as pdfjsLib from 'pdfjs-dist'
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FileViewerProps, MediaController } from '../types'
import { PdfControlBar } from './pdf-control-bar'

import pdfworker from '@/ui/public/pdf.worker.min.mjs' with { type: 'file' }

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
  ({ file, annotations, shareId, children, onPlay, onPause, onTimeUpdate, startTime }, ref) => {
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
    const [pageImageUrl, setPageImageUrl] = useState<string>('')
    const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 1000 })
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

    const observerRef = useRef<ResizeObserver | null>(null)

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

    // Render active PDF page into image
    useEffect(() => {
      if (!pdfDoc) return

      let active = true
      let renderTask: pdfjsLib.RenderTask | null = null

      pdfDoc
        .getPage(currentPage)
        .then((page) => {
          if (!active) return
          const unscaledViewport = page.getViewport({ scale: 1.0 })
          const renderScale = 2.0
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
              setPageImageUrl(canvas.toDataURL('image/png'))
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
    }, [pdfDoc, currentPage])

    const conW = containerSize.width
    const conH = containerSize.height
    const pdfW = pageDimensions.width
    const pdfH = pageDimensions.height

    let baseScale = 1
    if (conW > 0 && conH > 0 && pdfW > 0 && pdfH > 0) {
      baseScale = Math.min(conW / pdfW, conH / pdfH)
    }

    useEffect(() => {
      if (conW > 0 && conH > 0 && pdfW > 0 && pdfH > 0) {
        setZoom(baseScale)
        const x = (conW - pdfW * baseScale) / 2
        const y = (conH - pdfH * baseScale) / 2
        setPan({ x, y })
      }
    }, [file.id, currentPage, conW, conH, baseScale, pdfW, pdfH])

    const handleZoom = (factor: number) => {
      const cx = conW / 2
      const cy = conH / 2

      const newZoom = zoom * factor
      if (newZoom < 0.01 || newZoom > 50) return

      const newPanX = cx - (cx - pan.x) * (newZoom / zoom)
      const newPanY = cy - (cy - pan.y) * (newZoom / zoom)

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    const handleFit = () => {
      setZoom(baseScale)
      const x = (conW - pdfW * baseScale) / 2
      const y = (conH - pdfH * baseScale) / 2
      setPan({ x, y })
    }

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
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
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
                imageUrl={pageImageUrl}
                annotations={displayAnnotations}
                scale={zoom}
                offset={pan}
                onPan={setPan}
                className="absolute inset-0 z-0"
                isDrawing={isDrawing}
                currentTool={currentTool}
                currentColor={currentColor}
                onAddAnnotation={addAnnotation}
              />
            )}
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
        />
      </div>
    )
  },
)

export default PdfViewer
