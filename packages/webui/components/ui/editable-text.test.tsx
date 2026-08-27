// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditableText } from './editable-text'

describe('EditableText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
    cleanup()
  })

  it('renders a span in read-only (disabled) mode with the value', () => {
    render(<EditableText value="MyLongFileName.mp4" disabled={true} />)

    expect(screen.queryByRole('textbox')).toBeNull()
    const span = screen.getByText('MyLongFileName.mp4')
    expect(span).toBeTruthy()
    expect(span.tagName.toLowerCase()).toBe('span')
    expect(span.className).toContain('truncate')
  })

  it('renders an input in editable (!disabled) mode', () => {
    const handleChange = vi.fn()
    render(<EditableText value="MyFile.txt" disabled={false} onChange={handleChange} />)

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('MyFile.txt')
  })

  it('does not show tooltip on hover when text is not truncated', () => {
    render(<EditableText value="Short.png" disabled={true} />)

    const span = screen.getByText('Short.png')
    Object.defineProperty(span, 'scrollWidth', { value: 80, configurable: true })
    Object.defineProperty(span, 'clientWidth', { value: 100, configurable: true })

    fireEvent.pointerMove(span, { pointerType: 'mouse' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Tooltip should not be displayed
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows full name in tooltip after 100ms when text is truncated', () => {
    render(
      <EditableText
        value="A_very_long_file_name_that_will_overflow_the_column_width.mov"
        disabled={true}
      />,
    )

    const span = screen.getByText('A_very_long_file_name_that_will_overflow_the_column_width.mov')
    Object.defineProperty(span, 'scrollWidth', { value: 300, configurable: true })
    Object.defineProperty(span, 'clientWidth', { value: 120, configurable: true })

    fireEvent.pointerMove(span, { pointerType: 'mouse' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeTruthy()
    expect(tooltip.textContent).toContain(
      'A_very_long_file_name_that_will_overflow_the_column_width.mov',
    )
  })

  it('handles input events and keydown when editing', () => {
    const handleKeyDown = vi.fn()
    const handleBlur = vi.fn()
    render(
      <EditableText
        value="Editable.txt"
        disabled={false}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />,
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(handleKeyDown).toHaveBeenCalledTimes(1)

    fireEvent.blur(input)
    expect(handleBlur).toHaveBeenCalledTimes(1)
  })
})
