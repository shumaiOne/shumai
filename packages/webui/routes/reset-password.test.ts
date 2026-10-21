import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/ui/stores/auth'
import { Route } from './reset-password'

describe('Reset Password Route beforeLoad guard', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
  })

  it('redirects to / when user is authenticated in store and no reset token is present', () => {
    useAuthStore.getState().setUser({ id: 'user-1', email: 'test@example.com' })

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Route.options.beforeLoad?.({ search: { token: '' } } as any)
    }).toThrow()
  })

  it('does NOT redirect and clears stale auth when a reset token is present in search params', () => {
    useAuthStore.getState().setUser({ id: 'user-1', email: 'test@example.com' })

    // When the user has stale auth in localStorage but provides a token,
    // they should NOT be redirected to / (which would 401 and redirect to login)
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Route.options.beforeLoad?.({ search: { token: 'valid-token-123' } } as any)
    }).not.toThrow()

    // And the stale auth store should be cleared
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('does not redirect when user is not logged in and no token is present', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Route.options.beforeLoad?.({ search: { token: '' } } as any)
    }).not.toThrow()
  })
})
