// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AssetInfo } from '@shumai/dtos'
import { useBatchFileStatus } from './use-batch-file-status'
import { client } from '@/ui/api/client'
import { useUploadStore } from '@/ui/stores/upload'

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      files: {
        batch: {
          $post: vi.fn(),
        },
      },
    },
  },
}))

describe('useBatchFileStatus', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    useUploadStore.setState({ fileProgress: {} })
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  it('does not poll when items array is empty or no files are processing', () => {
    const items: AssetInfo[] = [
      { id: 'f1', type: 'file', status: 'processed' } as AssetInfo,
      { id: 'f2', type: 'file', status: 'error' } as AssetInfo,
    ]

    renderHook(() => useBatchFileStatus({ teamId: 'team-1', items }), { wrapper })

    expect(client.api.files.batch.$post).not.toHaveBeenCalled()
  })

  it('does NOT poll when files are in "uploading" status and upload is in progress', () => {
    const items: AssetInfo[] = [
      { id: 'f1', type: 'file', status: 'uploading' } as AssetInfo,
      { id: 'f2', type: 'file', status: 'uploading' } as AssetInfo,
    ]

    renderHook(() => useBatchFileStatus({ teamId: 'team-1', items }), { wrapper })

    expect(client.api.files.batch.$post).not.toHaveBeenCalled()
  })

  it('polls batch API when file has status "uploading" but upload is completed in store', async () => {
    useUploadStore.setState({
      fileProgress: {
        f1: { fileId: 'f1', name: 'f1.mp4', loaded: 1000, total: 1000, status: 'completed' },
      },
    })

    const items: AssetInfo[] = [
      { id: 'f1', type: 'file', status: 'uploading' } as AssetInfo,
      { id: 'f2', type: 'file', status: 'uploading' } as AssetInfo,
    ]

    const updatedAssets: AssetInfo[] = [
      { id: 'f1', type: 'file', status: 'uploaded', name: 'f1.mp4' } as AssetInfo,
    ]

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(client.api.files.batch.$post).mockResolvedValue({
      ok: true,
      json: async () => updatedAssets,
    } as unknown as Awaited<ReturnType<typeof client.api.files.batch.$post>>)

    renderHook(() => useBatchFileStatus({ teamId: 'team-1', items }), { wrapper })

    await waitFor(() => {
      expect(client.api.files.batch.$post).toHaveBeenCalledWith({
        json: { ids: ['f1'] },
      })
    })

    expect(queryClient.getQueryData(['file', 'team-1', 'f1'])).toEqual(updatedAssets[0])
    // Should NOT invalidate search query for intermediate 'uploaded' state; card updates via setQueryData
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['search', 'team-1'] })
  })

  it('polls batch API when files are in "uploaded" or "processing" status and updates cache', async () => {
    const items: AssetInfo[] = [
      { id: 'f1', type: 'file', status: 'uploaded' } as AssetInfo,
      { id: 'f2', type: 'file', status: 'processing' } as AssetInfo,
      { id: 'f3', type: 'file', status: 'uploading' } as AssetInfo,
    ]

    const updatedAssets: AssetInfo[] = [
      { id: 'f1', type: 'file', status: 'processing', name: 'f1.mp4' } as AssetInfo,
      { id: 'f2', type: 'file', status: 'processed', name: 'f2.mp4' } as AssetInfo,
    ]

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(client.api.files.batch.$post).mockResolvedValue({
      ok: true,
      json: async () => updatedAssets,
    } as unknown as Awaited<ReturnType<typeof client.api.files.batch.$post>>)

    renderHook(() => useBatchFileStatus({ teamId: 'team-1', items }), { wrapper })

    await waitFor(() => {
      expect(client.api.files.batch.$post).toHaveBeenCalledWith({
        json: { ids: ['f1', 'f2'] },
      })
    })

    // Should update per-file cache in TanStack Query
    expect(queryClient.getQueryData(['file', 'team-1', 'f1'])).toEqual(updatedAssets[0])
    expect(queryClient.getQueryData(['file', 'team-1', 'f2'])).toEqual(updatedAssets[1])

    // Should invalidate folder search query because f2 finished ('processed')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['search', 'team-1'] })
  })

  it('chunks requests when processing items exceed 100', async () => {
    const items: AssetInfo[] = Array.from({ length: 150 }, (_, i) => ({
      id: `file-${i}`,
      type: 'file',
      status: 'processing',
    })) as AssetInfo[]

    vi.mocked(client.api.files.batch.$post).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Awaited<ReturnType<typeof client.api.files.batch.$post>>)

    renderHook(() => useBatchFileStatus({ teamId: 'team-1', items }), { wrapper })

    await waitFor(() => {
      expect(client.api.files.batch.$post).toHaveBeenCalledTimes(2)
    })

    const calls = vi.mocked(client.api.files.batch.$post).mock.calls
    expect(calls[0][0].json.ids).toHaveLength(100)
    expect(calls[1][0].json.ids).toHaveLength(50)
  })
})
