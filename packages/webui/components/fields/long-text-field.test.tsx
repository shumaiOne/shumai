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

  it('expands on click to show full content in-place without clipping', () => {
    render(<LongTextField value="Line 1\nLine 2\nLine 3" config={dummyConfig} onSave={vi.fn()} />)
    const collapsed = screen.getByTitle('Click to expand')
    fireEvent.click(collapsed)

    const expanded = screen.getByTestId('long-text-expanded-overlay')
    expect(expanded).toBeTruthy()
    expect(expanded.textContent).toContain('Line 1')
    expect(expanded.textContent).toContain('Line 3')
    expect(expanded.className).toContain('min-h-[80px]')
    expect(expanded.className).toContain('overflow-y-auto')
  })

  it('enters editing mode directly when clicking empty placeholder in non-readonly mode', () => {
    render(<LongTextField value="" config={dummyConfig} onSave={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Click to expand'))
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('switches to textarea when clicking the expanded view in non-readonly mode and saves on blur', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Initial content" config={dummyConfig} onSave={onSave} />)

    // First click: expand in-place
    const collapsed = screen.getByTitle('Click to expand')
    fireEvent.click(collapsed)

    // Second click: click expanded view to edit
    const expandedView = screen.getByTitle('Click to edit')
    fireEvent.click(expandedView)

    // Textarea should now be rendered
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.value).toBe('Initial content')

    // Change value and blur
    fireEvent.change(textarea, { target: { value: 'Updated content' } })
    fireEvent.blur(textarea)

    expect(onSave).toHaveBeenCalledWith('Updated content')
  })

  it('preserves the expanded box height when entering edit mode', () => {
    render(<LongTextField value="Multi-line content" config={dummyConfig} onSave={vi.fn()} />)

    // Expand
    fireEvent.click(screen.getByTitle('Click to expand'))
    const expandedView = screen.getByTestId('long-text-expanded-overlay')

    // Mock offsetHeight of expanded view to 150px
    Object.defineProperty(expandedView, 'offsetHeight', { value: 150, configurable: true })

    // Click to enter edit mode
    fireEvent.click(expandedView)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.style.height).toBe('150px')
    expect(textarea.style.minHeight).toBe('150px')
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

  it('closes expanded overlay on Escape key', () => {
    render(<LongTextField value="Line 1\nLine 2" config={dummyConfig} onSave={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Click to expand'))
    expect(screen.getByTestId('long-text-expanded-overlay')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('long-text-expanded-overlay')).toBeNull()
  })

  it('does not allow editing in readOnly mode', () => {
    const onSave = vi.fn()
    render(<LongTextField value="Readonly text" config={dummyConfig} onSave={onSave} readOnly />)

    const collapsed = screen.getByTitle('Click to expand')
    fireEvent.click(collapsed)

    // Expanded view is present, but should not have 'Click to edit' title
    expect(screen.queryByTitle('Click to edit')).toBeNull()
    const expandedView = screen.getByTestId('long-text-expanded-overlay')
    expect(expandedView).toBeTruthy()
    expect(expandedView.textContent).toContain('Readonly text')

    // Clicking the expanded text should not switch to textarea
    fireEvent.click(expandedView)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
