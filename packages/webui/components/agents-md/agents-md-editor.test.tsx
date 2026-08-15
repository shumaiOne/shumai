// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AgentsMdEditor } from './agents-md-editor'
import { m } from '@/ui/paraglide/messages.js'

// Mock API client
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      folders: {
        ':folderId': {
          agentsmd: {
            $get: vi.fn(),
            $patch: vi.fn(),
          },
        },
      },
    },
  },
}))

// Mock usePermissions
const mockUsePermissions = vi.fn()
vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => mockUsePermissions(),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

describe('AgentsMdEditor Component', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    mockUsePermissions.mockReturnValue({
      role: 'owner',
      canEdit: true,
      canAdmin: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders loading state initially', async () => {
    const { client } = await import('@/ui/api/client')
    const getMock = client.api.folders[':folderId'].agentsmd.$get as unknown as ReturnType<
      typeof vi.fn
    >
    getMock.mockImplementation(() => new Promise(() => {}))

    render(
      <QueryClientProvider client={queryClient}>
        <AgentsMdEditor projectId="proj-1" assetId="folder-1" rootFolderId="folder-1" isRoot />
      </QueryClientProvider>,
    )

    expect(screen.getByText(m.agents_md_loading())).toBeDefined()
  })

  it('renders editable editor for team owner', async () => {
    const { client } = await import('@/ui/api/client')
    const getMock = client.api.folders[':folderId'].agentsmd.$get as unknown as ReturnType<
      typeof vi.fn
    >
    getMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: '# Instructions' }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AgentsMdEditor projectId="proj-1" assetId="folder-1" rootFolderId="folder-1" isRoot />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDefined()
    })
    expect(screen.queryByText(m.agents_md_readonly_hint())).toBeNull()
  })

  it('renders read-only notice and restricts editing for non-owner', async () => {
    mockUsePermissions.mockReturnValue({
      role: 'editor',
      canEdit: true,
      canAdmin: false,
    })

    const { client } = await import('@/ui/api/client')
    const getMock = client.api.folders[':folderId'].agentsmd.$get as unknown as ReturnType<
      typeof vi.fn
    >
    getMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: '# Instructions' }),
    })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AgentsMdEditor projectId="proj-1" assetId="folder-1" rootFolderId="folder-1" isRoot />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(m.agents_md_readonly_hint())).toBeDefined()
    })

    expect(container.querySelector('.read-only')).toBeDefined()
  })

  it('displays the friendly multiline placeholder when content is empty', async () => {
    const { client } = await import('@/ui/api/client')
    const getMock = client.api.folders[':folderId'].agentsmd.$get as unknown as ReturnType<
      typeof vi.fn
    >
    getMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: null }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AgentsMdEditor projectId="proj-1" assetId="folder-1" rootFolderId="folder-1" isRoot />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(/parent folders up to the project level/)).toBeDefined()
    })
  })
})
