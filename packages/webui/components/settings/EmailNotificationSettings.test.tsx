// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmailNotificationSettings } from './EmailNotificationSettings'
import type { EmailNotificationSettings as Settings } from '@shumai/dtos'
import { toast } from 'sonner'

const mockGetSettings = vi.fn()
const mockPutSettings = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          notifications: {
            email: {
              $get: () => mockGetSettings(),
              $put: (args: unknown) => mockPutSettings(args),
            },
          },
        },
      },
    },
  },
}))

vi.mock('./TestEmailDialog', () => ({
  TestEmailDialog: ({
    isOpen,
    defaultFrom,
  }: {
    isOpen: boolean
    onClose: () => void
    teamId: string
    defaultFrom?: string
  }) =>
    isOpen ? (
      <div data-testid="mock-test-email-dialog" data-from={defaultFrom}>
        Test Email Dialog Content
      </div>
    ) : null,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('EmailNotificationSettings', () => {
  const initialSettings: Settings = {
    enabled: false,
    host: 'smtp.example.com',
    port: 587,
    username: 'smtpuser',
    password: '••••••••',
    smtps: false,
    ignoreCert: false,
    from: 'Shumai <noreply@example.com>',
    replyTo: 'support@example.com',
    uploadDebounceSeconds: 300,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({
      ok: true,
      json: async () => initialSettings,
    })
    mockPutSettings.mockResolvedValue({
      ok: true,
      json: async () => ({ ...initialSettings, enabled: true }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  function renderComponent() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <EmailNotificationSettings teamId="team-1" />
      </QueryClientProvider>,
    )
  }

  it('renders initial settings properly', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/enable email notifications/i)).toBeDefined()
    })

    expect(screen.getByText(/smtp server settings/i)).toBeDefined()
    expect(screen.getByText(/sender information/i)).toBeDefined()

    // Host input should have the value from initial settings
    const hostInput = screen.getByLabelText(/smtp host/i) as HTMLInputElement
    expect(hostInput.value).toBe('smtp.example.com')
    expect(hostInput.disabled).toBe(true) // Disabled because enabled is false

    // Buttons
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /save & send test email/i })).toBeDefined()
  })

  it('enables form inputs when enable switch is toggled', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByLabelText(/smtp host/i)).toBeDefined()
    })

    const hostInput = screen.getByLabelText(/smtp host/i) as HTMLInputElement
    expect(hostInput.disabled).toBe(true)

    // Toggle the enable switch
    const enableSwitch = screen.getByRole('switch', { name: /enable email notifications/i })
    fireEvent.click(enableSwitch)

    await waitFor(() => {
      expect(hostInput.disabled).toBe(false)
    })
  })

  it('saves settings successfully when Save button is clicked', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByLabelText(/smtp host/i)).toBeDefined()
    })

    // Enable first
    const enableSwitch = screen.getByRole('switch', { name: /enable email notifications/i })
    fireEvent.click(enableSwitch)

    // Edit host
    const hostInput = screen.getByLabelText(/smtp host/i)
    fireEvent.change(hostInput, { target: { value: 'mail.mycompany.com' } })

    // Click Save
    const saveButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockPutSettings).toHaveBeenCalledWith({
        param: { teamId: 'team-1' },
        json: expect.objectContaining({
          enabled: true,
          host: 'mail.mycompany.com',
          port: 587,
        }),
      })
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('shows error toast when save fails', async () => {
    mockPutSettings.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid SMTP configuration' }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByLabelText(/smtp host/i)).toBeDefined()
    })

    const saveButton = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid SMTP configuration')
    })
  })

  it('saves settings first and opens TestEmailDialog on "Save & Send Test Email"', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByLabelText(/smtp host/i)).toBeDefined()
    })

    // Enable switch so button is active
    const enableSwitch = screen.getByRole('switch', { name: /enable email notifications/i })
    fireEvent.click(enableSwitch)

    const saveAndTestButton = screen.getByRole('button', { name: /save & send test email/i })
    fireEvent.click(saveAndTestButton)

    // Should call save first
    await waitFor(() => {
      expect(mockPutSettings).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
    })

    // Mock dialog should be opened with defaultFrom
    await waitFor(() => {
      const dialog = screen.getByTestId('mock-test-email-dialog')
      expect(dialog).toBeDefined()
      expect(dialog.getAttribute('data-from')).toBe('Shumai <noreply@example.com>')
    })
  })

  it('validates required host when clicking "Save & Send Test Email"', async () => {
    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...initialSettings, host: '' }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByLabelText(/smtp host/i)).toBeDefined()
    })

    const enableSwitch = screen.getByRole('switch', { name: /enable email notifications/i })
    fireEvent.click(enableSwitch)

    const saveAndTestButton = screen.getByRole('button', { name: /save & send test email/i })
    fireEvent.click(saveAndTestButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/host is required/i))
      expect(mockPutSettings).not.toHaveBeenCalled()
    })
  })
})
