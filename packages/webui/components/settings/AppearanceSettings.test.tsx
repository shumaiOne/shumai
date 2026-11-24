// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppearanceSettings } from './AppearanceSettings'
import { useUserMetadataStore } from '@/ui/stores/user-metadata'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { toast } from 'sonner'

const mockGetSettings = vi.fn()
const mockPatchSettings = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          settings: {
            $get: () => mockGetSettings(),
            $patch: (args: unknown) => mockPatchSettings(args),
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

describe('AppearanceSettings', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    mockGetSettings.mockResolvedValue({
      ok: true,
      json: async () => ({
        appearance: { hideAgent: false },
      }),
    })
    mockPatchSettings.mockResolvedValue({
      ok: true,
      json: async () => ({
        appearance: { hideAgent: true },
      }),
    })
    vi.spyOn(useUserMetadataStore.getState(), 'fetchMetadata').mockResolvedValue()
    useChatbotStore.setState({ isChatbotOpen: true })
  })

  afterEach(() => {
    cleanup()
  })

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AppearanceSettings teamId="team-123" />
      </QueryClientProvider>,
    )

  it('renders switch with initial unchecked state when hideAgent is false', async () => {
    renderComponent()

    await waitFor(() => {
      const switchElement = screen.getAllByRole('switch')[0]
      expect(switchElement).toBeDefined()
      expect(switchElement.getAttribute('data-state')).toBe('unchecked')
    })
  })

  it('renders switch checked when hideAgent is true', async () => {
    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appearance: { hideAgent: true },
      }),
    })

    renderComponent()

    await waitFor(() => {
      const switchElement = screen.getAllByRole('switch')[0]
      expect(switchElement).toBeDefined()
      expect(switchElement.getAttribute('data-state')).toBe('checked')
    })
  })

  it('updates settings, closes chatbot, and refreshes user metadata on toggle', async () => {
    renderComponent()

    const switchElement = (await screen.findAllByRole('switch'))[0]
    fireEvent.click(switchElement)

    await waitFor(() => {
      expect(mockPatchSettings).toHaveBeenCalledWith({
        param: { teamId: 'team-123' },
        json: {
          key: 'appearance.hideAgent',
          value: true,
        },
      })
      expect(useUserMetadataStore.getState().fetchMetadata).toHaveBeenCalledWith('team-123')
      expect(useChatbotStore.getState().isChatbotOpen).toBe(false)
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('turns on hiding internal comments on share links', async () => {
    renderComponent()

    const shareSwitch = (await screen.findAllByRole('switch'))[1]
    expect(shareSwitch.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(shareSwitch)

    await waitFor(() => {
      expect(mockPatchSettings).toHaveBeenCalledWith({
        param: { teamId: 'team-123' },
        json: { key: 'share.hideInternalComments', value: true },
      })
    })
  })

  it('sets the default expiry for new share links', async () => {
    renderComponent()

    const select = (await screen.findByLabelText(/default expiry/i)) as HTMLSelectElement
    fireEvent.change(select, { target: { value: '7' } })

    await waitFor(() => {
      expect(mockPatchSettings).toHaveBeenCalledWith({
        param: { teamId: 'team-123' },
        json: { key: 'share.defaultExpiryDays', value: 7 },
      })
    })
  })

  it('shows error toast when patch fails', async () => {
    mockPatchSettings.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Forbidden' }),
    })

    renderComponent()

    const switchElement = (await screen.findAllByRole('switch'))[0]
    fireEvent.click(switchElement)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })
})
