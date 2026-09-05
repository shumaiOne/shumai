// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AgentFormDialog } from './AgentFormDialog'

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          providers: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => [],
            }),
          },
          skills: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ skills: [] }),
            }),
          },
          mcp: {
            servers: {
              $get: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => [],
              }),
            },
          },
          agents: {
            $post: vi.fn(),
            ':agentId': {
              $put: vi.fn(),
            },
          },
        },
      },
    },
  },
}))

vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => ({
    canAdmin: true,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AgentFormDialog', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all builtin tools including generate_image and generate_video', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AgentFormDialog
          isOpen={true}
          onClose={vi.fn()}
          teamId="team-123"
          type="chat"
          title="Create Agent"
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Generate Image')).toBeDefined()
    expect(screen.getByText('Generate Video')).toBeDefined()
    expect(screen.getByText('Sandboxed Terminal')).toBeDefined()
    expect(screen.getByText('Read Asset')).toBeDefined()
  })
})
