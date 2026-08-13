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
})
