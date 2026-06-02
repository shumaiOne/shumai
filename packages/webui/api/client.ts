import { hc } from 'hono/client'
import type { AppType } from '@shumai/api'
import { useAuthStore } from '@/ui/stores/auth'

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, init)

  if (response.status === 401) {
    const url = input.toString()
    // Don't redirect if we are already on login page, it's an auth request, or we are on a public share page
    if (
      !window.location.pathname.includes('/login') &&
      !window.location.pathname.startsWith('/share/') &&
      !url.includes('/api/authn')
    ) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
  }

  return response
}

export const client = hc<AppType>('/', {
  fetch: customFetch,
  init: {
    credentials: 'include',
  },
})
