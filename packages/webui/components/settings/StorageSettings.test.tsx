// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StorageSettings } from './StorageSettings'
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

describe('StorageSettings', () => {
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
        archiveStorage: {
          enabled: true,
          backend: 's3',
          bucket: 'my-archive-bucket',
          endpoint: 'https://s3.custom.com',
        },
        autoArchive: {
          enabled: false,
          method: 'not_updated',
          days: 30,
          postRestoreGraceDays: 30,
        },
      }),
    })
    mockPatchSettings.mockResolvedValue({
      ok: true,
      json: async () => ({
        autoArchive: {
          enabled: true,
          method: 'not_updated',
          days: 30,
          postRestoreGraceDays: 30,
        },
      }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StorageSettings teamId="team-storage-123" />
      </QueryClientProvider>,
    )

  it('renders archive storage details for S3 backend when configured', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('my-archive-bucket')).toBeDefined()
      expect(screen.getByText('https://s3.custom.com')).toBeDefined()
    })
  })

  it('renders archive storage details for local backend', async () => {
    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        archiveStorage: {
          enabled: true,
          backend: 'local',
          localRoot: '/var/data/archive',
        },
        autoArchive: {
          enabled: false,
          method: 'not_updated',
          days: 30,
          postRestoreGraceDays: 30,
        },
      }),
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('/var/data/archive')).toBeDefined()
    })
  })

  it('renders warning alert and disables auto-archive form when archive storage is not configured', async () => {
    mockGetSettings.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        archiveStorage: {
          enabled: false,
        },
        autoArchive: {
          enabled: false,
          method: 'not_updated',
          days: 30,
          postRestoreGraceDays: 30,
        },
      }),
    })

    renderComponent()

    await waitFor(() => {
      const switchElement = screen.getByRole('switch')
      expect(switchElement.hasAttribute('disabled')).toBe(true)
    })
  })

  it('submits updated auto-archive configuration when Save is clicked', async () => {
    renderComponent()

    const switchElement = await screen.findByRole('switch')
    expect(switchElement.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(switchElement)

    const daysInput = await screen.findByLabelText(/Age Threshold/i)
    fireEvent.change(daysInput, { target: { value: '60' } })

    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockPatchSettings).toHaveBeenCalledWith({
        param: { teamId: 'team-storage-123' },
        json: {
          key: 'autoArchive',
          value: {
            enabled: true,
            method: 'not_updated',
            days: 60,
            postRestoreGraceDays: 30,
          },
        },
      })
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('handles error when saving auto-archive configuration fails', async () => {
    mockPatchSettings.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Cannot save settings' }),
    })

    renderComponent()

    const saveButton = await screen.findByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cannot save settings')
    })
  })
})
