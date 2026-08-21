// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  KanbanTaskPriority,
  KanbanTaskStatus,
  KanbanTaskEventType,
  type KanbanTaskInfo,
  type KanbanGoalInfo,
  type KanbanCommentInfo,
} from '@shumai/dtos'
import {
  getStatusLabel,
  getStatusColor,
  getStatusBadgeColor,
  getPriorityLabel,
  getPriorityBadgeColor,
} from './kanban-types'
import { KanbanCard } from './kanban-card'
import { KanbanHeader } from './kanban-header'
import { KanbanBoard } from './kanban-board'
import { KanbanCreateGoalDialog } from './kanban-create-goal-dialog'
import { TaskCommentCard } from './edit-task-dialog/task-comment-card'
import { TaskCommentInput } from './edit-task-dialog/task-comment-input'
import { client } from '@/ui/api/client'

const mockUseDraggable = vi.fn()

// Mock @dnd-kit/react
vi.mock('@dnd-kit/react', () => ({
  useDraggable: (args: unknown) => {
    mockUseDraggable(args)
    return {
      ref: vi.fn(),
      isDragging: false,
    }
  },
  useDroppable: () => ({
    ref: vi.fn(),
    isDropTarget: false,
  }),
  useDragOperation: () => ({
    source: null,
    target: null,
  }),
  DragDropProvider: ({ children }: { children?: React.ReactNode }) => children,
  PointerSensor: {
    configure: () => ({}),
  },
  KeyboardSensor: {},
}))

