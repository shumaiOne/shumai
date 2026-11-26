// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ShareLinkInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { ShareSettingsSidebar } from './share-settings-sidebar'

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      shares: {
        ':shareId': {
          $put: vi.fn(),
          watermark: {
            $get: vi.fn(),
            $put: vi.fn(),
          },
        },
      },
      projects: {
        ':projectId': {
          fields: {
            $get: vi.fn(),
          },
        },
      },
    },
  },
}))

vi.mock('@/ui/components/watermark-editor-dialog', () => ({
  WatermarkEditorDialog: () => null,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const shareLink: ShareLinkInfo = {
  id: 'share-1',
  name: 'Client review',
  isDisabled: false,
  allowDownload: true,
  hasPassword: true,
  password: 'saved-secret',
  rootFolderId: 'folder-1',
  projectId: 'project-1',
  isExpired: false,
  watermarkStatus: 'disabled',
  views: 0,
  lastViewedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function renderSidebar(link: ShareLinkInfo) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ShareSettingsSidebar
        shareLink={link}
        viewMode="card"
        onViewModeChange={() => {}}
        defaultSortOrder={null}
        onSortOrderChange={() => {}}
      />
    </QueryClientProvider>,
  )
}

function openSecuritySection() {
  fireEvent.click(screen.getByText(m.security()))
}

describe('ShareSettingsSidebar password', () => {
  beforeEach(() => {
    vi.mocked(client.api.shares[':shareId'].watermark.$get).mockResolvedValue({
      ok: false,
    } as never)
    vi.mocked(client.api.projects[':projectId'].fields.$get).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as never)
    vi.mocked(client.api.shares[':shareId'].$put).mockResolvedValue({
      ok: true,
      json: async () => ({ ...shareLink }),
    } as never)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows the saved password when password protection is enabled', () => {
    renderSidebar(shareLink)
    openSecuritySection()

    const input = screen.getByPlaceholderText(m.enter_password())
    expect(input).toHaveProperty('value', 'saved-secret')
  })

  it('saves and displays a replacement password', async () => {
    renderSidebar(shareLink)
    openSecuritySection()

    const input = screen.getByPlaceholderText(m.enter_password())
    fireEvent.change(input, { target: { value: 'new-secret' } })
    fireEvent.click(screen.getByRole('button', { name: m.save() }))

    await waitFor(() => {
      expect(client.api.shares[':shareId'].$put).toHaveBeenCalledWith({
        param: { shareId: 'share-1' },
        json: { password: 'new-secret' },
      })
    })
    expect(input).toHaveProperty('value', 'new-secret')
  })

  it('turning the password off clears it', async () => {
    renderSidebar(shareLink)
    openSecuritySection()

    const toggles = screen.getAllByRole('switch')
    const passwordToggle = toggles.find(
      (el) =>
        el.getAttribute('aria-checked') === 'true' &&
        el.closest('div')?.textContent?.includes(m.password()),
    )
    expect(passwordToggle).toBeDefined()
    fireEvent.click(passwordToggle!)

    await waitFor(() => {
      expect(client.api.shares[':shareId'].$put).toHaveBeenCalledWith({
        param: { shareId: 'share-1' },
        json: { password: null },
      })
    })
  })
})
