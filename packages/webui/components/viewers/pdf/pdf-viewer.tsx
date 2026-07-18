import { client } from '@/ui/api/client'
import DrawingCanvas from '@/ui/components/drawing-canvas'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import * as pdfjsLib from 'pdfjs-dist'
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FileViewerProps, MediaController } from '../types'
import { PdfControlBar } from './pdf-control-bar'

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

export const PdfViewer = React.forwardRef<MediaController, FileViewerProps>(
  ({ file, annotations, shareId, children }, ref) => {
    useImperativeHandle(ref, () => ({
      play: () => {},
      pause: () => {},
      seekTo: () => {},
    }))

    const {
      isDrawing,
      currentTool,
      currentColor,
      addAnnotation,
      annotations: draftAnnotations,
    } = useAnnotationStore()

    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [pageImageUrl, setPageImageUrl] = useState<string>('')
    const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 1000 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

    const fileUrl = file.media?.original?.downloadUrl

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
          setCurrentPage(1)
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
      }
    }, [fileUrl])

    // Render active PDF page into image
    useEffect(() => {
      if (!pdfDoc) return

      let active = true
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

          page
            .render({ canvasContext: ctx, viewport, canvas })
            .promise.then(() => {
              if (!active) return
              setPageImageUrl(canvas.toDataURL('image/png'))
              setPageDimensions({
                width: unscaledViewport.width,
                height: unscaledViewport.height,
              })
            })
            .catch((err) => {
              console.error('Failed to render page:', err)
            })
        })
        .catch((err) => {
          console.error('Failed to get page:', err)
        })

      return () => {
        active = false
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
          onPageChange={setCurrentPage}
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
