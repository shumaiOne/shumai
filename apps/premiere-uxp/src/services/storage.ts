export interface StoredCredentials {
  endpoint: string
  apiKey: string
}

const STORAGE_KEY_ENDPOINT = 'shumai_uxp_endpoint'
const STORAGE_KEY_API_KEY = 'shumai_uxp_api_key'

export function getStoredCredentials(): StoredCredentials | null {
  try {
    const endpoint = localStorage.getItem(STORAGE_KEY_ENDPOINT)
    const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY)
    if (endpoint && apiKey) {
      return { endpoint, apiKey }
    }
  } catch (err) {
    console.error('Failed to read credentials from localStorage:', err)
  }
  return null
}

export function saveStoredCredentials(endpoint: string, apiKey: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ENDPOINT, endpoint.trim().replace(/\/+$/, ''))
    localStorage.setItem(STORAGE_KEY_API_KEY, apiKey.trim())
  } catch (err) {
    console.error('Failed to save credentials to localStorage:', err)
  }
}

export function clearStoredCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ENDPOINT)
    localStorage.removeItem(STORAGE_KEY_API_KEY)
  } catch (err) {
    console.error('Failed to clear credentials from localStorage:', err)
  }
}
