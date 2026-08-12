export interface PanZoomState {
  zoom: number
  pan: { x: number; y: number }
}

export const MIN_ZOOM = 0.01
export const MAX_ZOOM = 50

/** Scale that fits `media` inside `container` while preserving aspect ratio. */
export function fitScale(conW: number, conH: number, mediaW: number, mediaH: number): number {
  if (conW <= 0 || conH <= 0 || mediaW <= 0 || mediaH <= 0) return 1
  return Math.min(conW / mediaW, conH / mediaH)
}

/** Pan that centers media of `mediaW` x `mediaH` at the given zoom. */
export function centeredPan(
  conW: number,
  conH: number,
  mediaW: number,
  mediaH: number,
  zoom: number,
): { x: number; y: number } {
  return { x: (conW - mediaW * zoom) / 2, y: (conH - mediaH * zoom) / 2 }
}

/**
 * Whether the user has zoomed in far enough that panning is meaningful.
 * A small epsilon avoids float noise around the fit scale.
 */
export function isZoomed(zoom: number, baseScale: number, epsilon = 0.02): boolean {
  return zoom > baseScale * (1 + epsilon)
}

export function clampZoom(zoom: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  return Math.min(max, Math.max(min, zoom))
}

/**
 * Zoom by `factor` about container point `(px, py)`, keeping the content
 * under that point fixed (used for cursor/pinch-midpoint anchored zoom).
 */
export function zoomAtPoint(
  zoom: number,
  pan: { x: number; y: number },
  factor: number,
  px: number,
  py: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
): PanZoomState {
  const newZoom = clampZoom(zoom * factor, min, max)
  const ratio = newZoom / zoom
  return {
    zoom: newZoom,
    pan: {
      x: px - (px - pan.x) * ratio,
      y: py - (py - pan.y) * ratio,
    },
  }
}

/**
 * Per-event zoom factor for a ctrl+wheel (trackpad pinch / ctrl+scroll).
 * Normalizes line/page delta modes to pixel-like values, then clamps so a
 * single event can't cause a jarring jump.
 */
export function wheelZoomFactor(deltaY: number, deltaMode?: number): number {
  const normalized = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY
  const factor = Math.exp(-normalized * 0.01)
  return Math.min(2, Math.max(0.5, factor))
}
