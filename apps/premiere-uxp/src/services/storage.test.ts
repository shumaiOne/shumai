// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredCredentials, saveStoredCredentials, clearStoredCredentials } from './storage'

describe('Storage Service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no credentials are stored', () => {
    expect(getStoredCredentials()).toBeNull()
  })

  it('saves and retrieves credentials correctly', () => {
    saveStoredCredentials('http://localhost:3000', 'test-api-key')
    const creds = getStoredCredentials()
    expect(creds).toEqual({
      endpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
    })
  })

  it('normalizes endpoint URL by stripping trailing slashes', () => {
    saveStoredCredentials('https://api.shumai.io///', 'test-api-key')
    const creds = getStoredCredentials()
    expect(creds?.endpoint).toBe('https://api.shumai.io')
  })

  it('clears stored credentials', () => {
    saveStoredCredentials('http://localhost:3000', 'test-api-key')
    clearStoredCredentials()
    expect(getStoredCredentials()).toBeNull()
  })
})
