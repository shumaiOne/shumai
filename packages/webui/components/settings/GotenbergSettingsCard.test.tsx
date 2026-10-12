// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GotenbergSettingsCard } from './GotenbergSettingsCard'
import type { GotenbergSettingsResponse } from '@shumai/dtos'

const mockGetSettings = vi.fn()
const mockPutSettings = vi.fn()
const mockTestSettings = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          'gotenberg-settings': {
            $get: () => mockGetSettings(),
            $put: (args: unknown) => mockPutSettings(args),
            test: {
              $post: (args: unknown) => mockTestSettings(args),
            },
          },
        },
      },
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/ui/paraglide/messages.js', () => ({
  m: {
    gotenberg_settings: () => 'Gotenberg Document Converter',
    gotenberg_settings_description: () => 'Configure external Gotenberg service',
    gotenberg_env_configured: () => 'Configured via Environment',
    gotenberg_server_url: () => 'Server URL',
    gotenberg_server_url_placeholder: () => 'http://localhost:3000',
    gotenberg_username: () => 'Username',
    gotenberg_password: () => 'Password',
    gotenberg_password_placeholder: () => 'Saved password',
    gotenberg_test_connection: () => 'Test Connection',
    gotenberg_testing: () => 'Testing...',
    gotenberg_connection_success: () => 'Connection successful',
    gotenberg_connection_failed: () => 'Connection failed',
    save: () => 'Save',
    settings_updated: () => 'Settings updated',
    failed_update_settings: () => 'Failed to update settings',
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('GotenbergSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loaded settings with URL and username', async () => {
    const settings: GotenbergSettingsResponse = {
      isEnvConfigured: false,
      url: 'http://gotenberg.local:3000',
      username: 'gotenberg-user',
      hasPassword: true,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    render(<GotenbergSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://gotenberg.local:3000')).toBeDefined()
      expect(screen.getByDisplayValue('gotenberg-user')).toBeDefined()
    })
  })

  it('disables inputs and displays badge when configured via environment', async () => {
    const settings: GotenbergSettingsResponse = {
      isEnvConfigured: true,
      url: 'http://env-gotenberg:3000',
      username: 'env-user',
      hasPassword: true,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    render(<GotenbergSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Configured via Environment')).toBeDefined()
      const urlInput = screen.getByDisplayValue('http://env-gotenberg:3000') as HTMLInputElement
      expect(urlInput.disabled).toBe(true)
      const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
      expect(saveBtn.disabled).toBe(true)
    })
  })

  it('saves updated settings', async () => {
    const settings: GotenbergSettingsResponse = {
      isEnvConfigured: false,
      url: '',
      username: '',
      hasPassword: false,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    mockPutSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        isEnvConfigured: false,
        url: 'http://custom:3000',
        username: 'user1',
        hasPassword: true,
      }),
    })

    render(<GotenbergSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('Server URL')).toBeDefined()
    })

    const urlInput = screen.getByLabelText('Server URL')
    const usernameInput = screen.getByLabelText('Username')
    const passwordInput = document.getElementById('gotenberg-password') as HTMLInputElement

    fireEvent.change(urlInput, { target: { value: 'http://custom:3000' } })
    fireEvent.change(usernameInput, { target: { value: 'user1' } })
    fireEvent.change(passwordInput, { target: { value: 'newpass' } })

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockPutSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { teamId: 'team-123' },
          json: {
            url: 'http://custom:3000',
            username: 'user1',
            password: 'newpass',
          },
        }),
      )
    })
  })

  it('handles test connection with success result', async () => {
    const settings: GotenbergSettingsResponse = {
      isEnvConfigured: false,
      url: 'http://test-gotenberg:3000',
      username: 'user',
      hasPassword: false,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    mockTestSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, version: '8.3.0' }),
    })

    render(<GotenbergSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://test-gotenberg:3000')).toBeDefined()
    })

    const testBtn = screen.getByRole('button', { name: 'Test Connection' })
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(screen.getByText(/Connection successful/)).toBeDefined()
      expect(screen.getByText(/\(v8\.3\.0\)/)).toBeDefined()
    })
  })
})
