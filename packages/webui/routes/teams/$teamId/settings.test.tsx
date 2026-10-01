// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TeamSettingsPage } from './settings.lazy'
import { toast } from 'sonner'
import { VideoTranscodeStrategy } from '@shumai/dtos'

interface PatchSettingsArgs {
  param: { teamId: string }
  json: { key: string; value: string[] }
}

const mockGetSettings = vi.fn()
const mockPatchSettings = vi.fn()
const mockGetMe = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (opts: Record<string, unknown>) => ({
    ...opts,
    useParams: () => ({ teamId: 'team-1' }),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          settings: {
            $get: () => mockGetSettings(),
            $patch: (args: unknown) => mockPatchSettings(args),
          },
          me: {
            $get: () => mockGetMe(),
            $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
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

describe('TeamSettingsPage Transcode Settings', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    window.location.hash = '#transcode'

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    mockGetMe.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user-1',
        name: 'Owner',
        role: 'owner',
      }),
    })

    mockGetSettings.mockResolvedValue({
      ok: true,
      json: async () => ({
        transcode: {
          videoStrategy: VideoTranscodeStrategy.multi,
          videoResolutions: ['480p', '720p', '1080p', '1440p', '2160p'],
          hardwareAcceleration: 'off',
          threads: 0,
          hlsEnabled: true,
          hlsResolutions: ['480p', '720p', '1080p', '1440p', '2160p'],
        },
      }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps pending selections optimistically and serializes consecutive toggles without submitting stale arrays', async () => {
    let resolveFirstPatch!: (value: unknown) => void
    const firstPatchPromise = new Promise((resolve) => {
      resolveFirstPatch = resolve
    })

    const patchCalls: PatchSettingsArgs[] = []

    mockPatchSettings.mockImplementation(async (args: PatchSettingsArgs) => {
      patchCalls.push(args)
      if (patchCalls.length === 1) {
        await firstPatchPromise
      }
      return {
        ok: true,
        json: async () => ({
          transcode: {
            videoResolutions: args.json.value,
          },
        }),
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TeamSettingsPage />
      </QueryClientProvider>,
    )

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getAllByText('480p').length).toBeGreaterThan(0)
      expect(screen.getAllByText('720p').length).toBeGreaterThan(0)
    })

    const label480p = screen.getAllByText('480p')[0].closest('label')
    const checkbox480p = label480p?.querySelector('button[role="checkbox"]') as HTMLElement
    expect(checkbox480p).toBeDefined()
    expect(checkbox480p.getAttribute('aria-checked')).toBe('true')

    const label720p = screen.getAllByText('720p')[0].closest('label')
    const checkbox720p = label720p?.querySelector('button[role="checkbox"]') as HTMLElement
    expect(checkbox720p).toBeDefined()
    expect(checkbox720p.getAttribute('aria-checked')).toBe('true')

    // Click 480p to uncheck it
    act(() => {
      fireEvent.click(checkbox480p)
    })

    // Optimistically 480p should be unchecked immediately
    expect(checkbox480p.getAttribute('aria-checked')).toBe('false')

    // Wait for the first PATCH request to be in-flight
    await waitFor(() => {
      expect(patchCalls.length).toBe(1)
    })
    expect(patchCalls[0].json.value).toEqual(['720p', '1080p', '1440p', '2160p'])

    // Rapid consecutive click: Click 720p to uncheck it WHILE first patch is in-flight
    act(() => {
      fireEvent.click(checkbox720p)
    })

    // Optimistically 720p should also be unchecked immediately
    expect(checkbox720p.getAttribute('aria-checked')).toBe('false')

    // Resolve first patch so the queue advances to the second queued update
    await act(async () => {
      resolveFirstPatch({
        ok: true,
        json: async () => ({
          transcode: {
            videoResolutions: ['720p', '1080p', '1440p', '2160p'],
          },
        }),
      })
    })

    // Wait for the second queued patch to complete
    await waitFor(() => {
      expect(patchCalls.length).toBe(2)
    })

    // The second patch MUST NOT submit stale array with 480p present!
    // It must contain neither 480p nor 720p
    expect(patchCalls[1].json.value).toEqual(['1080p', '1440p', '2160p'])
    expect(patchCalls[1].json.value.includes('480p')).toBe(false)
    expect(patchCalls[1].json.value.includes('720p')).toBe(false)

    // Verify toast notification on success
    expect(toast.success).toHaveBeenCalled()
  })

  it('coalesces rapid consecutive toggles before network dispatch into a single PATCH', async () => {
    const patchCalls: PatchSettingsArgs[] = []

    mockPatchSettings.mockImplementation(async (args: PatchSettingsArgs) => {
      patchCalls.push(args)
      return {
        ok: true,
        json: async () => ({
          transcode: {
            videoResolutions: args.json.value,
          },
        }),
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <TeamSettingsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('480p').length).toBeGreaterThan(0)
    })

    const label480p = screen.getAllByText('480p')[0].closest('label')
    const checkbox480p = label480p?.querySelector('button[role="checkbox"]') as HTMLElement

    const label720p = screen.getAllByText('720p')[0].closest('label')
    const checkbox720p = label720p?.querySelector('button[role="checkbox"]') as HTMLElement

    // Rapid synchronous clicks in the same event tick
    act(() => {
      fireEvent.click(checkbox480p)
      fireEvent.click(checkbox720p)
    })

    // Both reflect optimistically
    expect(checkbox480p.getAttribute('aria-checked')).toBe('false')
    expect(checkbox720p.getAttribute('aria-checked')).toBe('false')

    // Wait for the coalesced PATCH to complete
    await waitFor(() => {
      expect(patchCalls.length).toBeGreaterThanOrEqual(1)
    })

    // The submitted payload must reflect both toggles
    const lastPatch = patchCalls[patchCalls.length - 1]
    expect(lastPatch.json.value).toEqual(['1080p', '1440p', '2160p'])
  })
})
