// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CommentInfo } from '@shumai/dtos'
import { MessageCard } from './message-card'

import { client } from '@/ui/api/client'

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          me: {
            $get: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ id: 'u-1', name: 'Bob Reviewer', role: 'member' }),
            }),
          },
        },
      },
      projects: {
        ':projectId': {
          attachments: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({
                id: 'att-new-asset',
                uploadUrl: 'https://upload.example.com/new.txt',
              }),
            }),
          },
        },
      },
      comments: {
        ':commentId': {
          complete: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ isCompleted: true }),
            }),
          },
          reactions: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ success: true }),
            }),
            $delete: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ success: true }),
            }),
          },
          $patch: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'msg-edit', message: 'Updated text', isInternal: true }),
          }),
          $delete: vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
          }),
        },
      },
    },
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('MessageCard component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders message text and attachment rows with 2x height for image and standard height for other files', () => {
    const mockMessage: CommentInfo = {
      id: 'msg-1',
      assetId: 'asset-1',
      message: 'Here is the feedback on design',
      annotations: null,
      second: null,
      creator: { id: 'u-1', name: 'Bob Reviewer' },
      replies: [],
      attachments: [
        {
          id: 'att-img-1',
          assetId: 'asset-1',
          url: 'https://example.com/screenshot.png?AWSAccessKeyId=123',
          proxyType: null,
        },
        {
          id: 'att-doc-2',
          assetId: 'asset-1',
          url: 'https://example.com/notes.pdf?AWSAccessKeyId=123',
          proxyType: null,
        },
        {
          id: 'att-psd-3',
          assetId: 'asset-1',
          url: 'https://example.com/mockup.psd',
          proxyType: null,
        },
      ],
      mentions: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: false,
      completionLastChangedBy: null,
      reactionCounts: [],
    }

    const onReply = vi.fn()
    const getUser = vi.fn().mockReturnValue({ id: 'u-1', name: 'Bob Reviewer' })

    render(<MessageCard message={mockMessage} getUser={getUser} onReply={onReply} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Here is the feedback on design')).toBeDefined()
    expect(screen.getByText('screenshot.png')).toBeDefined()
    expect(screen.getByText('notes.pdf')).toBeDefined()
    expect(screen.getByText('mockup.psd')).toBeDefined()

    // Verify row height classes: image row is h-18 (72px), file row is h-9 (36px)
    const imgEl = screen.getByAltText('screenshot.png')
    const imgRow = imgEl.closest('.group')
    expect(imgRow?.className).toContain('h-18')

    const fileEl = screen.getByText('notes.pdf')
    const fileRow = fileEl.closest('.group')
    expect(fileRow?.className).toContain('h-9')

    // PSD should NOT be an image row (web browsers cannot render PSD in <img>)
    const psdEl = screen.getByText('mockup.psd')
    const psdRow = psdEl.closest('.group')
    expect(psdRow?.className).toContain('h-9')

    // Clicking image row opens image preview dialog
    fireEvent.click(imgRow!)
    expect(screen.getAllByAltText('screenshot.png').length).toBeGreaterThanOrEqual(2)

    // Clicking file row opens URL in a new tab
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    fireEvent.click(fileRow!)
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/notes.pdf?AWSAccessKeyId=123',
      '_blank',
      'noreferrer',
    )
    windowOpenSpy.mockRestore()
  })

  it('renders reaction badges with active and inactive styling and toggles on click', async () => {
    const mockMessage: CommentInfo = {
      id: 'msg-reactions',
      assetId: 'asset-1',
      message: 'Great work!',
      annotations: null,
      second: null,
      creator: { id: 'u-2', name: 'Alice' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: false,
      completionLastChangedBy: null,
      reactionCounts: [
        {
          code: '👍',
          count: 2,
          requestingUserReacted: true,
          creatorNames: ['Bob'],
        },
        {
          code: '❤️',
          count: 1,
          requestingUserReacted: false,
          creatorNames: ['Charlie'],
        },
      ],
    }

    const onReply = vi.fn()
    const getUser = vi.fn().mockReturnValue({ id: 'u-2', name: 'Alice' })

    render(<MessageCard message={mockMessage} getUser={getUser} onReply={onReply} />, {
      wrapper: createWrapper(),
    })

    // Both emoji badges are rendered with their counts
    const thumbsUpBadge = screen.getByText('👍').closest('button')
    const heartBadge = screen.getByText('❤️').closest('button')

    expect(thumbsUpBadge).toBeDefined()
    expect(heartBadge).toBeDefined()

    // Active badge (requestingUserReacted = true) has primary border/bg style
    expect(thumbsUpBadge?.className).toContain('border-primary/40')
    expect(thumbsUpBadge?.className).toContain('bg-primary/10')

    // Inactive badge (requestingUserReacted = false) has border-border/60 style
    expect(heartBadge?.className).toContain('border-border/60')

    // Both badges display count with normal text color (text-foreground)
    expect(screen.getByText('2').className).toContain('text-foreground')
    expect(screen.getByText('1').className).toContain('text-foreground')

    // Clicking thumbsUp badge (already reacted) calls DELETE reaction
    fireEvent.click(thumbsUpBadge!)
    await waitFor(() => {
      expect(client.api.comments[':commentId'].reactions.$delete).toHaveBeenCalledWith({
        param: { commentId: 'msg-reactions' },
        json: { code: '👍' },
      })
    })

    // Clicking heart badge (not yet reacted) calls POST reaction
    fireEvent.click(heartBadge!)
    await waitFor(() => {
      expect(client.api.comments[':commentId'].reactions.$post).toHaveBeenCalledWith({
        param: { commentId: 'msg-reactions' },
        json: { code: '❤️' },
      })
    })
  })

  it('hides reaction picker and disables badges when readOnly is true', () => {
    const mockMessage: CommentInfo = {
      id: 'msg-readonly',
      assetId: 'asset-1',
      message: 'Read only message',
      annotations: null,
      second: null,
      creator: { id: 'u-2', name: 'Alice' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: false,
      completionLastChangedBy: null,
      reactionCounts: [
        {
          code: '🎉',
          count: 1,
          requestingUserReacted: false,
          creatorNames: ['Bob'],
        },
      ],
    }

    const onReply = vi.fn()
    const getUser = vi.fn().mockReturnValue({ id: 'u-2', name: 'Alice' })

    render(
      <MessageCard message={mockMessage} getUser={getUser} onReply={onReply} readOnly={true} />,
      {
        wrapper: createWrapper(),
      },
    )

    const partyBadge = screen.getByText('🎉').closest('button')
    expect(partyBadge?.getAttribute('disabled')).not.toBeNull()

    // Clicking does not call API
    fireEvent.click(partyBadge!)
    expect(client.api.comments[':commentId'].reactions.$post).not.toHaveBeenCalled()
  })

  it('displays lock icon for internal comments and hides it for public comments', () => {
    const baseMessage: CommentInfo = {
      id: 'msg-internal',
      assetId: 'asset-1',
      message: 'Private review note',
      annotations: null,
      second: null,
      creator: { id: 'u-1', name: 'Bob Reviewer' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: true,
      completionLastChangedBy: null,
      reactionCounts: [],
    }

    const { rerender } = render(
      <MessageCard
        teamId="team-1"
        projectId="proj-1"
        message={baseMessage}
        getUser={() => ({ id: 'u-1', name: 'Bob Reviewer', role: 'reviewer' })}
        onReply={vi.fn()}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByTestId('internal-comment-icon')).toBeDefined()

    rerender(
      <MessageCard
        teamId="team-1"
        projectId="proj-1"
        message={{ ...baseMessage, isInternal: false }}
        getUser={() => ({ id: 'u-1', name: 'Bob Reviewer', role: 'reviewer' })}
        onReply={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('internal-comment-icon')).toBeNull()
  })

  it('allows author to edit text (preserving mentions), remove timestamp, remove attachment, toggle internal, and save', async () => {
    const mockMessage: CommentInfo = {
      id: 'msg-edit',
      assetId: 'asset-1',
      message: 'Hey <@u-2> check this frame',
      annotations: null,
      second: 5,
      creator: { id: 'u-1', name: 'Bob Reviewer' },
      replies: [],
      attachments: [
        {
          id: 'join-1',
          assetId: 'att-asset-1',
          url: 'https://example.com/spec.pdf',
          proxyType: null,
        },
        {
          id: 'join-2',
          assetId: 'att-asset-2',
          url: 'https://example.com/keep.png',
          proxyType: 'image',
        },
      ],
      mentions: [{ id: 'u-2', name: 'Alice' }],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: false,
      completionLastChangedBy: null,
      reactionCounts: [],
    }

    render(
      <MessageCard
        teamId="team-1"
        projectId="proj-1"
        message={mockMessage}
        frameRate={30}
        getUser={(id) =>
          id === 'u-2'
            ? { id: 'u-2', name: 'Alice', role: 'editor' }
            : { id, name: 'Unknown', role: 'unknown' }
        }
        onReply={vi.fn()}
      />,
      { wrapper: createWrapper() },
    )

    // Wait for team me query so author menu renders
    const moreBtn = await screen.findByRole('button', { name: /more options/i })
    fireEvent.pointerDown(moreBtn)
    fireEvent.click(moreBtn)

    const editMenuItem = await screen.findByText('Edit')
    fireEvent.click(editMenuItem)

    // Edit form should appear with hydrated mention chip, timestamp badge, and 2 attachments
    expect(screen.getByTestId('comment-edit-form')).toBeDefined()
    const mentionSpan = document.querySelector(
      '[data-testid="edit-comment-input"] span[data-type="mention"]',
    )
    expect(mentionSpan?.getAttribute('data-id')).toBe('u-2')
    expect(mentionSpan?.textContent).toBe('@Alice')

    // Remove timestamp
    fireEvent.click(screen.getByTestId('edit-comment-remove-timestamp'))
    expect(screen.queryByTestId('edit-comment-timestamp')).toBeNull()

    // Remove first attachment
    fireEvent.click(screen.getByTestId('edit-remove-attachment-att-asset-1'))
    expect(screen.getAllByTestId('edit-existing-attachment')).toHaveLength(1)

    // Toggle Public -> Internal
    const visTrigger = screen.getByTestId('comment-visibility-trigger')
    fireEvent.pointerDown(visTrigger)
    fireEvent.click(visTrigger)
    fireEvent.click(await screen.findByTestId('comment-visibility-internal'))

    // Save
    fireEvent.click(screen.getByTestId('edit-comment-save'))

    await waitFor(() => {
      expect(client.api.comments[':commentId'].$patch).toHaveBeenCalledWith({
        param: { commentId: 'msg-edit' },
        json: {
          message: 'Hey <@u-2> check this frame',
          isInternal: true,
          second: null,
          attachmentIds: ['att-asset-2'],
        },
      })
    })
  })

  it('does not show Edit menu item to non-author even if they are team owner', async () => {
    vi.mocked(client.api.teams[':teamId'].me.$get).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u-owner', name: 'Owner', role: 'owner' }),
    } as never)

    const mockMessage: CommentInfo = {
      id: 'msg-other',
      assetId: 'asset-1',
      message: 'Another user comment',
      annotations: null,
      second: null,
      creator: { id: 'u-1', name: 'Bob Reviewer' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: false,
      completionLastChangedBy: null,
      reactionCounts: [],
    }

    render(
      <MessageCard
        teamId="team-1"
        projectId="proj-1"
        message={mockMessage}
        getUser={() => ({ id: 'u-1', name: 'Bob Reviewer', role: 'reviewer' })}
        onReply={vi.fn()}
      />,
      { wrapper: createWrapper() },
    )

    const moreBtn = await screen.findByRole('button', { name: /more options/i })
    fireEvent.pointerDown(moreBtn)
    fireEvent.click(moreBtn)

    await screen.findByText('Delete')
    expect(screen.queryByText('Edit')).toBeNull()
  })
})
