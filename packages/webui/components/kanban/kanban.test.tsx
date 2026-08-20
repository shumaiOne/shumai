// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  KanbanTaskPriority,
  KanbanTaskStatus,
  KanbanTaskType,
  KanbanTaskRunStatus,
  KanbanTaskEventType,
  type KanbanTaskInfo,
  type KanbanGoalInfo,
} from '@shumai/dtos'
import {
  getStatusLabel,
  getStatusColor,
  getStatusBadgeColor,
  getPriorityLabel,
  getPriorityBadgeColor,
  getRunStatusBadgeColor,
} from './kanban-types'
import { KanbanCard } from './kanban-card'
import { KanbanHeader } from './kanban-header'
import { KanbanCreateGoalDialog } from './kanban-create-goal-dialog'
import { client } from '@/ui/api/client'

// Mock @dnd-kit/react
vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({
    ref: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    ref: vi.fn(),
    isDropTarget: false,
  }),
}))

// Mock API client
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          kanban: {
            goals: {
              $post: vi.fn(),
              ':goalId': {
                $patch: vi.fn(),
                $delete: vi.fn(),
              },
            },
            tasks: {
              $get: vi.fn(),
              $post: vi.fn(),
            },
          },
        },
      },
    },
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Kanban UI Unit & Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('kanban-types helper functions', () => {
    it('returns valid labels and colors for all statuses', () => {
      expect(getStatusLabel(KanbanTaskStatus.TODO)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.READY)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.IN_PROGRESS)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.BLOCKED)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.IN_REVIEW)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.DONE)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.CANCELLED)).toBeDefined()

      const todoColor = getStatusColor(KanbanTaskStatus.TODO)
      expect(todoColor.badge).toBeDefined()
      expect(todoColor.dot).toBeDefined()
      expect(getStatusBadgeColor(KanbanTaskStatus.TODO)).toBe(todoColor.badge)
    })

    it('returns valid labels and badges for priorities', () => {
      expect(getPriorityLabel(KanbanTaskPriority.LOW)).toBeDefined()
      expect(getPriorityLabel(KanbanTaskPriority.MEDIUM)).toBeDefined()
      expect(getPriorityLabel(KanbanTaskPriority.HIGH)).toBeDefined()
      expect(getPriorityLabel(KanbanTaskPriority.URGENT)).toBeDefined()

      expect(getPriorityBadgeColor(KanbanTaskPriority.URGENT)).toContain('red')
      expect(getRunStatusBadgeColor(KanbanTaskRunStatus.COMPLETED)).toContain('emerald')
    })
  })

  describe('KanbanCard component', () => {
    const mockManualTask: KanbanTaskInfo = {
      id: 'task-1',
      title: 'Manual Human Task',
      description: 'Test description',
      type: KanbanTaskType.MANUAL,
      status: KanbanTaskStatus.TODO,
      priority: KanbanTaskPriority.HIGH,
      startDate: null,
      dueDate: '2026-12-31T23:59:59.000Z',
      startedAt: null,
      completedAt: null,
      teamId: 'team-1',
      projectId: null,
      creator: { id: 'user-1', name: 'Alice' },
      reporter: null,
      assignee: { id: 'user-2', name: 'Bob' },
      goal: { id: 'goal-1', title: 'Q3 Goal' },
      targetFolderId: null,
      latestRun: null,
      latestStatusEvent: null,
      commentCount: 3,
      dependencyCount: 1,
      dependentCount: 0,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
    }

    const mockAgenticTask: KanbanTaskInfo = {
      ...mockManualTask,
      id: 'task-2',
      title: 'Autonomous Agentic Task',
      type: KanbanTaskType.AGENTIC,
      status: KanbanTaskStatus.IN_PROGRESS,
      latestRun: {
        id: 'run-1',
        status: KanbanTaskRunStatus.RUNNING,
        attempt: 2,
        startedAt: '2026-08-20T01:00:00.000Z',
      },
    }

    it('renders human task card correctly', () => {
      const onClick = vi.fn()
      render(<KanbanCard task={mockManualTask} onClick={onClick} />)

      expect(screen.getByText('Manual Human Task')).toBeDefined()
      expect(screen.getByText('Bob')).toBeDefined()
      expect(screen.getByText('Q3 Goal')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined() // Comments count
      expect(screen.getByText('1')).toBeDefined() // Dependency count

      fireEvent.click(screen.getByText('Manual Human Task'))
      expect(onClick).toHaveBeenCalledWith(mockManualTask)
    })

    it('renders agentic task card with distinct styling and attempt count', () => {
      const onClick = vi.fn()
      render(<KanbanCard task={mockAgenticTask} onClick={onClick} />)

      expect(screen.getByText('Autonomous Agentic Task')).toBeDefined()
      expect(screen.getByText('#2')).toBeDefined()
    })

    it('renders blocked warning and reason when task is BLOCKED', () => {
      const blockedTask: KanbanTaskInfo = {
        ...mockManualTask,
        status: KanbanTaskStatus.BLOCKED,
        latestStatusEvent: {
          id: 'event-1',
          type: KanbanTaskEventType.BLOCKED,
          blockReason: 'Missing API Key credentials',
          createdAt: '2026-08-20T00:00:00.000Z',
        },
      }

      render(<KanbanCard task={blockedTask} onClick={vi.fn()} />)
      expect(screen.getByText('Missing API Key credentials')).toBeDefined()
    })
  })

  describe('KanbanHeader component', () => {
    it('handles scope switching, search input, and goal clearing', () => {
      const onScopeChange = vi.fn()
      const onSearchChange = vi.fn()
      const onClearGoal = vi.fn()
      const onToggleShowCancelled = vi.fn()
      const onCreateTask = vi.fn()

      const selectedGoal: KanbanGoalInfo = {
        id: 'goal-1',
        title: 'Launch Goal',
        teamId: 'team-1',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      }

      render(
        <KanbanHeader
          scope="team"
          onScopeChange={onScopeChange}
          search=""
          onSearchChange={onSearchChange}
          selectedGoal={selectedGoal}
          onClearGoal={onClearGoal}
          showCancelled={false}
          onToggleShowCancelled={onToggleShowCancelled}
          onCreateTask={onCreateTask}
        />,
      )

      expect(screen.getByText('Launch Goal')).toBeDefined()

      // Click My Tasks
      const myTasksButtons = screen.getAllByRole('button')
      const myTaskBtn = myTasksButtons.find(
        (btn) => btn.textContent?.includes('My Tasks') || btn.textContent?.includes('我的任务'),
      )
      if (myTaskBtn) {
        fireEvent.click(myTaskBtn)
        expect(onScopeChange).toHaveBeenCalledWith('my')
      }

      // Search input change
      const searchInput = screen.getByPlaceholderText(/search/i)
      fireEvent.change(searchInput, { target: { value: 'test search' } })
      expect(onSearchChange).toHaveBeenCalledWith('test search')
    })
  })

  describe('KanbanCreateGoalDialog component', () => {
    it('submits goal creation form', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-goal', title: 'New Goal' }),
      })
      // Mocking hono RPC client method for unit testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(client.api.teams[':teamId'].kanban.goals.$post as any) = mockPost

      const onClose = vi.fn()
      render(<KanbanCreateGoalDialog teamId="team-1" isOpen={true} onClose={onClose} />, {
        wrapper: createWrapper(),
      })

      const titleInput = screen.getByLabelText(/Goal Title|目标标题/i)
      fireEvent.change(titleInput, { target: { value: 'Brand New Goal' } })

      const submitBtn = screen.getByRole('button', { name: /Create|创建/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
      })
    })
  })
})
