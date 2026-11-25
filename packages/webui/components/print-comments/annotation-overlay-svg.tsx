import type { Annotation } from '@/ui/types'
import React from 'react'

export function parseAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return []
  const valid: Annotation[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const type = rec.type
    const color = rec.color
    const points = rec.points
    if (
      (type === 'box' || type === 'line' || type === 'arrow' || type === 'freehand') &&
      typeof color === 'string' &&
      Array.isArray(points) &&
      points.length >= 2 &&
      points.every(
        (pt) =>
          Array.isArray(pt) &&
          pt.length >= 2 &&
          typeof pt[0] === 'number' &&
          typeof pt[1] === 'number',
      )
    ) {
      valid.push({
        type,
        color,
        points: points as [number, number][],
      } as Annotation)
    }
  }
  return valid
}

interface AnnotationOverlaySvgProps {
  annotations: Annotation[]
  width: number
  height: number
  className?: string
}

function buildFreehandPath(points: [number, number][], w: number, h: number): string {
  if (points.length === 0) return ''
  const scaled = points.map(([nx, ny]) => [nx * w, ny * h] as const)
  if (scaled.length === 2) {
    return `M ${scaled[0][0]} ${scaled[0][1]} L ${scaled[1][0]} ${scaled[1][1]}`
  }

  // Smooth quadratic path matching Konva's tension ~0.5 appearance
  let d = `M ${scaled[0][0]} ${scaled[0][1]}`
  for (let i = 1; i < scaled.length - 1; i++) {
    const midX = (scaled[i][0] + scaled[i + 1][0]) / 2
    const midY = (scaled[i][1] + scaled[i + 1][1]) / 2
    d += ` Q ${scaled[i][0]} ${scaled[i][1]} ${midX} ${midY}`
  }
  const last = scaled[scaled.length - 1]
  d += ` L ${last[0]} ${last[1]}`
  return d
}

/**
 * Vector SVG overlay for normalized [0..1] comment annotations.
 * Using inline SVG instead of rasterized canvas ensures sharp markups when
 * printing or exporting to PDF and avoids browser canvas limits on long lists.
 */
export const AnnotationOverlaySvg: React.FC<AnnotationOverlaySvgProps> = ({
  annotations,
  width,
  height,
  className,
}) => {
  if (annotations.length === 0 || width <= 0 || height <= 0) return null

  // Keep stroke visually consistent with DrawingCanvas regardless of image dimensions
  const baseDim = Math.max(width, height)
  const strokeWidth = Math.max(1.5, baseDim * 0.014)
  const headLength = strokeWidth * 3.8
  const headHalfWidth = strokeWidth * 2.1

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      data-testid="print-annotation-overlay"
      aria-hidden="true"
    >
      {annotations.map((ann, idx) => {
        if (ann.type === 'box') {
          const [start, end] = ann.points
          const x = Math.min(start[0], end[0]) * width
          const y = Math.min(start[1], end[1]) * height
          const boxW = Math.abs(end[0] - start[0]) * width
          const boxH = Math.abs(end[1] - start[1]) * height
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              fill="none"
              stroke={ann.color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          )
        }

        if (ann.type === 'line') {
          const [start, end] = ann.points
          return (
            <line
              key={idx}
              x1={start[0] * width}
              y1={start[1] * height}
              x2={end[0] * width}
              y2={end[1] * height}
              stroke={ann.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )
        }

        if (ann.type === 'arrow') {
          const [start, end] = ann.points
          const x1 = start[0] * width
          const y1 = start[1] * height
          const x2 = end[0] * width
          const y2 = end[1] * height
          const angle = Math.atan2(y2 - y1, x2 - x1)
          const lineLen = Math.hypot(x2 - x1, y2 - y1)
          const clampedHeadLen = Math.min(headLength, lineLen * 0.65)
          const clampedHalfW = (clampedHeadLen / headLength) * headHalfWidth
          const baseX = x2 - clampedHeadLen * Math.cos(angle)
          const baseY = y2 - clampedHeadLen * Math.sin(angle)
          const leftX = baseX - clampedHalfW * Math.sin(angle)
          const leftY = baseY + clampedHalfW * Math.cos(angle)
          const rightX = baseX + clampedHalfW * Math.sin(angle)
          const rightY = baseY - clampedHalfW * Math.cos(angle)

          return (
            <g key={idx}>
              <line
                x1={x1}
                y1={y1}
                x2={baseX}
                y2={baseY}
                stroke={ann.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <polygon
                points={`${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`}
                fill={ann.color}
              />
            </g>
          )
        }

        if (ann.type === 'freehand') {
          const d = buildFreehandPath(ann.points, width, height)
          return (
            <path
              key={idx}
              d={d}
              fill="none"
              stroke={ann.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        }

        return null
      })}
    </svg>
  )
}
