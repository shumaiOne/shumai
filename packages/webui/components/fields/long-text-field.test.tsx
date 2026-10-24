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
    const collapsed = screen.getByTestId('long-text-placeholder')
    expect(collapsed).toBeTruthy()
    expect(collapsed.title).toBe('Click to edit')
    expect(collapsed.className).toContain('h-[48px]')
    expect(collapsed.className).toContain('line-clamp-2')
    expect(collapsed.className).toContain('whitespace-pre-wrap')
  })

  it('renders Empty state inside 2-row container when value is empty', () => {
    render(<LongTextField value="" config={dummyConfig} onSave={vi.fn()} />)
    const collapsed = screen.getByTestId('long-text-placeholder')
    expect(collapsed.className).toContain('h-[48px]')
    expect(screen.getByText('Empty')).toBeTruthy()
  })

  it('single click expands directly into textarea editing mode and positions cursor at the end', () => {
    const text = 'Line 1\nLine 2\nLine 3'
    render(<LongTextField value={text} config={dummyConfig} onSave={vi.fn()} />)
    const collapsed = screen.getByTestId('long-text-placeholder')
    fireEvent.click(collapsed)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.value).toBe(text)
    expect(textarea.selectionStart).toBe(text.length)
    expect(textarea.selectionEnd).toBe(text.length)
    expect(collapsed.className).toContain('invisible')
  })

  it('saves updated content on blur', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Initial content" config={dummyConfig} onSave={onSave} />)

    // Single click directly opens editing textarea
    fireEvent.click(screen.getByTestId('long-text-placeholder'))

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.value).toBe('Initial content')

    // Change value and blur
    fireEvent.change(textarea, { target: { value: 'Updated content' } })
    fireEvent.blur(textarea)

    expect(onSave).toHaveBeenCalledWith('Updated content')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('does not call onSave on blur if value did not change', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Unchanged" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('long-text-placeholder'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.blur(textarea)

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('blurs and saves when pressing Cmd+Enter in textarea', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Initial content" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('long-text-placeholder'))

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Content saved via shortcut' } })
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

    expect(onSave).toHaveBeenCalledWith('Content saved via shortcut')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('cancels editing on Escape key and discards changes', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Line 1\nLine 2" config={dummyConfig} onSave={onSave} />)

    fireEvent.click(screen.getByTestId('long-text-placeholder'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()

    fireEvent.change(textarea, { target: { value: 'Changed content' } })
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not allow editing in readOnly mode, only expanding view', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Readonly text" config={dummyConfig} onSave={onSave} readOnly />)

    const collapsed = screen.getByTestId('long-text-placeholder')
    expect(collapsed.title).toBe('Click to expand')
    fireEvent.click(collapsed)

    // Expanded read-only overlay is present, but no textarea
    expect(screen.queryByRole('textbox')).toBeNull()
    const expandedView = screen.getByTestId('long-text-expanded-overlay')
    expect(expandedView).toBeTruthy()
    expect(expandedView.textContent).toContain('Readonly text')

    // Escape closes read-only overlay
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('long-text-expanded-overlay')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
