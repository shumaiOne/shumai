// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './login'
import { useAuthStore } from '@/ui/stores/auth'

const mockNavigate = vi.fn()
const mockSignInEmail = vi.fn()
const mockGetSignupInfo = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  redirect: vi.fn(),
}))

vi.mock('@/ui/lib/auth-client', () => ({
  signIn: {
    email: (...args: unknown[]) => mockSignInEmail(...args),
  },
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      'signup-info': {
        $get: () => mockGetSignupInfo(),
      },
    },
  },
}))

describe('LoginPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().clearAuth()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  function renderLoginPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <LoginPage />
      </QueryClientProvider>,
    )
  }

  it('renders standard login form when not in demo mode', async () => {
    mockGetSignupInfo.mockResolvedValue({
      ok: true,
      json: async () => ({
        initialized: true,
        demoMode: false,
      }),
    })

    renderLoginPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login/i })).toBeDefined()
    })

    // Should not show demo banner or demo login button
    expect(screen.queryByText(/demo access/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /login as demo user/i })).toBeNull()
  })

  it('renders demo access banner and Login as demo user button in demo mode', async () => {
    mockGetSignupInfo.mockResolvedValue({
      ok: true,
      json: async () => ({
        initialized: true,
        demoMode: true,
      }),
    })

    renderLoginPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login as demo user/i })).toBeDefined()
    })

    // Banner indicates read-only Reviewer role
    expect(screen.getByText(/demo access:/i)).toBeDefined()
    expect(screen.getByText(/reviewer/i)).toBeDefined()
    // Should NOT contain username or password instructions in the banner
    expect(screen.queryByText(/foo@bar\.com/i)).toBeNull()
  })

  it('logs in as demo user when Login as demo user button is clicked', async () => {
    mockGetSignupInfo.mockResolvedValue({
      ok: true,
      json: async () => ({
        initialized: true,
        demoMode: true,
      }),
    })

    mockSignInEmail.mockResolvedValue({
      data: {
        session: { id: 'sess-1' },
        user: { id: 'u-demo', email: 'foo@bar.com', name: 'Demo User' },
      },
      error: null,
    })

    renderLoginPage()

    const demoButton = await screen.findByRole('button', { name: /login as demo user/i })
    fireEvent.click(demoButton)

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: 'foo@bar.com',
        password: 'foo',
      })
    })

    await waitFor(() => {
      expect(useAuthStore.getState().user).toEqual({
        id: 'u-demo',
        email: 'foo@bar.com',
        name: 'Demo User',
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('shows error when demo login fails', async () => {
    mockGetSignupInfo.mockResolvedValue({
      ok: true,
      json: async () => ({
        initialized: true,
        demoMode: true,
      }),
    })

    mockSignInEmail.mockResolvedValue({
      data: null,
      error: { message: 'Demo account unavailable' },
    })

    renderLoginPage()

    const demoButton = await screen.findByRole('button', { name: /login as demo user/i })
    fireEvent.click(demoButton)

    await waitFor(() => {
      expect(screen.getByText('Demo account unavailable')).toBeDefined()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
