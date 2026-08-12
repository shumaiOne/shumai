import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centeredPan,
  clampZoom,
  fitScale,
  isZoomed,
  wheelZoomFactor,
  zoomAtPoint,
} from './pan-zoom'

describe('fitScale', () => {
  it('fits a wide media into a narrower container by width', () => {
    expect(fitScale(100, 100, 200, 100)).toBe(0.5)
  })

  it('fits a tall media into a shorter container by height', () => {
    expect(fitScale(100, 100, 100, 200)).toBe(0.5)
  })

  it('keeps aspect ratio (min of both axes)', () => {
    expect(fitScale(100, 50, 200, 200)).toBe(0.25)
  })

  it('returns 1 for empty container or media dimensions', () => {
    expect(fitScale(0, 100, 100, 100)).toBe(1)
    expect(fitScale(100, 0, 100, 100)).toBe(1)
    expect(fitScale(100, 100, 0, 100)).toBe(1)
    expect(fitScale(100, 100, 100, 0)).toBe(1)
  })
})

describe('centeredPan', () => {
  it('centers a smaller-than-container media', () => {
    expect(centeredPan(1000, 1000, 500, 500, 1)).toEqual({ x: 250, y: 250 })
  })

  it('centers a scaled media', () => {
    expect(centeredPan(1000, 800, 200, 100, 2)).toEqual({ x: 300, y: 300 })
  })
})

describe('isZoomed', () => {
  it('is false at or below fit scale', () => {
    expect(isZoomed(1, 1)).toBe(false)
    expect(isZoomed(0.5, 1)).toBe(false)
  })

  it('is true above the fit scale plus epsilon', () => {
    expect(isZoomed(1.2, 1)).toBe(true)
    expect(isZoomed(1.01, 1)).toBe(false)
  })
})

describe('clampZoom', () => {
  it('clamps to the configured bounds', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM)
    expect(clampZoom(1000)).toBe(MAX_ZOOM)
    expect(clampZoom(2)).toBe(2)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the anchor point fixed while zooming', () => {
    const result = zoomAtPoint(1, { x: 0, y: 0 }, 2, 100, 50)
    expect(result.zoom).toBe(2)
    // Anchor (100, 50) must map to itself: pan' = px - (px - pan) * ratio
    expect(result.pan).toEqual({ x: -100, y: -50 })
  })

  it('zooms about the container center like the old center-zoom behavior', () => {
    // With pan (0,0) and anchor at center (50, 50), doubling zoom pushes pan
    // to (-50, -50).
    const result = zoomAtPoint(1, { x: 0, y: 0 }, 2, 50, 50)
    expect(result.pan).toEqual({ x: -50, y: -50 })
  })

  it('zooming out keeps the anchor fixed', () => {
    const result = zoomAtPoint(2, { x: -100, y: -50 }, 0.5, 100, 50)
    expect(result.zoom).toBe(1)
    expect(result.pan).toEqual({ x: 0, y: 0 })
  })

  it('clamps zoom while still keeping the anchor fixed', () => {
    const result = zoomAtPoint(40, { x: 10, y: 20 }, 2, 5, 5)
    expect(result.zoom).toBe(MAX_ZOOM)
    // ratio is 50/40 = 1.25 once clamped; the anchor (5, 5) stays fixed
    expect(result.pan).toEqual({ x: 11.25, y: 23.75 })
  })

  it('keeps pan untouched when already at the bound (ratio 1)', () => {
    const result = zoomAtPoint(MAX_ZOOM, { x: 10, y: 20 }, 2, 5, 5)
    expect(result.zoom).toBe(MAX_ZOOM)
    expect(result.pan).toEqual({ x: 10, y: 20 })
  })

  it('clamps at the minimum zoom', () => {
    const result = zoomAtPoint(0.05, { x: 10, y: 20 }, 0.1, 5, 5)
    expect(result.zoom).toBe(MIN_ZOOM)
  })
})

describe('wheelZoomFactor', () => {
  it('zooms in for negative delta (scroll up / pinch out)', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
  })

  it('zooms out for positive delta (scroll down / pinch in)', () => {
    expect(wheelZoomFactor(100)).toBeLessThan(1)
  })

  it('normalizes line and page delta modes to pixel-like scales', () => {
    // deltaMode 1 = lines: multiply by 16
    expect(wheelZoomFactor(-6.25, 1)).toBe(wheelZoomFactor(-100, 0))
    // deltaMode 2 = pages: multiply by 100
    expect(wheelZoomFactor(-1, 2)).toBe(wheelZoomFactor(-100, 0))
  })

  it('clamps extreme deltas to avoid jumps', () => {
    expect(wheelZoomFactor(-1_000_000)).toBe(2)
    expect(wheelZoomFactor(1_000_000)).toBe(0.5)
  })
})
