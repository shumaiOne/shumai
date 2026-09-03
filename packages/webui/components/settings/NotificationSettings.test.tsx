// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationSettings } from './NotificationSettings'
import type { NotificationSettings as Settings } from '@shumai/dtos'

const mockGetSettings = vi.fn()
const mockPostSettings = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          notifications: {
            settings: {
              $get: () => mockGetSettings(),
              $post: (args: unknown) => mockPostSettings(args),
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

describe('NotificationSettings', () => {
  const initialSettings: Settings = {
    comments: true,
    replies: true,
    mentions: true,
    yourUploads: false,
    otherUploads: true,
    statusUpdates: true,
    kanbanTasks: true,
    kanbanComments: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({
      ok: true,
      json: async () => initialSettings,
    })
    mockPostSettings.mockResolvedValue({
      ok: true,
      json: async () => ({ ...initialSettings, yourUploads: true }),
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
        <NotificationSettings teamId="team-1" />
      </QueryClientProvider>,
    )
  }

  it('renders all notification sections and switches', async () => {
    const { container } = renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/comments & replies/i)).toBeDefined()
    })

    expect(screen.getByText(/assets & statuses/i)).toBeDefined()
    expect(screen.getByText(/kanban notifications/i)).toBeDefined()

    // Verify switches are rendered
    const switches = screen.getAllByRole('switch')
    expect(switches.length).toBe(8)

    // Verify no hardcoded blue/purple color classes exist in the markup
    const html = container.innerHTML
    expect(html).not.toMatch(/text-blue-500/)
    expect(html).not.toMatch(/bg-blue-50/)
    expect(html).not.toMatch(/text-purple-600/)
    expect(html).not.toMatch(/bg-purple-50/)
    expect(html).not.toMatch(/text-indigo-500/)
    expect(html).not.toMatch(/border-slate-/)
  })

  it('handles toggling a notification setting', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/comments & replies/i)).toBeDefined()
    })

    const switches = screen.getAllByRole('switch')
    // Click the first switch (comments)
    fireEvent.click(switches[0])

    await waitFor(() => {
      expect(mockPostSettings).toHaveBeenCalledTimes(1)
      expect(mockPostSettings).toHaveBeenCalledWith({
        param: { teamId: 'team-1' },
        json: {
          ...initialSettings,
          comments: false,
        },
      })
    })
  })
})
