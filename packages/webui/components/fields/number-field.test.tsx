// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NumberField from './number-field'

describe('NumberField Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const dummyConfig = {
    name: 'Score',
    type: 'number' as const,
    number: {
      scale: 2,
    },
  }

  it('renders Empty state when value is undefined', () => {
    render(<NumberField value={undefined} config={dummyConfig} onSave={vi.fn()} />)
    expect(screen.getByText('Empty')).toBeTruthy()
  })

  it('formats number with scale', () => {
    render(<NumberField value={42} config={dummyConfig} onSave={vi.fn()} />)
    expect(screen.getByText('42.00')).toBeTruthy()
  })

  it('enters edit mode on click and stops event propagation', () => {
    const parentClick = vi.fn()
    const parentDoubleClick = vi.fn()
    render(
      <div onClick={parentClick} onDoubleClick={parentDoubleClick}>
        <NumberField value={10} config={dummyConfig} onSave={vi.fn()} />
      </div>,
    )

    const display = screen.getByText('10.00')
    fireEvent.click(display)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('10')
    expect(parentClick).not.toHaveBeenCalled()

    fireEvent.doubleClick(input)
    expect(parentDoubleClick).not.toHaveBeenCalled()
  })

  it('saves parsed number on blur', () => {
    const onSave = vi.fn()
    render(<NumberField value={10} config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByText('10.00'))
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '25.5' } })
    fireEvent.blur(input)

    expect(onSave).toHaveBeenCalledWith(25.5)
  })

  it('cancels edit on Escape key', () => {
    const onSave = vi.fn()
    render(<NumberField value={10} config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByText('10.00'))
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByText('10.00')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not enter edit mode when readOnly', () => {
    render(<NumberField value={10} config={dummyConfig} onSave={vi.fn()} readOnly />)

    fireEvent.click(screen.getByText('10.00'))
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})
