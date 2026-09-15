import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredCredentials, saveStoredCredentials, clearStoredCredentials } from './storage'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
})

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
