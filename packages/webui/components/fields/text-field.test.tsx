// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TextField from './text-field'

describe('TextField Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const dummyConfig = {
    name: 'Title',
    type: 'text' as const,
  }

  it('renders Empty state when value is empty', () => {
    render(<TextField value="" config={dummyConfig} onSave={vi.fn()} />)
    expect(screen.getByText('Empty')).toBeTruthy()
  })

  it('enters edit mode on click and stops event propagation', () => {
    const parentClick = vi.fn()
    const parentDoubleClick = vi.fn()
    render(
      <div onClick={parentClick} onDoubleClick={parentDoubleClick}>
        <TextField value="Test Text" config={dummyConfig} onSave={vi.fn()} />
      </div>,
    )

    const display = screen.getByText('Test Text')
    fireEvent.click(display)

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('Test Text')
    expect(parentClick).not.toHaveBeenCalled()

    fireEvent.doubleClick(input)
    expect(parentDoubleClick).not.toHaveBeenCalled()
  })

  it('saves on blur when value changed', () => {
    const onSave = vi.fn()
    render(<TextField value="Initial" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByText('Initial'))
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Updated' } })
    fireEvent.blur(input)

    expect(onSave).toHaveBeenCalledWith('Updated')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('does not save on blur if value is unchanged', () => {
    const onSave = vi.fn()
    render(<TextField value="Same" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByText('Same'))
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.blur(input)

    expect(onSave).not.toHaveBeenCalled()
  })

  it('blurs on Enter key', () => {
    const onSave = vi.fn()
    render(<TextField value="Initial" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByText('Initial'))
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Enter Saved' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('Enter Saved')
  })

  it('cancels edit and discards changes on Escape key', () => {
    const onSave = vi.fn()
    render(<TextField value="Original" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByText('Original'))
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Original')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not enter edit mode when readOnly', () => {
    render(<TextField value="ReadOnly Text" config={dummyConfig} onSave={vi.fn()} readOnly />)

    fireEvent.click(screen.getByText('ReadOnly Text'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
