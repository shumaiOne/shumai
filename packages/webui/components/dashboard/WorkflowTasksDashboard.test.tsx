// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkflowTasksDashboard } from './WorkflowTasksDashboard'
import type { ListWorkflowTasksResponse } from '@shumai/dtos'

const mockGetWorkflowTasks = vi.fn()
const mockBatchStatus = vi.fn()
const mockStopTask = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          'workflow-tasks': {
            $get: () => mockGetWorkflowTasks(),
            'batch-status': {
              $post: () => mockBatchStatus(),
            },
            ':taskId': {
              stop: {
                $post: () => mockStopTask(),
              },
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

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

const mockTasksData: ListWorkflowTasksResponse = {
  nodes: [
    {
      id: 'task_01M5KTTEST1',
      uid: 'uid-1',
      teamId: 'team-1',
      projectId: 'proj-1',
      projectName: 'Project Alpha',
      assetId: 'asset-1',
      fileName: 'nature_video.mp4',
      fileSize: 10485760, // 10.49 MB
      type: 'transcode_video',
      status: 'processing',
      createdAt: '2026-10-23T10:00:00.000Z',
      updatedAt: '2026-10-23T10:01:00.000Z',
      inputTokens: 0,
      outputTokens: 0,
    },
    {
      id: 'task_01M5KTTEST2',
      uid: 'uid-2',
      teamId: 'team-1',
      projectId: null,
      projectName: null,
      assetId: 'asset-2',
      fileName: null,
      fileSize: null,
      type: 'chat',
      status: 'completed',
      createdAt: '2026-10-23T09:00:00.000Z',
      updatedAt: '2026-10-23T09:05:00.000Z',
      inputTokens: 100,
      outputTokens: 50,
    },
  ],
  pageInfo: {
    hasNextPage: false,
    endCursor: null,
  },
  total: 2,
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('WorkflowTasksDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkflowTasks.mockResolvedValue({
      ok: true,
      json: async () => mockTasksData,
    })
    mockBatchStatus.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders table columns with File Name, Size, and Project Name, without Task ID column', async () => {
    render(<WorkflowTasksDashboard teamId="team-1" />, { wrapper: createWrapper() })

    // Wait for tasks to load
    await waitFor(() => {
      expect(screen.getByText('nature_video.mp4')).toBeTruthy()
    })

    // Check table headers
    expect(screen.getByText('File Name')).toBeTruthy()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Project Name')).toBeTruthy()
    expect(screen.queryByText('Task ID')).toBeNull() // Not in table headers

    // Check row data
    expect(screen.getByText('nature_video.mp4')).toBeTruthy()
    expect(screen.getByText('10.49 MB')).toBeTruthy()
    expect(screen.getByText('Project Alpha')).toBeTruthy()

    // Fallback row data
    expect(screen.getByText('asset-2')).toBeTruthy()
  })

  it('opens details dialog and displays file name, size, project name, and task ID', async () => {
    render(<WorkflowTasksDashboard teamId="team-1" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('nature_video.mp4')).toBeTruthy()
    })

    const viewButtons = screen.getAllByTitle('View Details')
    fireEvent.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Task Details')).toBeTruthy()
    })

    // Details dialog should show Task ID
    expect(screen.getByText('task_01M5KTTEST1')).toBeTruthy()
    // Details dialog should show File Name, Size, Project Name
    expect(screen.getAllByText('nature_video.mp4').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('10.49 MB').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Project Alpha').length).toBeGreaterThanOrEqual(1)
  })

  it('shows file name in stop task confirmation dialog', async () => {
    render(<WorkflowTasksDashboard teamId="team-1" />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('nature_video.mp4')).toBeTruthy()
    })

    const stopButton = screen.getByText('Stop Task')
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(screen.getByText('Stop Workflow Task')).toBeTruthy()
    })

    expect(screen.getByText(/task_01M5KTTEST1/)).toBeTruthy()
    expect(screen.getAllByText('nature_video.mp4').length).toBeGreaterThanOrEqual(1)
  })
})
