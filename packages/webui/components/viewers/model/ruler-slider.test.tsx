// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RulerSlider } from './ruler-slider'

describe('RulerSlider', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders slider with fixed center indicator and aria values', () => {
    const onChange = vi.fn()
    const { getByRole, getByTestId, queryByTestId } = render(
      <RulerSlider currentDegree={90} onChange={onChange} />,
    )

    const slider = getByRole('slider')
    expect(slider).toBeDefined()
    expect(slider.getAttribute('aria-valuenow')).toBe('90')
    expect(slider.getAttribute('aria-valuetext')).toBe('90°')

    // Fixed center indicator exists
    expect(getByTestId('ruler-center-indicator')).toBeDefined()

    // Tooltip should not be rendered while not dragging
    expect(queryByTestId('ruler-slider-tooltip')).toBeNull()
  })

  it('renders ticks at 15° intervals, longer at 60° intervals, and no numeric tick labels', () => {
    const onChange = vi.fn()
    const { container, getAllByTestId } = render(
      <RulerSlider currentDegree={0} onChange={onChange} />,
    )

    // Major ticks at multiples of 60°
    const ticks0 = getAllByTestId('tick-0')
    expect(ticks0.length).toBeGreaterThan(0)
    expect(ticks0[0]?.getAttribute('data-major')).toBe('true')

    const ticks60 = getAllByTestId('tick-60')
    expect(ticks60.length).toBeGreaterThan(0)
    expect(ticks60[0]?.getAttribute('data-major')).toBe('true')

    // Regular tick at 15° is not major
    const ticks15 = getAllByTestId('tick-15')
    expect(ticks15.length).toBeGreaterThan(0)
    expect(ticks15[0]?.getAttribute('data-major')).toBe('false')

    // No numeric degree text inside the slider track
    expect(container.textContent).toBe('')
  })

  it('shows tooltip displaying degree while dragging and hides on pointer up', () => {
    const onChange = vi.fn()
    const { getByRole, getByTestId, queryByTestId } = render(
      <RulerSlider currentDegree={45} onChange={onChange} />,
    )

    const slider = getByRole('slider')
    slider.setPointerCapture = vi.fn()
    slider.releasePointerCapture = vi.fn()

    // Initially no tooltip
    expect(queryByTestId('ruler-slider-tooltip')).toBeNull()

    // Start dragging
    fireEvent.pointerDown(slider, { clientX: 100, button: 0, pointerId: 1 })
    const tooltip = getByTestId('ruler-slider-tooltip')
    expect(tooltip).toBeDefined()
    expect(tooltip.textContent).toBe('45°')

    // Release drag
    fireEvent.pointerUp(slider, { clientX: 100, button: 0, pointerId: 1 })
    expect(queryByTestId('ruler-slider-tooltip')).toBeNull()
  })

  it('handles keyboard navigation with 15 degree stepping and wrapping', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<RulerSlider currentDegree={45} onChange={onChange} />)

    const slider = getByRole('slider')

    // 45 + 15 = 60
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(60)

    // 45 - 15 = 30
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(30)

    // Home -> 0
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith(0)

    // End -> 345
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onChange).toHaveBeenCalledWith(345)
  })

  it('wraps around 0° and 360° on keyboard navigation', () => {
    const onChange = vi.fn()
    const { getByRole, rerender } = render(<RulerSlider currentDegree={0} onChange={onChange} />)

    const slider = getByRole('slider')

    // 0 - 15 wraps to 345
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(345)

    // 345 + 15 wraps to 0
    rerender(<RulerSlider currentDegree={345} onChange={onChange} />)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('handles pointer drag interaction with 15 degree snapping and wrapping', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<RulerSlider currentDegree={0} onChange={onChange} />)

    const slider = getByRole('slider')
    slider.setPointerCapture = vi.fn()
    slider.releasePointerCapture = vi.fn()

    // Start drag at x = 100
    fireEvent.pointerDown(slider, { clientX: 100, button: 0, pointerId: 1 })
    expect(slider.setPointerCapture).toHaveBeenCalledWith(1)

    // Drag left by 24px (15° forward: deltaX = -24 => deltaDeg = +15)
    fireEvent.pointerMove(slider, { clientX: 76, button: 0, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(15)

    // Drag right by 24px from origin (x=124 => deltaX = +24 => deltaDeg = -15 => wraps to 345)
    fireEvent.pointerMove(slider, { clientX: 124, button: 0, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(345)

    // Release pointer
    fireEvent.pointerUp(slider, { clientX: 124, button: 0, pointerId: 1 })
    expect(slider.releasePointerCapture).toHaveBeenCalledWith(1)
  })
})
