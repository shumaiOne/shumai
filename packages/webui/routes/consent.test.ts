import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as authClientModule from '@/ui/lib/auth-client'
import { useAuthStore } from '@/ui/stores/auth'
import { Route } from './consent'

describe('Consent Route beforeLoad guard', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to /login when user is not authenticated in store or server session', async () => {
    vi.spyOn(authClientModule, 'getAuthSession').mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClientModule.getAuthSession>>)
    const beforeLoad = Route.options.beforeLoad
    expect(beforeLoad).toBeDefined()
    await expect(
      beforeLoad!({
        search: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: 'client-1',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack router internal BeforeLoadContextOptions in test
      } as any),
    ).rejects.toThrow()
  })

  it('populates user in auth store and allows access when server session exists', async () => {
    vi.spyOn(authClientModule, 'getAuthSession').mockResolvedValue({
      data: {
        user: { id: 'user-oauth', email: 'oauth@example.com' },
        session: { id: 'session-1' },
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClientModule.getAuthSession>>)

    const beforeLoad = Route.options.beforeLoad
    expect(beforeLoad).toBeDefined()
    await expect(
      beforeLoad!({
        search: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: 'client-1',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack router internal BeforeLoadContextOptions in test
      } as any),
    ).resolves.not.toThrow()

    expect(useAuthStore.getState().user).toEqual({ id: 'user-oauth', email: 'oauth@example.com' })
  })

  it('allows access when user is already authenticated in store without calling getSession', async () => {
    useAuthStore.getState().setUser({ id: 'user-1', email: 'test@example.com' })
    const getSessionSpy = vi.spyOn(authClientModule, 'getAuthSession')

    const beforeLoad = Route.options.beforeLoad
    expect(beforeLoad).toBeDefined()
    await expect(
      beforeLoad!({
        search: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: 'client-1',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack router internal BeforeLoadContextOptions in test
      } as any),
    ).resolves.not.toThrow()

    expect(getSessionSpy).not.toHaveBeenCalled()
  })
})
