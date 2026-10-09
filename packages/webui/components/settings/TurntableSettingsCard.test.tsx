// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TurntableSettingsCard } from './TurntableSettingsCard'
import type { TurntableSettingsResponse } from '@shumai/dtos'

const mockGetSettings = vi.fn()
const mockPutSettings = vi.fn()
const mockTestSettings = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          'turntable-settings': {
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
    turntable_settings: () => 'Turntable Renderer Settings',
    turntable_settings_description: () => 'Configure external Blender turntable renderer',
    turntable_env_configured: () => 'Configured via Environment',
    turntable_server_url: () => 'Server URL',
    turntable_server_url_placeholder: () => 'http://localhost:3000',
    turntable_username: () => 'Username',
    turntable_password: () => 'Password',
    turntable_password_placeholder: () => 'Saved password',
    turntable_test_connection: () => 'Test Connection',
    turntable_testing: () => 'Testing...',
    turntable_connection_success: () => 'Connection successful',
    turntable_connection_failed: () => 'Connection failed',
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

describe('TurntableSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loaded settings with URL and username', async () => {
    const settings: TurntableSettingsResponse = {
      isEnvConfigured: false,
      url: 'http://turntable.local:3000',
      username: 'render-user',
      hasPassword: true,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    render(<TurntableSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://turntable.local:3000')).toBeDefined()
      expect(screen.getByDisplayValue('render-user')).toBeDefined()
    })
  })

  it('disables inputs and displays badge when configured via environment', async () => {
    const settings: TurntableSettingsResponse = {
      isEnvConfigured: true,
      url: 'http://env-turntable:3000',
      username: 'env-user',
      hasPassword: true,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    render(<TurntableSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Configured via Environment')).toBeDefined()
      const urlInput = screen.getByDisplayValue('http://env-turntable:3000') as HTMLInputElement
      expect(urlInput.disabled).toBe(true)
      const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
      expect(saveBtn.disabled).toBe(true)
    })
  })

  it('saves updated settings', async () => {
    const settings: TurntableSettingsResponse = {
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
        ...settings,
        url: 'http://new-turntable:3000',
        username: 'alice',
      }),
    })

    render(<TurntableSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('Server URL')).toBeDefined()
    })

    const urlInput = screen.getByLabelText('Server URL')
    fireEvent.change(urlInput, { target: { value: 'http://new-turntable:3000' } })

    const usernameInput = screen.getByLabelText('Username')
    fireEvent.change(usernameInput, { target: { value: 'alice' } })

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockPutSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { teamId: 'team-123' },
          json: expect.objectContaining({
            url: 'http://new-turntable:3000',
            username: 'alice',
          }),
        }),
      )
    })
  })

  it('tests connection successfully and displays version info', async () => {
    const settings: TurntableSettingsResponse = {
      isEnvConfigured: false,
      url: 'http://turntable:3000',
      username: 'user',
      hasPassword: false,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    mockTestSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        version: '1.0.0',
        blender: '5.2.0',
      }),
    })

    render(<TurntableSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://turntable:3000')).toBeDefined()
    })

    const testBtn = screen.getByRole('button', { name: 'Test Connection' })
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(mockTestSettings).toHaveBeenCalled()
      expect(screen.getByText(/Connection successful \(v1\.0\.0, Blender 5\.2\.0\)/)).toBeDefined()
    })
  })

  it('tests connection and displays error when unreachable', async () => {
    const settings: TurntableSettingsResponse = {
      isEnvConfigured: false,
      url: 'http://invalid-url:3000',
      username: '',
      hasPassword: false,
    }

    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    })

    mockTestSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: false,
        error: 'ECONNREFUSED',
      }),
    })

    render(<TurntableSettingsCard teamId="team-123" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://invalid-url:3000')).toBeDefined()
    })

    const testBtn = screen.getByRole('button', { name: 'Test Connection' })
    fireEvent.click(testBtn)

    await waitFor(() => {
      expect(screen.getByText(/Connection failed: ECONNREFUSED/)).toBeDefined()
    })
  })
})
