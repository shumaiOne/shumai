// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import './polyfills'

describe('polyfills custom element patches', () => {
  it('patches sp-search lifecycle to apply full-width styles and click-to-focus listener', () => {
    class MockSpSearch extends HTMLElement {
      connectedCallback() {}
      firstUpdated?(): void
      updated?(): void
    }

    window.customElements.define('sp-search', MockSpSearch)

    const el = document.createElement('sp-search') as unknown as HTMLElement & {
      firstUpdated?: (changedProperties?: unknown) => void
      updated?: (changedProperties?: unknown) => void
    }
    const shadow = el.attachShadow({ mode: 'open' })

    const textfield = document.createElement('div')
    textfield.id = 'textfield'
    const form = document.createElement('form')
    form.id = 'form'
    const input = document.createElement('input')
    input.className = 'input'
    const mockFocus = vi.fn()
    input.focus = mockFocus

    form.appendChild(input)
    textfield.appendChild(form)
    shadow.appendChild(textfield)

    document.body.appendChild(el)

    // Test firstUpdated hook
    el.firstUpdated?.()
    expect(form.style.width).toBe('100%')
    expect(form.style.display).toBe('flex')
    expect(input.style.width).toBe('100%')
    expect(input.style.flex).toContain('1')

    // Verify click event triggers focus on input
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockFocus).toHaveBeenCalled()

    document.body.removeChild(el)
  })
})
