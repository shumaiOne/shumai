// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FileBrowserToolbar } from './toolbar'

const mockCanEdit = vi.fn().mockReturnValue(true)

vi.mock('@/ui/hooks/use-permissions', () => ({
  usePermissions: () => ({
    canEdit: mockCanEdit(),
    canAdmin: true,
    role: 'owner',
  }),
}))

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      folders: {
        ':folderId': {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'f-1', name: 'Folder 1', hasAgentsMd: false }),
          }),
        },
      },
      fields: {
        ':fieldId': {
          $put: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
          $delete: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
        },
      },
      teams: {
        ':teamId': {
          members: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => [],
            }),
          },
        },
      },
      projects: {
        ':projectId': {
          fields: {
            $post: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
            order: {
              $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
            },
          },
          members: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => [],
            }),
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({}),
            }),
            ':userId': {
              $patch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
              $delete: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
            },
          },
          team: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ id: 't-1' }),
            }),
          },
          me: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ role: 'owner' }),
            }),
          },
          invite: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ inviteLink: '' }),
            }),
          },
        },
      },
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('FileBrowserToolbar - Plus Button', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    mockCanEdit.mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const defaultProps = {
    teamId: 'team-1',
    projectId: 'proj-1',
    assetId: 'folder-root',
    fields: [],
    filterConditions: [],
    onFilterChange: vi.fn(),
    onSortChange: vi.fn(),
  }

  it('renders plus button with hidden md:inline-flex and triggers actions from dropdown', async () => {
    const onNewFolder = vi.fn()
    const onUploadFile = vi.fn()
    const onUploadFolder = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <FileBrowserToolbar
          {...defaultProps}
          onNewFolder={onNewFolder}
          onUploadFile={onUploadFile}
          onUploadFolder={onUploadFolder}
        />
      </QueryClientProvider>,
    )

    const addButton = screen.getByRole('button', { name: /Add/i })
    expect(addButton).toBeDefined()
    expect(addButton.className).toContain('hidden')
    expect(addButton.className).toContain('md:inline-flex')

    // Click plus button to open dropdown menu
    fireEvent.pointerDown(addButton, { button: 0, ctrlKey: false })

    // Verify menu items appear
    const uploadFileItem = screen.getByText('Upload File')
    const uploadFolderItem = screen.getByText('Upload Folder')
    const newFolderItem = screen.getByText('New Folder')
    expect(uploadFileItem).toBeDefined()
    expect(uploadFolderItem).toBeDefined()
    expect(newFolderItem).toBeDefined()

    // Trigger actions
    fireEvent.click(uploadFileItem)
    expect(onUploadFile).toHaveBeenCalledTimes(1)

    // Re-open menu for upload folder
    fireEvent.pointerDown(addButton, { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByText('Upload Folder'))
    expect(onUploadFolder).toHaveBeenCalledTimes(1)

    // Re-open menu for new folder
    fireEvent.pointerDown(addButton, { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByText('New Folder'))
    expect(onNewFolder).toHaveBeenCalledTimes(1)
  })

  it('does not render plus button for reviewers (canEdit is false)', () => {
    mockCanEdit.mockReturnValue(false)

    render(
      <QueryClientProvider client={queryClient}>
        <FileBrowserToolbar {...defaultProps} />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button', { name: /Add/i })).toBeNull()
  })

  it('does not render plus button in recently deleted view', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FileBrowserToolbar {...defaultProps} isRecentlyDeleted />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button', { name: /Add/i })).toBeNull()
  })

  it('does not render plus button in recents view', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FileBrowserToolbar {...defaultProps} isRecents />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button', { name: /Add/i })).toBeNull()
  })
})
