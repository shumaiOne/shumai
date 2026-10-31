// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UploadTasks } from './upload-tasks'
import { useUploadStore } from '@/ui/stores/upload'
import * as uploaderLib from '@/ui/lib/uploader'
import { toast } from 'sonner'

const mockGetTasks = vi.fn()
const mockCancelTask = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          upload: {
            tasks: Object.assign(
              {
                $get: () => mockGetTasks(),
              },
              {
                ':taskId': {
                  cancel: {
                    $post: (args: unknown) => mockCancelTask(args),
                  },
                },
              },
            ),
          },
        },
      },
    },
  },
}))

vi.mock('@/ui/hooks/use-team-id', () => ({
  useTeamId: () => 'team-1',
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('UploadTasks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    useUploadStore.setState({
      uploading: 0,
      tasks: {},
      fileProgress: {},
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders completed and failed tasks without a cancel button', async () => {
    mockGetTasks.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'task-done',
            name: 'Completed Task',
            total: 2,
            uploaded: 2,
            status: 'completed',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'task-failed',
            name: 'Failed Task',
            total: 2,
            uploaded: 1,
            status: 'failed',
            createdAt: new Date().toISOString(),
          },
        ],
        pageInfo: {},
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <UploadTasks />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Completed Task')).toBeDefined()
      expect(screen.getByText('Failed Task')).toBeDefined()
    })

    // No cancel button should be rendered for completed or failed tasks
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
  })

  it('renders cancel button for running tasks and executes cancel flow on confirmation', async () => {
    const cancelActiveSpy = vi.spyOn(uploaderLib, 'cancelActiveUploadTask')

    mockGetTasks.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'task-running',
            name: 'Running Task',
            total: 3,
            uploaded: 1,
            status: 'uploading',
            createdAt: new Date().toISOString(),
          },
        ],
        pageInfo: {},
      }),
    })

    mockCancelTask.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <UploadTasks />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Running Task')).toBeDefined()
    })

    // Cancel button should be present
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    expect(cancelButton).toBeDefined()

    // Click Cancel to open confirmation dialog
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText(/cancel upload task\?/i)).toBeDefined()
    })

    // Click confirm in the dialog
    const confirmButtons = screen.getAllByRole('button', { name: /cancel upload/i })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => {
      expect(cancelActiveSpy).toHaveBeenCalledWith('task-running')
      expect(mockCancelTask).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { teamId: 'team-1', taskId: 'task-running' },
        }),
      )
      expect(toast.success).toHaveBeenCalled()
    })
  })
})
