// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LongTextField from './long-text-field'

describe('LongTextField Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const dummyConfig = {
    name: 'Description',
    type: 'longText' as const,
  }

  it('renders collapsed placeholder with fixed 2-row height and whitespace-pre-wrap', () => {
    render(<LongTextField value="Line 1\nLine 2\nLine 3" config={dummyConfig} onSave={vi.fn()} />)
    const collapsed = screen.getByTitle('Click to expand')
    expect(collapsed).toBeTruthy()
    expect(collapsed.className).toContain('h-[48px]')
    expect(collapsed.className).toContain('line-clamp-2')
    expect(collapsed.className).toContain('whitespace-pre-wrap')
  })

  it('renders Empty state inside 2-row container when value is empty', () => {
    render(<LongTextField value="" config={dummyConfig} onSave={vi.fn()} />)
    const collapsed = screen.getByTitle('Click to expand')
    expect(collapsed.className).toContain('h-[48px]')
    expect(screen.getByText('Empty')).toBeTruthy()
  })

  it('expands on click to show full content overlay', () => {
    render(<LongTextField value="Line 1\nLine 2\nLine 3" config={dummyConfig} onSave={vi.fn()} />)
    const collapsed = screen.getByTitle('Click to expand')
    fireEvent.click(collapsed)

    const elements = screen.getAllByText(/Line 1/)
    expect(elements.length).toBe(2)
  })

  it('switches to textarea when clicking the expanded overlay in non-readonly mode and saves on blur', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Initial content" config={dummyConfig} onSave={onSave} />)

    // First click: expand overlay
    const collapsed = screen.getByTitle('Click to expand')
    fireEvent.click(collapsed)

    // Second click: click overlay to edit
    const overlay = screen.getByTitle('Click to edit')
    fireEvent.click(overlay)

    // Textarea should now be rendered
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.value).toBe('Initial content')

    // Change value and blur
    fireEvent.change(textarea, { target: { value: 'Updated content' } })
    fireEvent.blur(textarea)

    expect(onSave).toHaveBeenCalledWith('Updated content')
  })

  it('blurs and saves when pressing Cmd+Enter in textarea', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Initial content" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByTitle('Click to expand'))
    fireEvent.click(screen.getByTitle('Click to edit'))

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Content saved via shortcut' } })
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

    expect(onSave).toHaveBeenCalledWith('Content saved via shortcut')
  })

  it('does not allow editing in readOnly mode', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Readonly text" config={dummyConfig} onSave={onSave} readOnly />)

    const collapsed = screen.getByTitle('Click to expand')
    fireEvent.click(collapsed)

    // Overlay is present, but should not have 'Click to edit' title
    expect(screen.queryByTitle('Click to edit')).toBeNull()
    const elements = screen.getAllByText('Readonly text')
    expect(elements.length).toBe(2)

    // Clicking the expanded text should not switch to textarea
    fireEvent.click(elements[1])
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
