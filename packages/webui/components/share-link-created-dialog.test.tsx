// @vitest-environment happy-dom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ShareLinkInfo } from '@shumai/dtos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareLinkCreatedDialog } from './share-link-created-dialog'

const mockNavigate = vi.fn()
const mockCopyToClipboard = vi.fn().mockResolvedValue(true)
const mockGetShare = vi.fn()
const mockPutShare = vi.fn()
const mockGetWatermark = vi.fn()
const mockPutWatermark = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/ui/lib/clipboard', () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}))

vi.mock('@/ui/components/watermark-editor-dialog', () => ({
  WatermarkEditorDialog: () => null,
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      shares: {
        ':shareId': {
          $get: (...args: unknown[]) => mockGetShare(...args),
          $put: (...args: unknown[]) => mockPutShare(...args),
          watermark: {
            $get: (...args: unknown[]) => mockGetWatermark(...args),
            $put: (...args: unknown[]) => mockPutWatermark(...args),
          },
        },
      },
    },
  },
}))

const sampleShare: ShareLinkInfo = {
  id: 'share-1',
  name: 'hero-cut.mp4',
  isDisabled: false,
  allowDownload: true,
  hasPassword: false,
  password: null,
  rootFolderId: 'folder-share-1',
  projectId: 'proj-1',
  isExpired: false,
  views: 0,
  lastViewedAt: null,
  watermarkConfigId: null,
  watermarkStatus: 'disabled',
  watermarkConfig: null,
  createdAt: '2026-11-24T00:00:00.000Z',
  updatedAt: '2026-11-24T00:00:00.000Z',
  creator: null,
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

describe('ShareLinkCreatedDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShare.mockResolvedValue({
      ok: true,
      json: async () => sampleShare,
    })
    mockGetWatermark.mockResolvedValue({
      ok: true,
      json: async () => ({ watermarkStatus: 'disabled', watermarkConfig: null }),
    })
    mockPutShare.mockImplementation(async ({ json }: { json: Record<string, unknown> }) => ({
      ok: true,
      json: async () => ({ ...sampleShare, ...json }),
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('renders share name, URL, all 4 expanded security controls, and footer buttons', () => {
    const queryClient = createQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ShareLinkCreatedDialog
          open={true}
          onOpenChange={vi.fn()}
          shareLink={sampleShare}
          projectId="proj-1"
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('hero-cut.mp4')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Rename Share Link' })).toBeDefined()

    const urlInput = screen.getByRole('textbox', { name: /share link/i }) as HTMLInputElement
    expect(urlInput.value).toBe(`${window.location.origin}/share/share-1`)

    // All 4 security settings rendered directly without needing an accordion
    expect(screen.getByText('Password')).toBeDefined()
    expect(screen.getByText('Expiration Date')).toBeDefined()
    expect(screen.getByText('Allow download')).toBeDefined()
    expect(screen.getByText('Watermark')).toBeDefined()

    // Footer buttons
    expect(screen.getByRole('button', { name: 'Advanced settings' })).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Copy Link' }).length).toBe(2)
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined()
  })

  it('supports inline renaming via pen icon and cancels on Escape', async () => {
    const queryClient = createQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ShareLinkCreatedDialog
          open={true}
          onOpenChange={vi.fn()}
          shareLink={sampleShare}
          projectId="proj-1"
        />
      </QueryClientProvider>,
    )

    // Enter edit mode and cancel with Escape
    fireEvent.click(screen.getByRole('button', { name: 'Rename Share Link' }))
    const input = screen.getByRole('textbox', { name: 'Rename Share Link' }) as HTMLInputElement
    expect(input.value).toBe('hero-cut.mp4')
    fireEvent.change(input, { target: { value: 'Temporary Name' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockPutShare).not.toHaveBeenCalled()
    expect(screen.getByText('hero-cut.mp4')).toBeDefined()

    // Re-enter edit mode and save with Enter
    fireEvent.click(screen.getByRole('button', { name: 'Rename Share Link' }))
    const input2 = screen.getByRole('textbox', { name: 'Rename Share Link' }) as HTMLInputElement
    fireEvent.change(input2, { target: { value: 'Client Delivery v2' } })
    fireEvent.keyDown(input2, { key: 'Enter' })

    await waitFor(() => {
      expect(mockPutShare).toHaveBeenCalledWith({
        param: { shareId: 'share-1' },
        json: { name: 'Client Delivery v2' },
      })
    })
  })

  it('updates security settings via PUT /shares/:shareId', async () => {
    const queryClient = createQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ShareLinkCreatedDialog
          open={true}
          onOpenChange={vi.fn()}
          shareLink={sampleShare}
          projectId="proj-1"
        />
      </QueryClientProvider>,
    )

    const switches = screen.getAllByRole('switch')
    // Switches order: Password (0), Expiration Date (1), Allow Download (2), Watermark (3)
    fireEvent.click(switches[2])

    await waitFor(() => {
      expect(mockPutShare).toHaveBeenCalledWith({
        param: { shareId: 'share-1' },
        json: { allowDownload: false },
      })
    })

    // Enable password and save
    fireEvent.click(switches[0])
    const passwordInput = screen.getByPlaceholderText('Enter password')
    fireEvent.change(passwordInput, { target: { value: 'pass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockPutShare).toHaveBeenCalledWith({
        param: { shareId: 'share-1' },
        json: { password: 'pass123' },
      })
    })
  })

  it('copies link while staying open, closes on Done, and navigates on Advanced settings', async () => {
    const onOpenChange = vi.fn()
    const queryClient = createQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ShareLinkCreatedDialog
          open={true}
          onOpenChange={onOpenChange}
          shareLink={sampleShare}
          projectId="proj-1"
        />
      </QueryClientProvider>,
    )

    const copyButtons = screen.getAllByRole('button', { name: 'Copy Link' })
    fireEvent.click(copyButtons[copyButtons.length - 1])

    await waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith(`${window.location.origin}/share/share-1`)
    })
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Advanced settings' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/projects/$projectId/shares/$shareId',
      params: { projectId: 'proj-1', shareId: 'share-1' },
    })

    onOpenChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
