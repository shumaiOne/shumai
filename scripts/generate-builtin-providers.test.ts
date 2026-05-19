import { describe, it, expect } from 'vitest'
import { sortProviders, PRIORITY_PROVIDERS } from './generate-builtin-providers'

describe('generate-builtin-providers sorting', () => {
  it('should sort priority providers in correct order', () => {
    const entries: [string, unknown][] = [
      ['anthropic', {}],
      ['openai', {}],
      ['google', {}],
    ]
    const sorted = sortProviders([...entries])
    expect(sorted[0][0]).toBe('openai')
    expect(sorted[1][0]).toBe('anthropic')
    expect(sorted[2][0]).toBe('google')
  })

  it('should place priority providers before non-priority ones', () => {
    const entries: [string, unknown][] = [
      ['unknown-provider', {}],
      ['openai', {}],
      ['anthropic', {}],
    ]
    const sorted = sortProviders([...entries])
    expect(sorted[0][0]).toBe('openai')
    expect(sorted[1][0]).toBe('anthropic')
    expect(sorted[2][0]).toBe('unknown-provider')
  })

  it('should sort non-priority providers alphabetically', () => {
    const entries: [string, unknown][] = [
      ['zebra', {}],
      ['alpha', {}],
      ['betty', {}],
    ]
    const sorted = sortProviders([...entries])
    expect(sorted[0][0]).toBe('alpha')
    expect(sorted[1][0]).toBe('betty')
    expect(sorted[2][0]).toBe('zebra')
  })

  it('should handle complex mixed lists correctly', () => {
    const entries: [string, unknown][] = [
      ['zai', {}],
      ['mistral', {}],
      ['openai', {}],
      ['alpha', {}],
      ['google', {}],
    ]
    const sorted = sortProviders([...entries])
    // Expected order: openai (0), google (2), mistral (6), alpha (alpha < zai), zai
    expect(sorted[0][0]).toBe('openai')
    expect(sorted[1][0]).toBe('google')
    expect(sorted[2][0]).toBe('mistral')
    expect(sorted[3][0]).toBe('alpha')
    expect(sorted[4][0]).toBe('zai')
  })

  it('should cover all priority providers in the correct order', () => {
    const entries: [string, unknown][] = PRIORITY_PROVIDERS.map((p) => [p, {}])
    // Shuffle the list
    const shuffled = [...entries].sort(() => Math.random() - 0.5)
    const sorted = sortProviders(shuffled)

    for (let i = 0; i < PRIORITY_PROVIDERS.length; i++) {
      expect(sorted[i][0]).toBe(PRIORITY_PROVIDERS[i])
    }
  })
})
