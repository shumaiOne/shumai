import { describe, expect, it } from 'vitest'
import { getBuiltinProvidersMap, PRIORITY_PROVIDERS, ENV_MAP } from './builtin'

describe('Builtin Providers', () => {
  it('should return a non-empty record of providers', () => {
    const providers = getBuiltinProvidersMap()
    expect(Object.keys(providers).length).toBeGreaterThan(0)
  })

  it('should place priority providers first in the map', () => {
    const providers = getBuiltinProvidersMap()
    const keys = Object.keys(providers)

    expect(keys[0]).toBe(PRIORITY_PROVIDERS[0])
    expect(keys[1]).toBe(PRIORITY_PROVIDERS[1])
  })

  it('should format openai provider correctly with env key', () => {
    const providers = getBuiltinProvidersMap()
    const openai = providers.openai

    expect(openai).toBeDefined()
    expect(openai.name).toBe('openai')
    expect(openai.config.apiKey).toBe(ENV_MAP.openai)
    expect(openai.models.length).toBeGreaterThan(0)
  })
})
