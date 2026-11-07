// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicShareManager } from './public-share-manager'
import { client } from '@/ui/api/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouterState: ({
    select,
  }: { select?: (state: { location: { pathname: string } }) => unknown } = {}) => {
    const state = { location: { pathname: '/share/share-1' } }
    return select ? select(state) : state
  },
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: options.count }, (_, i) => ({
        index: i,
        start: i * 50,
        size: 50,
        key: i,
      })),
    getTotalSize: () => options.count * 50,
  }),
}))

vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({
    ref: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    ref: vi.fn(),
    isOver: false,
  }),
}))

vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => ({
    canEdit: false,
    canAdmin: false,
    canView: true,
  }),
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      shares: {
        ':shareId': {
          info: {
            $get: vi.fn(),
          },
          folders: {
            ':folderId': {
              children: {
                $get: vi.fn(),
              },
              search: {
                $post: vi.fn(),
              },
            },
          },
          teams: {
            ':teamId': {
              upload: {
                tasks: {
                  $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
                  ':taskId': {
                    $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
                  },
                },
              },
            },
          },
          files: {
            ':fileId': {
              $get: vi.fn(),
            },
          },
          fields: {
            $get: vi.fn(),
          },
        },
      },
      projects: {
        ':projectId': {
          reparent: {
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          },
          shares: {
            $get: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'share-1' }) }),
          },
          copy: {
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          },
        },
      },
      teams: {
        ':teamId': {
          upload: {
            tasks: {
              $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
              ':taskId': {
                $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
              },
            },
          },
        },
      },
      files: {
        $delete: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        'download-links': {
          $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [] }) }),
        },
        restore: {
          $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
        ':fileId': {
          $get: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          $put: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
      },
      folders: {
        $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'new-f' }) }),
        $delete: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        restore: {
          $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
        ':folderId': {
          $put: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
      },
    },
  },
}))

describe('PublicShareManager selection and card click behavior', () => {
  let queryClient: QueryClient

  const mockFiles = [
    { id: 'f1', name: 'File 1.mov', type: 'file', status: 'processed' },
    { id: 'f2', name: 'File 2.mov', type: 'file', status: 'processed' },
    { id: 'f3', name: 'File 3.mov', type: 'file', status: 'processed' },
    { id: 'f4', name: 'File 4.mov', type: 'file', status: 'processed' },
  ]

  beforeEach(() => {
    mockNavigate.mockClear()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const shareClient = client.api.shares[':shareId']
    type InfoResponse = Awaited<ReturnType<typeof shareClient.info.$get>>
    type FileResponse = Awaited<ReturnType<(typeof shareClient.files)[':fileId']['$get']>>
    type ChildrenResponse = Awaited<
      ReturnType<(typeof shareClient.folders)[':folderId']['children']['$get']>
    >
    type FieldsResponse = Awaited<ReturnType<typeof shareClient.fields.$get>>

    vi.mocked(shareClient.info.$get).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'share-1',
        name: 'Test Share',
        rootFolderId: 'root-folder-1',
        projectId: 'project-1',
        allowDownload: true,
        isDisabled: false,
        isExpired: false,
        hasPassword: false,
        expireAt: null,
      }),
    } as unknown as InfoResponse)

    vi.mocked(shareClient.files[':fileId'].$get).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'root-folder-1',
        name: 'Root',
        type: 'folder',
      }),
    } as unknown as FileResponse)

    vi.mocked(shareClient.folders[':folderId'].children.$get).mockImplementation(
      async ({ query }: { query?: { assetType?: string } }) => {
        if (query?.assetType === 'folder') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [], pageInfo: { total: 0 } }),
          } as unknown as ChildrenResponse
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: mockFiles, pageInfo: { total: 4 } }),
        } as unknown as ChildrenResponse
      },
    )

    vi.mocked(shareClient.fields.$get).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as FieldsResponse)
  })

  afterEach(() => {
    cleanup()
  })

  it('navigates immediately on single clicking card body even if already selected', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PublicShareManager shareId="share-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('File 1.mov')).toBeTruthy()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    // Select first card via checkbox
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0].getAttribute('data-state')).toBe('checked')

    // Single click on card body must navigate
    const cards = screen.getAllByTestId('file-card')
    fireEvent.click(cards[0])

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/share/$shareId/files/$fileId',
      params: {
        shareId: 'share-1',
        fileId: 'f1',
      },
    })
  })

  it('independently toggles checkbox without deselecting other selected assets', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PublicShareManager shareId="share-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('File 1.mov')).toBeTruthy()
    })

    const checkboxes = screen.getAllByRole('checkbox')

    // Select items 0, 1, 2
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])

    expect(checkboxes[0].getAttribute('data-state')).toBe('checked')
    expect(checkboxes[1].getAttribute('data-state')).toBe('checked')
    expect(checkboxes[2].getAttribute('data-state')).toBe('checked')

    // Now click checkbox on item 1 (which is currently selected)
    fireEvent.click(checkboxes[1])

    // Item 1 should be unchecked, items 0 and 2 should remain checked
    expect(checkboxes[1].getAttribute('data-state')).toBe('unchecked')
    expect(checkboxes[0].getAttribute('data-state')).toBe('checked')
    expect(checkboxes[2].getAttribute('data-state')).toBe('checked')
  })

  it('supports shift-click range selection between cards or checkboxes', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PublicShareManager shareId="share-1" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('File 1.mov')).toBeTruthy()
    })

    const checkboxes = screen.getAllByRole('checkbox')

    // Click first item checkbox to establish lastSelectedId
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0].getAttribute('data-state')).toBe('checked')

    // Shift-click the 3rd item checkbox (index 2)
    fireEvent.click(checkboxes[2], { shiftKey: true })

    // Items 0, 1, and 2 must now all be checked
    expect(checkboxes[0].getAttribute('data-state')).toBe('checked')
    expect(checkboxes[1].getAttribute('data-state')).toBe('checked')
    expect(checkboxes[2].getAttribute('data-state')).toBe('checked')
    expect(checkboxes[3].getAttribute('data-state')).toBe('unchecked')
  })
})
