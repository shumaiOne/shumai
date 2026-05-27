import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type {
  Annotation,
  BoxAnnotation,
  LineAnnotation,
  ArrowAnnotation,
  FreehandAnnotation,
} from '@/ui/types'
import { useEffect, useRef } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Arrow, Line, Group } from 'react-konva'
import useImage from 'use-image'
import type { DrawingTool } from '@/ui/stores/annotation-store'

interface DrawingCanvasProps {
  width: number
  height: number
  mediaDimensions: { width: number; height: number }
  imageUrl?: string
  videoElement?: HTMLVideoElement
  annotations: Annotation[]
  scale: number
  offset: { x: number; y: number }
  onPan?: (newOffset: { x: number; y: number }) => void
  onClick?: () => void
  className?: string

  // Drawing Props
  isDrawing?: boolean
  currentTool?: DrawingTool
  currentColor?: string
  onAddAnnotation?: (annotation: Annotation) => void
}

const DrawingCanvas = ({
  width,
  height,
  mediaDimensions,
  imageUrl,
  videoElement,
  annotations,
  scale,
  offset,
  onPan,
  onClick,
  className,
  isDrawing = false,
  currentTool = 'arrow',
  currentColor = '#ef4444',
  onAddAnnotation,
}: DrawingCanvasProps) => {
  const [loadedImage] = useImage(imageUrl || '', 'anonymous')
  const imageRef = useRef<Konva.Image>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const startPointRef = useRef<{ x: number; y: number } | null>(null)

  // Draft shapes for drawing
  const currentLineRef = useRef<Konva.Line>(null)
  const currentRectRef = useRef<Konva.Rect>(null)
  const currentArrowRef = useRef<Konva.Arrow>(null)

  // Handle Video Redraw
  useEffect(() => {
    if (videoElement && imageRef.current) {
      const layer = imageRef.current.getLayer()
      if (!layer) return

      const anim = new Konva.Animation(() => {
        // Force redraw to update video frame
      }, layer)
      anim.start()
      return () => {
        anim.stop()
      }
    }
  }, [videoElement])

  // -- Helpers --
  const getRelativePointerPosition = (
    node: Konva.Node,
    clamp = false,
    customPos?: { x: number; y: number },
  ) => {
    // the function will return pointer position relative to the passed node
    const transform = node.getAbsoluteTransform().copy()
    // to detect relative position we need to invert transform
    transform.invert()

    // get pointer (say mouse or touch) position
    const pos = customPos || node.getStage()?.getPointerPosition()
    if (pos) {
      const point = transform.point(pos)
      if (clamp) {
        return {
          x: Math.max(0, Math.min(mediaDimensions.width, point.x)),
          y: Math.max(0, Math.min(mediaDimensions.height, point.y)),
        }
      }
      return point
    }
    return null
  }

  // Ref to hold current props for global listeners to avoid stale closures
  const stateRef = useRef({
    isDrawing,
    currentTool,
    currentColor,
    onPan,
    offset,
    scale,
    mediaDimensions,
    onAddAnnotation,
  })
  stateRef.current = {
    isDrawing,
    currentTool,
    currentColor,
    onPan,
    offset,
    scale,
    mediaDimensions,
    onAddAnnotation,
  }

  const finalizeDrawing = () => {
    if (!isDragging.current) return
    isDragging.current = false

    const {
      isDrawing: activeDrawing,
      onAddAnnotation: addAnn,
      mediaDimensions: dims,
      currentTool: tool,
      currentColor: color,
    } = stateRef.current

    if (activeDrawing && addAnn) {
      const w = dims.width
      const h = dims.height

      // Helper to normalize
      const norm = (val: number, dim: number) => val / dim

      // Capture shape
      if (tool === 'freehand' && currentLineRef.current) {
        currentLineRef.current.visible(false)
        const rawPoints = currentLineRef.current.points()
        const points: [number, number][] = []
        for (let i = 0; i < rawPoints.length; i += 2) {
          points.push([norm(rawPoints[i], w), norm(rawPoints[i + 1], h)])
        }
        if (points.length > 1) {
          const ann: FreehandAnnotation = {
            type: 'freehand',
            color,
            points,
          }
          addAnn(ann)
        }
      } else if (tool === 'line' && currentLineRef.current) {
        currentLineRef.current.visible(false)
        const pts = currentLineRef.current.points()
        const ann: LineAnnotation = {
          type: 'line',
          color,
          points: [
            [norm(pts[0], w), norm(pts[1], h)],
            [norm(pts[2], w), norm(pts[3], h)],
          ],
        }
        addAnn(ann)
      } else if (tool === 'box' && currentRectRef.current) {
        currentRectRef.current.visible(false)
        const x = currentRectRef.current.x()
        const y = currentRectRef.current.y()
        const boxW = currentRectRef.current.width()
        const boxH = currentRectRef.current.height()
        // Convert to start/end points
        const start: [number, number] = [norm(x, w), norm(y, h)]
        const end: [number, number] = [norm(x + boxW, w), norm(y + boxH, h)]
        const ann: BoxAnnotation = {
          type: 'box',
          color,
          points: [start, end],
        }
        addAnn(ann)
      } else if (tool === 'arrow' && currentArrowRef.current) {
        currentArrowRef.current.visible(false)
        const pts = currentArrowRef.current.points()
        const ann: ArrowAnnotation = {
          type: 'arrow',
          color,
          points: [
            [norm(pts[0], w), norm(pts[1], h)],
            [norm(pts[2], w), norm(pts[3], h)],
          ],
        }
        addAnn(ann)
      }
    }
  }

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return

      const stage = imageRef.current?.getStage()
      if (!stage) return
      const container = stage.container()
      const rect = container.getBoundingClientRect()

      let clientX, clientY
      if ('clientX' in e) {
        clientX = e.clientX
        clientY = e.clientY
      } else {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      }

      const stagePos = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }

      const {
        isDrawing: activeDrawing,
        currentTool: tool,
        onPan: panFn,
        offset: currentOffset,
      } = stateRef.current

      if (activeDrawing) {
        if (tool === 'select') return

        const pos = getRelativePointerPosition(imageRef.current!, true, stagePos)
        if (!pos || !startPointRef.current) return
        const start = startPointRef.current

        const layer = imageRef.current?.getLayer()

        if (tool === 'freehand' && currentLineRef.current) {
          const newPoints = currentLineRef.current.points().concat([pos.x, pos.y])
          currentLineRef.current.points(newPoints)
        } else if (tool === 'line' && currentLineRef.current) {
          currentLineRef.current.points([start.x, start.y, pos.x, pos.y])
        } else if (tool === 'box' && currentRectRef.current) {
          currentRectRef.current.width(pos.x - start.x)
          currentRectRef.current.height(pos.y - start.y)
        } else if (tool === 'arrow' && currentArrowRef.current) {
          currentArrowRef.current.points([start.x, start.y, pos.x, pos.y])
        }

        layer?.batchDraw()
      } else {
        // Panning
        if (!panFn) return

        const dx = stagePos.x - lastPos.current.x
        const dy = stagePos.y - lastPos.current.y
        lastPos.current = stagePos

        panFn({
          x: currentOffset.x + dx,
          y: currentOffset.y + dy,
        })
      }
    }

    const handleGlobalUp = () => {
      finalizeDrawing()
    }

    window.addEventListener('mousemove', handleGlobalMove)
    window.addEventListener('mouseup', handleGlobalUp)
    window.addEventListener('touchmove', handleGlobalMove)
    window.addEventListener('touchend', handleGlobalUp)

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove)
      window.removeEventListener('mouseup', handleGlobalUp)
      window.removeEventListener('touchmove', handleGlobalMove)
      window.removeEventListener('touchend', handleGlobalUp)
    }
  }, [])

  const handleMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isDrawing) {
      // Drawing Logic
      if (currentTool === 'select') return

      const stage = e.target.getStage()
      if (!stage) return

      // Use imageRef to get coordinates relative to the image (handling zoom/pan)
      const pos = getRelativePointerPosition(imageRef.current!)
      if (!pos) return

      // Only start drawing if within media bounds
      if (
        pos.x < 0 ||
        pos.x > mediaDimensions.width ||
        pos.y < 0 ||
        pos.y > mediaDimensions.height
      ) {
        return
      }

      isDragging.current = true
      startPointRef.current = pos

      const layer = imageRef.current?.getLayer()
      if (!layer) return

      if (currentTool === 'freehand' && currentLineRef.current) {
        currentLineRef.current.points([pos.x, pos.y])
        currentLineRef.current.stroke(currentColor)
        currentLineRef.current.visible(true)
      } else if (currentTool === 'line' && currentLineRef.current) {
        currentLineRef.current.points([pos.x, pos.y, pos.x, pos.y])
        currentLineRef.current.stroke(currentColor)
        currentLineRef.current.visible(true)
      } else if (currentTool === 'box' && currentRectRef.current) {
        currentRectRef.current.position(pos)
        currentRectRef.current.width(0)
        currentRectRef.current.height(0)
        currentRectRef.current.stroke(currentColor)
        currentRectRef.current.visible(true)
      } else if (currentTool === 'arrow' && currentArrowRef.current) {
        currentArrowRef.current.points([pos.x, pos.y, pos.x, pos.y])
        currentArrowRef.current.stroke(currentColor)
        currentArrowRef.current.fill(currentColor)
        currentArrowRef.current.visible(true)
      }

      layer.batchDraw()
    } else {
      // Panning Logic
      if (!onPan) return
      isDragging.current = true
      const stage = e.target.getStage()
      if (stage) {
        const pointer = stage.getPointerPosition()
        if (pointer) {
          lastPos.current = pointer
        }
      }
    }
  }

  const renderAnnotation = (annotation: Annotation, i: number) => {
    const w = mediaDimensions.width
    const h = mediaDimensions.height
    // We add a key suffix to force re-render if updated? No, index is fine for this list.
    // Actually, we might want stable IDs if we were editing existing ones.

    // Stroke Width Logic:
    // We want the stroke to be visible regardless of zoom.
    // If we use `strokeScaleEnabled={false}`, Konva handles it!
    // Wait, `strokeScaleEnabled` defaults to true.
    // If false, stroke width is in screen pixels.
    // Let's try `strokeScaleEnabled={false}` and `strokeWidth={2}`.

    switch (annotation.type) {
      case 'box': {
        const [start, end] = annotation.points
        const x = Math.min(start[0], end[0]) * w
        const y = Math.min(start[1], end[1]) * h
        const boxWidth = Math.abs(end[0] - start[0]) * w
        const boxHeight = Math.abs(end[1] - start[1]) * h

        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={boxWidth}
            height={boxHeight}
            stroke={annotation.color}
            strokeWidth={2.6 / scale}
            listening={false}
          />
        )
      }
      case 'arrow': {
        const points = annotation.points.flat().map((p, idx) => (idx % 2 === 0 ? p * w : p * h))
        return (
          <Arrow
            key={i}
            points={points}
            stroke={annotation.color}
            strokeWidth={2.6 / scale}
            fill={annotation.color}
            pointerLength={10 / scale}
            pointerWidth={10 / scale}
            listening={false}
          />
        )
      }
      case 'line':
      case 'freehand': {
        const points = annotation.points.flat().map((p, idx) => (idx % 2 === 0 ? p * w : p * h))
        return (
          <Line
            key={i}
            points={points}
            stroke={annotation.color}
            strokeWidth={2.6 / scale}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )
      }
      default:
        return null
    }
  }

  return (
    <div
      className={className}
      style={{
        width,
        height,
        overflow: 'hidden',
        pointerEvents: !isDrawing && !onPan ? 'none' : 'auto',
        cursor:
          isDrawing && currentTool !== 'select'
            ? 'crosshair'
            : onPan
              ? isDragging.current
                ? 'grabbing'
                : 'grab'
              : 'default',
      }}
    >
      <Stage
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={offset.x}
        y={offset.y}
        onMouseDown={handleMouseDown}
        onClick={!isDrawing ? onClick : undefined}
        onTap={!isDrawing ? onClick : undefined}
        onTouchStart={handleMouseDown}
      >
        <Layer>
          <KonvaImage
            ref={imageRef}
            image={videoElement || loadedImage}
            width={mediaDimensions.width}
            height={mediaDimensions.height}
          />
          {annotations.map(renderAnnotation)}

          {/* Draft Shapes */}
          <Group listening={false}>
            <Line
              ref={currentLineRef}
              strokeWidth={2.6 / scale}
              lineCap="round"
              lineJoin="round"
              visible={false}
            />
            <Rect ref={currentRectRef} strokeWidth={2.6 / scale} visible={false} />
            <Arrow
              ref={currentArrowRef}
              points={[]}
              strokeWidth={2.6 / scale}
              pointerLength={10 / scale}
              pointerWidth={10 / scale}
              visible={false}
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}

export default DrawingCanvas
