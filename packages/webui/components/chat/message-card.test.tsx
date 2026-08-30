// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CommentInfo } from '@shumai/dtos'
import { MessageCard } from './message-card'

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
    }

    const onViewAttachment = vi.fn()
    const onReply = vi.fn()
    const getUser = vi.fn().mockReturnValue({ id: 'u-1', name: 'Bob Reviewer' })

    render(
      <MessageCard
        message={mockMessage}
        getUser={getUser}
        onReply={onReply}
        onViewAttachment={onViewAttachment}
      />,
      { wrapper: createWrapper() },
    )

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

    // Clicking image row triggers onViewAttachment
    fireEvent.click(imgRow!)
    expect(onViewAttachment).toHaveBeenCalledWith(mockMessage.attachments[0])

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
})
