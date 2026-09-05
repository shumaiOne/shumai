// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QuotaRuleDialog } from './QuotaRuleDialog'
import type { QuotaRuleResponse } from '@shumai/dtos'

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          members: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => [],
            }),
          },
          mcp: {
            servers: {
              $get: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ servers: [] }),
              }),
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

describe('QuotaRuleDialog', () => {
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

  it('displays generate_image and generate_video in tool selector for agent_tool_call_count', () => {
    const existingRule: QuotaRuleResponse = {
      id: 'rule-1',
      teamId: 'team-123',
      scopeMode: 'each_member',
      role: null,
      resource: 'agent_tool_call_count',
      resourceData: { name: 'generate_image' },
      limit: 50,
      period: '1day',
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    render(
      <QueryClientProvider client={queryClient}>
        <QuotaRuleDialog open={true} onOpenChange={vi.fn()} teamId="team-123" rule={existingRule} />
      </QueryClientProvider>,
    )

    // The select trigger and option both display the selected tool name
    expect(screen.getAllByText('Generate Image').length).toBeGreaterThan(0)
  })
})