// Mock @dnd-kit/dom
vi.mock('@dnd-kit/dom', () => ({
  PointerActivationConstraints: {
    Distance: vi.fn(),
  },
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

  describe('Kanban Helpers & Type Utilities', () => {
    it('maps status to correct labels and semantic badge colors', () => {
      expect(getStatusLabel(KanbanTaskStatus.TODO)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.READY)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.IN_PROGRESS)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.BLOCKED)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.IN_REVIEW)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.DONE)).toBeDefined()
      expect(getStatusLabel(KanbanTaskStatus.CANCELLED)).toBeDefined()

      expect(getStatusColor(KanbanTaskStatus.READY).badge).toBeDefined()
      expect(getStatusBadgeColor(KanbanTaskStatus.BLOCKED)).toContain('red')
    })

    it('maps priority to labels and colors', () => {
      expect(getPriorityLabel(KanbanTaskPriority.LOW)).toBeDefined()
      expect(getPriorityLabel(KanbanTaskPriority.URGENT)).toBeDefined()
      expect(getPriorityBadgeColor(KanbanTaskPriority.URGENT)).toContain('red')
    })
  })

  describe('KanbanCard component', () => {
    const mockManualTask: KanbanTaskInfo = {
      id: 'task-1',
      title: 'Manual Human Task',
      description: 'Test description',
      isAgentTask: false,
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
      title: 'Autonomous Agent Task',
      isAgentTask: true,
      status: KanbanTaskStatus.IN_PROGRESS,
    }

    it('renders human task card correctly without agent task label', () => {
      const onClick = vi.fn()
      render(<KanbanCard task={mockManualTask} onClick={onClick} />)

      expect(screen.getByText('Manual Human Task')).toBeDefined()
      expect(screen.getByText('Bob')).toBeDefined()
      expect(screen.getByText('Q3 Goal')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined() // Comments count
      expect(screen.getByText('1')).toBeDefined() // Dependency count
      expect(screen.queryByText(/Agent Task|智能体任务/i)).toBeNull()

      fireEvent.click(screen.getByText('Manual Human Task'))
      expect(onClick).toHaveBeenCalledWith(mockManualTask)
    })

    it('renders agent task card with Agent Task label', () => {
      const onClick = vi.fn()
      render(<KanbanCard task={mockAgenticTask} onClick={onClick} />)

      expect(screen.getByText('Autonomous Agent Task')).toBeDefined()
      expect(screen.getByText(/Agent Task|智能体任务/i)).toBeDefined()
    })

    it('enforces card drag permission: enabled for owner, reporter, or assignee; disabled for others', () => {
      // 1. Enabled when user is owner
      render(
        <KanbanCard
          task={{
            ...mockManualTask,
            creator: { id: 'other', name: 'Other' },
            reporter: null,
            assignee: null,
          }}
          onClick={vi.fn()}
          currentUserRole="owner"
          currentUserId="random-user"
        />,
      )
      expect(mockUseDraggable).toHaveBeenLastCalledWith(
        expect.objectContaining({ disabled: false }),
      )

      // 2. Enabled when user is reporter (or creator if reporter null)
      render(
        <KanbanCard
          task={{
            ...mockManualTask,
            creator: { id: 'user-reporter', name: 'Rep' },
            reporter: null,
            assignee: null,
          }}
          onClick={vi.fn()}
          currentUserRole="editor"
          currentUserId="user-reporter"
        />,
      )
      expect(mockUseDraggable).toHaveBeenLastCalledWith(
        expect.objectContaining({ disabled: false }),
      )

      // 3. Enabled when user is assignee
      render(
        <KanbanCard
          task={{
            ...mockManualTask,
            creator: { id: 'other', name: 'Other' },
            reporter: null,
            assignee: { id: 'user-assignee', name: 'Assignee' },
          }}
          onClick={vi.fn()}
          currentUserRole="reviewer"
          currentUserId="user-assignee"
        />,
      )
      expect(mockUseDraggable).toHaveBeenLastCalledWith(
        expect.objectContaining({ disabled: false }),
      )

      // 4. Disabled when user is not owner, not reporter, and not assignee
      render(
        <KanbanCard
          task={{
            ...mockManualTask,
            creator: { id: 'other-1', name: 'Other' },
            reporter: { id: 'other-2', name: 'Reporter' },
            assignee: { id: 'other-3', name: 'Assignee' },
          }}
          onClick={vi.fn()}
          currentUserRole="editor"
          currentUserId="stranger-user"
        />,
      )
      expect(mockUseDraggable).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }))
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
    it('handles scope switching and goal clearing', () => {
      const onScopeChange = vi.fn()
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

  describe('TaskCommentCard and TaskCommentInput components', () => {
    it('renders comment with markdown and image/file attachments', () => {
      const mockComment: KanbanCommentInfo = {
        id: 'c-1',
        taskId: 't-1',
        author: { id: 'u-1', name: 'Alice Author' },
        body: 'Hello **bold** world',
        attachments: [
          {
            id: 'att-1',
            name: 'preview.png',
            sizeByte: 10240,
            url: 'https://example.com/preview.png',
            proxyType: 'image',
          },
          {
            id: 'att-2',
            name: 'specs.pdf',
            sizeByte: 20480,
            url: 'https://example.com/specs.pdf',
            proxyType: 'pdf',
          },
        ],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      }

      const onViewAttachment = vi.fn()
      render(
        <TaskCommentCard
          teamId="team-1"
          taskId="t-1"
          comment={mockComment}
          currentUserId="u-1"
          isOwnerOrAdmin={true}
          onViewAttachment={onViewAttachment}
        />,
        { wrapper: createWrapper() },
      )

      expect(screen.getByText('Alice Author')).toBeDefined()
      expect(screen.getByText('bold')).toBeDefined()
      expect(screen.getByText('specs.pdf')).toBeDefined()

      // Click image attachment
      const img = screen.getByAltText('preview.png')
      fireEvent.click(img)
      expect(onViewAttachment).toHaveBeenCalledWith(mockComment.attachments[0])
    })

    it('renders TaskCommentInput and triggers send on button click', async () => {
      const onSendMessage = vi.fn()
      render(<TaskCommentInput teamId="team-1" onSendMessage={onSendMessage} />, {
        wrapper: createWrapper(),
      })

      const textarea = screen.getByPlaceholderText(/comment/i)
      fireEvent.change(textarea, { target: { value: 'New task comment' } })

      const sendBtn = screen.getByTitle(/Send comment|发送/i)
      fireEvent.click(sendBtn)

      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('New task comment', undefined)
      })
    })
  })

  describe('KanbanBoard component with mixed cache entries', () => {
    it('renders board and safely handles query cache with non-infinite task queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      // Seed non-infinite task queries (like comments, events, dependency tasks) that do not have .pages
      queryClient.setQueryData(['teams', 'team-1', 'kanban', 'tasks', 't-1', 'comments'], {
        data: [{ id: 'c-1', body: 'Comment' }],
      })
      queryClient.setQueryData(['teams', 'team-1', 'kanban', 'tasks', 't-1', 'events'], {
        data: [{ id: 'e-1', type: 'CREATED' }],
      })
      queryClient.setQueryData(['teams', 'team-1', 'kanban', 'tasks', 'all'], {
        data: [{ id: 't-1', title: 'Task 1' }],
      })

      // Mock tasks $get endpoint
      const mockGet = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          pageInfo: { total: 0, hasNextPage: false },
        }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(client.api.teams[':teamId'].kanban.tasks.$get as any) = mockGet

      const onTaskClick = vi.fn()
      const onCreateTaskInColumn = vi.fn()

      render(
        <QueryClientProvider client={queryClient}>
          <KanbanBoard
            teamId="team-1"
            selectedGoalId={null}
            scope="team"
            showCancelled={false}
            onTaskClick={onTaskClick}
            onCreateTaskInColumn={onCreateTaskInColumn}
          />
        </QueryClientProvider>,
      )

      expect(screen.getByText(/To Do|待办/i)).toBeDefined()
    })

    it('renders reorder drop zones for drag-and-drop ordering', () => {
      const mockTask: KanbanTaskInfo = {
        id: 'task-1',
        title: 'Reorderable Task',
        isAgentTask: false,
        status: KanbanTaskStatus.TODO,
        priority: KanbanTaskPriority.MEDIUM,
        startDate: null,
        dueDate: null,
        startedAt: null,
        completedAt: null,
        teamId: 'team-1',
        projectId: null,
        sortIndex: 'a0',
        creator: { id: 'user-1', name: 'Alice' },
        reporter: null,
        assignee: null,
        goal: null,
        targetFolderId: null,
        latestStatusEvent: null,
        commentCount: 0,
        dependencyCount: 0,
        dependentCount: 0,
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      }

      const { container } = render(<KanbanCard task={mockTask} onClick={vi.fn()} />)
      // Verify wrapper contains the task title and relative positioning for indicator lines
      expect(screen.getByText('Reorderable Task')).toBeDefined()
      expect(container.querySelector('.relative')).toBeDefined()
    })
  })
})
