// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TestEmailDialog } from './TestEmailDialog'
import { toast } from 'sonner'

const mockPostTestEmail = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          notifications: {
            email: {
              test: {
                $post: (args: unknown) => mockPostTestEmail(args),
              },
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

describe('TestEmailDialog', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockPostTestEmail.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, messageId: '<msg-123@example.com>' }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  function renderDialog(props?: Partial<React.ComponentProps<typeof TestEmailDialog>>) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <TestEmailDialog
          isOpen={true}
          onClose={mockOnClose}
          teamId="team-1"
          defaultFrom="Shumai <noreply@example.com>"
          {...props}
        />
      </QueryClientProvider>,
    )
  }

  it('renders dialog title, description and pre-filled from address', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: /send test email/i })).toBeDefined()
    expect(
      screen.getByText(
        /Sender email address, for example: "Shumai <noreply@example\.com>"\. Make sure to use an address you're allowed to send emails from\./i,
      ),
    ).toBeDefined()

    const input = screen.getByLabelText(/from address/i) as HTMLInputElement
    expect(input.value).toBe('Shumai <noreply@example.com>')
  })

  it('validates from address when empty', async () => {
    renderDialog({ defaultFrom: '' })

    const sendBtn = screen.getByRole('button', { name: /send test email/i })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/from address is required/i))
      expect(mockPostTestEmail).not.toHaveBeenCalled()
    })
  })

  it('sends test email successfully and calls onClose', async () => {
    renderDialog()

    const input = screen.getByLabelText(/from address/i)
    fireEvent.change(input, { target: { value: 'Admin <admin@test.com>' } })

    const sendBtn = screen.getByRole('button', { name: /send test email/i })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(mockPostTestEmail).toHaveBeenCalledWith({
        param: { teamId: 'team-1' },
        json: { from: 'Admin <admin@test.com>' },
      })
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/test email sent/i))
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('handles send test email API error', async () => {
    mockPostTestEmail.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'SMTP verification failed: Connection refused' }),
    })

    renderDialog()

    const sendBtn = screen.getByRole('button', { name: /send test email/i })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('SMTP verification failed: Connection refused')
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  it('calls onClose when Cancel button is clicked', () => {
    renderDialog()

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)

    expect(mockOnClose).toHaveBeenCalled()
  })
})
