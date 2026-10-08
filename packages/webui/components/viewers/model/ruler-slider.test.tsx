// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RulerSlider } from './ruler-slider'

describe('RulerSlider', () => {
  afterEach(() => {
    cleanup()
  })
  it('renders slider and shows current degree text', () => {
    const onChange = vi.fn()
    const { getByRole, getAllByText } = render(
      <RulerSlider currentDegree={90} onChange={onChange} />,
    )

    const slider = getByRole('slider')
    expect(slider).toBeDefined()
    expect(slider.getAttribute('aria-valuenow')).toBe('90')
    expect(getAllByText('90°').length).toBeGreaterThan(0)
  })

  it('handles keyboard navigation with 15 degree snapping', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<RulerSlider currentDegree={45} onChange={onChange} />)

    const slider = getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(60)

    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith(30)

    fireEvent.keyDown(slider, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith(0)

    fireEvent.keyDown(slider, { key: 'End' })
    expect(onChange).toHaveBeenCalledWith(360)
  })

  it('snaps pointer events to nearest 15 degrees', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<RulerSlider currentDegree={0} onChange={onChange} />)

    const slider = getByRole('slider')
    // Mock getBoundingClientRect
    slider.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 360,
        top: 0,
        height: 40,
        right: 360,
        bottom: 40,
      }) as DOMRect

    // Pointer down at x=50 -> ratio = 50/360 = 50 deg -> round(50/15)*15 = 45 deg
    fireEvent.pointerDown(slider, { clientX: 50, button: 0, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(45)
  })
})
