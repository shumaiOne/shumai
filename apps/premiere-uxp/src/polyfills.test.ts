// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import './polyfills'

describe('polyfills custom element patches', () => {
  it('patches sp-search connectedCallback to inject shadow styles and click-to-focus listener', () => {
    class MockSpSearch extends HTMLElement {
      connectedCallback() {}
    }

    const mockFocus = vi.fn()

    window.customElements.define('sp-search', MockSpSearch)

    const el = document.createElement('sp-search') as HTMLElement & { focus: () => void }
    el.attachShadow({ mode: 'open' })
    el.focus = mockFocus

    document.body.appendChild(el)

    // Verify shadow style injection
    const styleEl = el.shadowRoot?.querySelector('style[data-shumai-search-fix]')
    expect(styleEl).toBeTruthy()
    expect(styleEl?.textContent).toContain('#textfield')
    expect(styleEl?.textContent).toContain('.input')

    // Verify click event triggers focus
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockFocus).toHaveBeenCalled()

    document.body.removeChild(el)
  })
})
