import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/ui/stores/auth'
import { Route } from './consent'

describe('Consent Route beforeLoad guard', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
  })

  it('redirects to /login when user is not authenticated', () => {
    const beforeLoad = Route.options.beforeLoad
    expect(beforeLoad).toBeDefined()
    expect(() => {
      beforeLoad!({
        search: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: 'client-1',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack router internal BeforeLoadContextOptions in test
      } as any)
    }).toThrow()
  })

  it('allows access when user is authenticated in store', () => {
    useAuthStore.getState().setUser({ id: 'user-1', email: 'test@example.com' })

    const beforeLoad = Route.options.beforeLoad
    expect(beforeLoad).toBeDefined()
    expect(() => {
      beforeLoad!({
        search: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: 'client-1',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack router internal BeforeLoadContextOptions in test
      } as any)
    }).not.toThrow()
  })
})
