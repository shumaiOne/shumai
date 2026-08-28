// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileFileDetail } from './mobile-file-detail'
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

vi.mock('@/ui/components/file-viewer', () => ({
  FileViewer: ({ file }: { file: AssetInfo }) => (
    <div data-testid="mock-file-viewer">{file.name}</div>
  ),
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
      teams: {
        ':teamId': {
          kanban: {
            assets: {
              ':assetId': {
                tasks: {
                  $get: vi.fn().mockResolvedValue({
                    ok: true,
                    json: async () => ({ data: [], total: 0 }),
                  }),
                },
              },
            },
          },
        },
      },
      files: {
        ':fileId': {
          comments: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ data: [], pageInfo: {} }),
            }),
          },
        },
      },
      me: {
        $get: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'user-1', name: 'User 1' }),
        }),
      },
    },
  },
}))

describe('MobileFileDetail', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  afterEach(() => {
    cleanup()
  })

  const mockFile: AssetInfo = {
    id: 'file-100',
    name: 'sample_video.mp4',
    proxyType: 'video',
    media: {
      metadata: {
        duration: 120,
        frameRate: 30,
      },
    },
  } as AssetInfo

  it('renders header, media viewer, and bottom sheet', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileFileDetail
          projectId="proj-1"
          teamId="team-1"
          fileId="file-100"
          file={mockFile}
          activeFileId="file-100"
          onNavigateToFile={vi.fn()}
          onNavigateBack={vi.fn()}
          onSaveField={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(screen.getAllByText('sample_video.mp4').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('mock-file-viewer')).toBeDefined()
    expect(screen.getByTestId('mobile-bottom-sheet')).toBeDefined()
  })

  it('displays the immediate parent folder name in nested folder hierarchies', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileFileDetail
          projectId="proj-1"
          teamId="team-1"
          fileId="file-100"
          file={mockFile}
          activeFileId="file-100"
          ancestorFolders={[
            { id: 'f-sub', name: 'Immediate Subfolder' },
            { id: 'f-root', name: 'Top Level Root' },
          ]}
          onNavigateToFile={vi.fn()}
          onNavigateBack={vi.fn()}
          onSaveField={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Immediate Subfolder')).toBeDefined()
    expect(screen.queryByText('Top Level Root')).toBeNull()
  })

  it('renders version list from stack when viewing selected version', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MobileFileDetail
          projectId="proj-1"
          teamId="team-1"
          fileId="file-100"
          file={mockFile}
          activeFileId="ver-2"
          versions={[
            { id: 'ver-1', version: 1, name: 'video_v1.mp4' },
            { id: 'ver-2', version: 2, name: 'video_v2.mp4' },
          ]}
          onNavigateToFile={vi.fn()}
          onNavigateBack={vi.fn()}
          onSaveField={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('v2')).toBeDefined()
  })
})
