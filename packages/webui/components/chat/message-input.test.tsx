// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CommentInfo } from '@shumai/dtos'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { ChatInput } from './message-input'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('ChatInput auto-mention on reply', () => {
  beforeEach(() => {
    useTeamContextStore.setState({
      teamId: 'team-123',
      projectTeamMap: { 'proj-1': 'team-123' },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('automatically inserts creator mention when replyingTo is set', () => {
    const mockComment: CommentInfo = {
      id: 'comment-1',
      assetId: 'asset-1',
      message: 'Initial feedback',
      annotations: null,
      second: null,
      creator: { id: 'user-alice', name: 'Alice Smith' },
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

    const onSendMessage = vi.fn()

    const { rerender } = render(
      <ChatInput projectId="proj-1" onSendMessage={onSendMessage} replyingTo={null} />,
      { wrapper: createWrapper() },
    )

    // Set replyingTo
    rerender(
      <ChatInput projectId="proj-1" onSendMessage={onSendMessage} replyingTo={mockComment} />,
    )

    // Check that mention node is inserted in contentEditable
    const mentionSpan = document.querySelector('span[data-type="mention"]')
    expect(mentionSpan).not.toBeNull()
    expect(mentionSpan?.getAttribute('data-id')).toBe('user-alice')
    expect(mentionSpan?.textContent).toBe('@Alice Smith')

    // Click send and verify serialized text contains <@user-alice>
    const sendButton = document.querySelector('button .lucide-arrow-up')?.closest('button')
    expect(sendButton).toBeTruthy()
    fireEvent.click(sendButton as HTMLButtonElement)

    expect(onSendMessage).toHaveBeenCalledWith('<@user-alice>', [], [], 'comment-1', undefined, [])
  })

  it('does not insert mention if disableMentions is true', () => {
    const mockComment: CommentInfo = {
      id: 'comment-1',
      assetId: 'asset-1',
      message: 'Initial feedback',
      annotations: null,
      second: null,
      creator: { id: 'user-alice', name: 'Alice Smith' },
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

    const onSendMessage = vi.fn()

    render(
      <ChatInput
        projectId="proj-1"
        onSendMessage={onSendMessage}
        replyingTo={mockComment}
        disableMentions={true}
      />,
      { wrapper: createWrapper() },
    )

    const mentionSpan = document.querySelector('span[data-type="mention"]')
    expect(mentionSpan).toBeNull()
  })

  it('updates mention when replyingTo switches to a different comment author', () => {
    const commentAlice: CommentInfo = {
      id: 'comment-1',
      assetId: 'asset-1',
      message: 'Alice note',
      annotations: null,
      second: null,
      creator: { id: 'user-alice', name: 'Alice Smith' },
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

    const commentBob: CommentInfo = {
      id: 'comment-2',
      assetId: 'asset-1',
      message: 'Bob note',
      annotations: null,
      second: null,
      creator: { id: 'user-bob', name: 'Bob Jones' },
      replies: [],
      attachments: [],
      mentions: [],
      createdAt: '2026-08-20T10:31:00.000Z',
      updatedAt: '2026-08-20T10:31:00.000Z',
      sessionId: null,
      isCompleted: false,
      isInternal: false,
      completionLastChangedBy: null,
      reactionCounts: [],
    }

    const onSendMessage = vi.fn()

    const { rerender } = render(
      <ChatInput projectId="proj-1" onSendMessage={onSendMessage} replyingTo={commentAlice} />,
      { wrapper: createWrapper() },
    )

    let mentionSpans = document.querySelectorAll('span[data-type="mention"]')
    expect(mentionSpans).toHaveLength(1)
    expect(mentionSpans[0].getAttribute('data-id')).toBe('user-alice')

    // Switch to Bob's comment
    rerender(<ChatInput projectId="proj-1" onSendMessage={onSendMessage} replyingTo={commentBob} />)

    mentionSpans = document.querySelectorAll('span[data-type="mention"]')
    expect(mentionSpans).toHaveLength(2)
    expect(mentionSpans[1].getAttribute('data-id')).toBe('user-bob')
  })

  it('hides visibility selector when allowInternalComments is false', () => {
    const onSendMessage = vi.fn()
    render(<ChatInput projectId="proj-1" onSendMessage={onSendMessage} />, {
      wrapper: createWrapper(),
    })

    expect(document.querySelector('[data-testid="comment-visibility-trigger"]')).toBeNull()
  })

  it('defaults to Public, switches to Internal via dropdown pill, and resets after send', () => {
    const onSendMessage = vi.fn()
    render(
      <ChatInput projectId="proj-1" onSendMessage={onSendMessage} allowInternalComments={true} />,
      { wrapper: createWrapper() },
    )

    const trigger = document.querySelector(
      '[data-testid="comment-visibility-trigger"]',
    ) as HTMLButtonElement
    expect(trigger).not.toBeNull()
    expect(trigger.textContent).toContain('Public')

    // Open dropdown and choose Internal
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    const internalOption = document.querySelector(
      '[data-testid="comment-visibility-internal"]',
    ) as HTMLElement
    expect(internalOption).not.toBeNull()
    fireEvent.click(internalOption)

    expect(trigger.textContent).toContain('Internal')

    // Type message and send
    const editor = document.querySelector('[contenteditable="true"]') as HTMLDivElement
    editor.innerText = 'Internal discussion'
    fireEvent.input(editor)

    const sendButton = document.querySelector('button .lucide-arrow-up')?.closest('button')
    fireEvent.click(sendButton as HTMLButtonElement)

    expect(onSendMessage).toHaveBeenCalledWith(
      'Internal discussion',
      [],
      [],
      undefined,
      undefined,
      [],
      true,
    )
    // Resets back to Public default after send
    expect(trigger.textContent).toContain('Public')
  })

  it('locks visibility to Internal when replying to an internal comment', () => {
    const internalComment: CommentInfo = {
      id: 'comment-int',
      assetId: 'asset-1',
      message: 'Private thread',
      annotations: null,
      second: null,
      creator: { id: 'user-alice', name: 'Alice Smith' },
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

    const onSendMessage = vi.fn()
    render(
      <ChatInput
        projectId="proj-1"
        onSendMessage={onSendMessage}
        replyingTo={internalComment}
        allowInternalComments={true}
      />,
      { wrapper: createWrapper() },
    )

    const trigger = document.querySelector(
      '[data-testid="comment-visibility-trigger"]',
    ) as HTMLButtonElement
    expect(trigger).not.toBeNull()
    expect(trigger.textContent).toContain('Internal')
    expect(trigger.disabled).toBe(true)

    const sendButton = document.querySelector('button .lucide-arrow-up')?.closest('button')
    fireEvent.click(sendButton as HTMLButtonElement)

    expect(onSendMessage).toHaveBeenCalledWith(
      '<@user-alice>',
      [],
      [],
      'comment-int',
      undefined,
      [],
      true,
    )
  })
})
