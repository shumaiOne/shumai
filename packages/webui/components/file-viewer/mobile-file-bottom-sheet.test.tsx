// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileFileBottomSheet } from './mobile-file-bottom-sheet'
import type { AssetInfo } from '@shumai/dtos'

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: vi.fn(),
    inView: false,
  }),
}))

vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => ({
    canEdit: true,
  }),
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      projects: {
        ':projectId': {
          fields: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => [],
            }),
          },
        },
      },
      files: {
        ':fileId': {
          comments: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({
                data: [
                  {
                    id: 'comment-1',
                    message: 'First mobile comment',
                    userId: 'user-1',
                    createdAt: new Date().toISOString(),
                  },
                ],
                pageInfo: {},
              }),
            }),
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ id: 'new-comment-id' }),
            }),
          },
        },
      },
      shares: {
        ':shareId': {
          files: {
            ':fileId': {
              comments: {
                $get: vi.fn().mockResolvedValue({
                  ok: true,
                  json: async () => ({ data: [], pageInfo: {} }),
                }),
                $post: vi.fn().mockResolvedValue({
                  ok: true,
                  json: async () => ({ id: 'new-comment-id' }),
                }),
              },
            },
          },
        },
      },
      me: {
        $get: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'user-1', name: 'Test User' }),
        }),
      },
    },
  },
}))

describe('MobileFileBottomSheet', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  afterEach(() => {
    cleanup()
  })

  const mockFile: AssetInfo = {
    id: 'file-1',
    name: 'test.mp4',
    proxyType: 'video',
    media: {
      metadata: {
        duration: 60,
        frameRate: 30,
      },
    },
  } as AssetInfo

  it('renders comments and fields tabs', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileFileBottomSheet
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[{ id: 'user-1', name: 'User One', role: 'owner' }]}
          heightPercent={50}
          onHeightPercentChange={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('tab', { name: /comments/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /fields/i })).toBeDefined()
  })

  it('handles drag interactions on the handle bar', () => {
    const onHeightChange = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <MobileFileBottomSheet
          teamId="team-1"
          projectId="proj-1"
          file={mockFile}
          onSaveField={vi.fn()}
          members={[]}
          heightPercent={50}
          onHeightPercentChange={onHeightChange}
        />
      </QueryClientProvider>,
    )

    const handle = screen.getByLabelText(/Drag to resize bottom sheet/i)
    expect(handle).toBeDefined()

    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 300, pointerId: 1 })

    expect(onHeightChange).toHaveBeenCalled()
  })
})
