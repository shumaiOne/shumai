import { useEffect, useRef } from 'react'
import { isZoomed, type PanZoomState, wheelZoomFactor, zoomAtPoint } from './pan-zoom'

interface UsePanZoomGesturesOptions {
  containerRef: { current: HTMLElement | null }
  zoom: number
  pan: { x: number; y: number }
  /** The "fit" scale for the current container — zoom above this allows panning. */
  baseScale: number
  /** Called when a gesture changes zoom (and possibly pan). */
  onZoomChange: (next: PanZoomState) => void
  /** Called when a two-finger move / wheel scroll pans the content. */
  onPanChange: (next: { x: number; y: number }) => void
}

interface PinchState {
  lastDist: number
  lastMid: { x: number; y: number }
}

/**
 * Adds trackpad/touchscreen pan-zoom gestures to a media container:
 * - ctrl+wheel (trackpad pinch) → zoom the content about the cursor,
 *   suppressing the browser's native page zoom.
 * - plain wheel (two-finger scroll / mouse wheel) → pan the content, but only
 *   once the user has zoomed in.
 * - two-finger touch pinch/move → zoom about the pinch midpoint and pan by the
 *   midpoint delta (pan only while zoomed in).
 *
 * The container must be styled with `touch-action: none` so the browser does
 * not scroll/zoom the page from within it. Native, non-passive listeners are
 * used so `preventDefault()` reliably suppresses browser gestures.
 */
export function usePanZoomGestures({
  containerRef,
  zoom,
  pan,
  baseScale,
  onZoomChange,
  onPanChange,
}: UsePanZoomGesturesOptions) {
  const stateRef = useRef({ zoom, pan, baseScale, onZoomChange, onPanChange })
  stateRef.current = { zoom, pan, baseScale, onZoomChange, onPanChange }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const activeTouches = new Map<number, { x: number; y: number }>()
    let pinch: PinchState | null = null

    const handleWheel = (e: WheelEvent) => {
      const s = stateRef.current
      if (e.ctrlKey) {
        // Trackpad pinch / ctrl+scroll → zoom the media about the cursor.
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        s.onZoomChange(zoomAtPoint(s.zoom, s.pan, wheelZoomFactor(e.deltaY, e.deltaMode), px, py))
        return
      }
      // Plain wheel / two-finger scroll → pan, but only once zoomed in.
      if (isZoomed(s.zoom, s.baseScale)) {
        e.preventDefault()
        s.onPanChange({ x: s.pan.x - e.deltaX, y: s.pan.y - e.deltaY })
      }
    }

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(b.x - a.x, b.y - a.y)

    const mid = (a: { x: number; y: number }, b: { x: number; y: number }, rect: DOMRect) => ({
      x: (a.x + b.x) / 2 - rect.left,
      y: (a.y + b.y) / 2 - rect.top,
    })

    const handleTouchStart = (e: TouchEvent) => {
      for (const t of Array.from(e.touches)) {
        activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY })
      }
      if (activeTouches.size === 2) {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const [a, b] = Array.from(activeTouches.values())
        pinch = { lastDist: dist(a, b), lastMid: mid(a, b, rect) }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      for (const t of Array.from(e.touches)) {
        activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY })
      }
      if (!pinch || activeTouches.size < 2) return
      e.preventDefault()

      const rect = el.getBoundingClientRect()
      const [a, b] = Array.from(activeTouches.values())
      const currentMid = mid(a, b, rect)
      const currentDist = dist(a, b)
      const s = stateRef.current

      // Zoom by the pinch distance ratio (incremental about the midpoint).
      const factor = pinch.lastDist > 0 ? currentDist / pinch.lastDist : 1
      const next = zoomAtPoint(s.zoom, s.pan, factor, currentMid.x, currentMid.y)

      // Two-finger move pans the content, but only once zoomed in.
      let nextPan = next.pan
      if (isZoomed(next.zoom, s.baseScale)) {
        nextPan = {
          x: nextPan.x + (currentMid.x - pinch.lastMid.x),
          y: nextPan.y + (currentMid.y - pinch.lastMid.y),
        }
      }
      s.onZoomChange({ zoom: next.zoom, pan: nextPan })

      pinch.lastDist = currentDist
      pinch.lastMid = currentMid
    }

    const handleTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        activeTouches.delete(t.identifier)
      }
      if (activeTouches.size < 2) {
        pinch = null
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [containerRef])
}
