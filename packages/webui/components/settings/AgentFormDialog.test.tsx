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
    expect(screen.getByText('Rename Asset')).toBeDefined()
    expect(screen.getByText('Move Assets')).toBeDefined()
    expect(screen.getByText('Delete Asset')).toBeDefined()
  })

  it('renders read-only state with system managed hint and only Close button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AgentFormDialog
          isOpen={true}
          readOnly={true}
          onClose={vi.fn()}
          teamId="team-123"
          type="embedding"
          title="Edit Embedding Agent"
          initialValues={{
            id: 'agent-1',
            name: 'embedding-agent',
            type: 'embedding',
            enabled: true,
            permission: 'reviewer',
            thinkingLevel: 'off',
            skills: [],
            mcpServerIds: [],
            deniedTools: [],
            readOnly: true,
          }}
        />
      </QueryClientProvider>,
    )

    expect(
      screen.getByText(
        'This agent is managed by the server environment configuration and cannot be modified or deleted.',
      ),
    ).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBe(2)
    expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull()
  })
})
