// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import './polyfills'

describe('polyfills', () => {
  it('defines window.matchMedia polyfill when missing', () => {
    expect(typeof window.matchMedia).toBe('function')
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    expect(mql).toBeDefined()
    expect(mql.matches).toBe(false)
  })
})
