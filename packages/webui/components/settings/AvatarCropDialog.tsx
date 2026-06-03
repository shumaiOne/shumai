import React, { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Move, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'

interface AvatarCropDialogProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string | null
  onConfirm: (croppedBlob: Blob) => Promise<void>
}

export function AvatarCropDialog({ isOpen, onClose, imageSrc, onConfirm }: AvatarCropDialogProps) {
  const [zoom, setZoom] = useState(1.0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Layout parameters
  const VIEWPORT_SIZE = 250 // Diameter of the circle crop in pixels

  // Reset parameters when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setZoom(1.0)
      setOffset({ x: 0, y: 0 })
      setIsSaving(false)
    }
  }, [isOpen, imageSrc])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch support for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    setIsDragging(true)
    const touch = e.touches[0]
    dragStart.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setOffset({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y,
    })
  }

  const handleConfirm = async () => {
    const img = imageRef.current
    const container = containerRef.current
    if (!img || !container) return

    setIsSaving(true)

    try {
      // Natural dimensions of the image vs rendered dimensions
      const rect = img.getBoundingClientRect()

      // Canvas dimensions (high quality cropped resolution)
      const CROP_RESOLUTION = 512
      const canvas = document.createElement('canvas')
      canvas.width = CROP_RESOLUTION
      canvas.height = CROP_RESOLUTION
      const ctx = canvas.getContext('2d')

      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, CROP_RESOLUTION, CROP_RESOLUTION)

        // Draw square crop (no circular clipping path to allow square renders)

        // Calculate translation and scaling factors
        // Rendered image center in container coordinates:
        // center_x = container_width / 2 + offset.x
        // center_y = container_height / 2 + offset.y
        // Image rendered width = rect.width, height = rect.height

        // We map these container coordinate space values to the canvas coordinate space:
        // Scale factor between canvas and UI container viewport (e.g. 512 / 250)
        const scaleToCanvas = CROP_RESOLUTION / VIEWPORT_SIZE

        // Rendered width/height at zoom 1.0 (before scaling)
        const baseWidth = rect.width / zoom
        const baseHeight = rect.height / zoom

        // Calculate centered offset in canvas coordinates
        const canvasX = CROP_RESOLUTION / 2 + offset.x * scaleToCanvas
        const canvasY = CROP_RESOLUTION / 2 + offset.y * scaleToCanvas

        // Draw the image scaled and panned
        ctx.translate(canvasX, canvasY)
        ctx.scale(zoom * scaleToCanvas, zoom * scaleToCanvas)
        ctx.drawImage(img, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)

        // Export canvas as blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
        })

        if (blob) {
          await onConfirm(blob)
        }
      }
    } catch (err) {
      console.error('Failed to crop image', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 border-b border-border/40 bg-gradient-to-br from-primary/5 to-transparent">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Move className="w-5 h-5 text-primary" />
            Position and resize
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 flex flex-col items-center gap-6">
          {/* Viewport Container */}
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-muted select-none border border-border/40 rounded-xl cursor-move shadow-inner"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Avatar Source"
                className="absolute origin-center max-w-none pointer-events-none transition-transform duration-75 select-none"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  maxHeight: '100%',
                }}
              />
            )}

            {/* Circular Mask Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[3px] border-primary/90 rounded-full" />
            <div
              className="absolute inset-0 pointer-events-none bg-black/40"
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
                maskImage: 'radial-gradient(circle, transparent 122px, black 123px)',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                WebkitMaskImage: 'radial-gradient(circle, transparent 122px, black 123px)',
              }}
            />
          </div>

          {/* Zoom Slider */}
          <div className="w-full flex items-center gap-3 px-2">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter className="p-6 border-t border-border/40 bg-muted/20 flex flex-row justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving || !imageSrc} className="min-w-[80px]">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
