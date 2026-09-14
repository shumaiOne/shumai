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
})
