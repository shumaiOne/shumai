// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useFileSystemDnd } from './use-file-system-dnd'
import type { AssetInfo } from '@shumai/dtos'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockReparent = vi.fn().mockResolvedValue({ ok: true })
const mockReorderFolder = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
const mockReorderFile = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
const mockAddAssetToShare = vi
  .fn()
  .mockResolvedValue({ ok: true, json: async () => ({ addedCount: 1 }) })

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      projects: {
        ':projectId': {
          reparent: {
            $post: (...args: unknown[]) => mockReparent(...args),
          },
        },
      },
      folders: {
        ':folderId': {
          order: {
            $patch: (...args: unknown[]) => mockReorderFolder(...args),
          },
        },
      },
      files: {
        ':fileId': {
          order: {
            $patch: (...args: unknown[]) => mockReorderFile(...args),
          },
        },
      },
      shares: {
        ':shareId': {
          assets: {
            $post: (...args: unknown[]) => mockAddAssetToShare(...args),
          },
        },
      },
    },
  },
}))

describe('useFileSystemDnd', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    vi.clearAllMocks()
  })

  const folders: AssetInfo[] = [
    { id: 'folder-1', name: 'Folder 1', type: 'folder', status: 'processed' } as AssetInfo,
  ]
  const files: AssetInfo[] = [
    { id: 'file-1', name: 'File 1.png', type: 'file', status: 'processed' } as AssetInfo,
    { id: 'file-2', name: 'File 2.png', type: 'file', status: 'processed' } as AssetInfo,
    { id: 'stack-1', name: 'Stack 1', type: 'version_stack', status: 'processed' } as AssetInfo,
    { id: 'stack-2', name: 'Stack 2', type: 'version_stack', status: 'processed' } as AssetInfo,
  ]

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('handleDragStart dragState computation', () => {
    it('sets isSingleFile true when dragging a single regular file', () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:file-1',
              data: { type: 'file', item: files[0] },
            },
          },
        } as never)
      })

      expect(result.current.dragState).toEqual({
        isActive: true,
        draggedIds: new Set(['file-1']),
        hasFolders: false,
        hasVersionStacks: false,
        isSingleFile: true,
        itemCount: 1,
      })
    })

    it('sets isSingleFile false and hasVersionStacks true when dragging a version stack', () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      expect(result.current.dragState).toEqual({
        isActive: true,
        draggedIds: new Set(['stack-1']),
        hasFolders: false,
        hasVersionStacks: true,
        isSingleFile: false,
        itemCount: 1,
      })
    })

    it('sets hasFolders true when dragging a folder', () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:folder-1',
              data: { type: 'folder', item: folders[0] },
            },
          },
        } as never)
      })

      expect(result.current.dragState).toEqual({
        isActive: true,
        draggedIds: new Set(['folder-1']),
        hasFolders: true,
        hasVersionStacks: false,
        isSingleFile: false,
        itemCount: 1,
      })
    })

    it('sets isSingleFile false when dragging multiple selected files', () => {
      const selectedIds = new Set(['file-1', 'file-2'])
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds,
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:file-1',
              data: { type: 'file', item: files[0] },
            },
          },
        } as never)
      })

      expect(result.current.dragState).toEqual({
        isActive: true,
        draggedIds: new Set(['file-1', 'file-2']),
        hasFolders: false,
        hasVersionStacks: false,
        isSingleFile: false,
        itemCount: 2,
      })
    })
  })

  describe('handleDragEnd drop execution', () => {
    it('executes reparentAssets when dropping a single file onto another file', async () => {
      const onClearSelection = vi.fn()
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection,
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:file-1',
              data: { type: 'file', item: files[0] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:file-2',
              data: { type: 'file', item: files[1] },
            },
          },
        } as never)
      })

      await vi.waitFor(() => {
        expect(mockReparent).toHaveBeenCalledWith({
          param: { projectId: 'proj-1' },
          json: {
            assetIds: ['file-1'],
            newParentId: 'file-2',
          },
        })
      })
    })

    it('executes reparentAssets when dropping a single file onto a version stack', async () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:file-1',
              data: { type: 'file', item: files[0] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      await vi.waitFor(() => {
        expect(mockReparent).toHaveBeenCalledWith({
          param: { projectId: 'proj-1' },
          json: {
            assetIds: ['file-1'],
            newParentId: 'stack-1',
          },
        })
      })
    })

    it('does NOT execute reparentAssets when dropping a version stack onto a file', () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:file-1',
              data: { type: 'file', item: files[0] },
            },
          },
        } as never)
      })

      expect(mockReparent).not.toHaveBeenCalled()
    })

    it('does NOT execute reparentAssets when dropping a version stack onto another version stack', () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:stack-2',
              data: { type: 'version_stack', item: files[3] },
            },
          },
        } as never)
      })

      expect(mockReparent).not.toHaveBeenCalled()
    })

    it('executes reparentAssets when dropping a version stack onto a folder', async () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:folder-1',
              data: { type: 'folder', item: folders[0] },
            },
          },
        } as never)
      })

      await vi.waitFor(() => {
        expect(mockReparent).toHaveBeenCalledWith({
          param: { projectId: 'proj-1' },
          json: {
            assetIds: ['stack-1'],
            newParentId: 'folder-1',
          },
        })
      })
    })

    it('does NOT execute reparentAssets when dropping a folder onto a version stack or file', () => {
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds: new Set(),
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:folder-1',
              data: { type: 'folder', item: folders[0] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      expect(mockReparent).not.toHaveBeenCalled()
    })

    it('does NOT execute reparentAssets when dropping multiple files onto a version stack or file', () => {
      const selectedIds = new Set(['file-1', 'file-2'])
      const { result } = renderHook(
        () =>
          useFileSystemDnd({
            teamId: 'team-1',
            projectId: 'proj-1',
            assetId: 'asset-1',
            folders,
            files,
            selectedIds,
            onClearSelection: vi.fn(),
          }),
        { wrapper },
      )

      act(() => {
        result.current.handleDragStart({
          operation: {
            source: {
              id: 'browser:file-1',
              data: { type: 'file', item: files[0] },
            },
          },
        } as never)
      })

      act(() => {
        result.current.handleDragEnd({
          operation: {
            target: {
              id: 'browser:stack-1',
              data: { type: 'version_stack', item: files[2] },
            },
          },
        } as never)
      })

      expect(mockReparent).not.toHaveBeenCalled()
    })
  })
})
