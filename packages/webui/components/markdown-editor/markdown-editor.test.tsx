// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MarkdownEditor } from './markdown-editor'

describe('MarkdownEditor', () => {
  it('renders toolbar buttons and content editable area', () => {
    render(<MarkdownEditor placeholder="Type here..." initialContent="# Hello World" />)

    expect(screen.getByRole('textbox')).toBeDefined()
    expect(screen.getByRole('button', { name: /bold/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /italic/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined()
  })

  it('renders in readOnly mode without toolbar', () => {
    const { container } = render(<MarkdownEditor readOnly initialContent="Read only text" />)

    expect(container.querySelector('.shumai-editor-toolbar')).toBeNull()
    expect(container.querySelector('.read-only')).toBeDefined()
  })
})
