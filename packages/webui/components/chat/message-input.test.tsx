// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatInput } from './message-input'
import { useMemberStore } from '@/ui/stores/members'

describe('ChatInput mention navigation', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('selects the correct member item when the Agents section is collapsed', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    useMemberStore.setState({
      members: [
        { id: 'agent-1', name: 'Bot Alice', type: 'agent', role: 'bot' },
        { id: 'agent-2', name: 'Bot Bob', type: 'agent', role: 'bot' },
        { id: 'user-1', name: 'Carol Human', type: 'human', role: 'editor' },
        { id: 'user-2', name: 'David Human', type: 'human', role: 'editor' },
      ],
      loading: false,
      fetchMembers: vi.fn(),
      fetchProjectMembers: vi.fn(),
    })

    const mockSendMessage = vi.fn()

    const { container, getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ChatInput projectId="proj-1" allowMentions={true} onSendMessage={mockSendMessage} />
      </QueryClientProvider>,
    )

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editor).toBeTruthy()

    // Type @ and set cursor selection in DOM
    const textNode = document.createTextNode('@')
    editor.appendChild(textNode)
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.setEnd(textNode, 1)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    fireEvent.input(editor)

    // Mention list should appear with Agents and Members headers
    expect(getByText('Agents')).toBeTruthy()
    expect(getByText('Members')).toBeTruthy()

    // Collapse the Agents section
    const agentsHeaderBtn = getByText('Agents').closest('button')!
    fireEvent.click(agentsHeaderBtn)

    // Agents should no longer be rendered, but Members should be visible
    expect(screen.queryByText('Bot Alice')).toBeNull()
    const carolBtn = getByText('Carol Human').closest('button')!
    expect(carolBtn).toBeTruthy()

    // Carol Human should have data-index="0" because bots are collapsed
    expect(carolBtn.getAttribute('data-index')).toBe('0')

    // Hover over Carol Human
    fireEvent.mouseEnter(carolBtn)

    // Press Enter to select Carol Human
    fireEvent.keyDown(editor, { key: 'Enter' })

    // Editor should now contain the mention badge for Carol Human (user-1)
    const mentionNode = editor.querySelector('[data-type="mention"]') as HTMLElement
    expect(mentionNode).toBeTruthy()
    expect(mentionNode.dataset.id).toBe('user-1')
    expect(mentionNode.textContent).toContain('Carol Human')
  })

  it('navigates with ArrowDown and ArrowUp after clicking to collapse the Agents section', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    useMemberStore.setState({
      members: [
        { id: 'agent-1', name: 'Bot Alice', type: 'agent', role: 'bot' },
        { id: 'agent-2', name: 'Bot Bob', type: 'agent', role: 'bot' },
        { id: 'user-1', name: 'Carol Human', type: 'human', role: 'editor' },
        { id: 'user-2', name: 'David Human', type: 'human', role: 'editor' },
      ],
      loading: false,
      fetchMembers: vi.fn(),
      fetchProjectMembers: vi.fn(),
    })

    const mockSendMessage = vi.fn()

    const { container, getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ChatInput projectId="proj-1" allowMentions={true} onSendMessage={mockSendMessage} />
      </QueryClientProvider>,
    )

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editor).toBeTruthy()

    // Type @ and set cursor selection
    const textNode = document.createTextNode('@')
    editor.appendChild(textNode)
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.setEnd(textNode, 1)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    fireEvent.input(editor)

    // Click collapse on Agents
    const agentsHeaderBtn = getByText('Agents').closest('button')!
    fireEvent.mouseDown(agentsHeaderBtn)
    fireEvent.click(agentsHeaderBtn)

    // Now press ArrowDown on editor to move from item 0 (Carol) to item 1 (David)
    fireEvent.keyDown(editor, { key: 'ArrowDown' })

    const davidBtn = getByText('David Human').closest('button')!
    expect(davidBtn.className).toContain('bg-accent')

    // Press Enter to select David
    fireEvent.keyDown(editor, { key: 'Enter' })

    const mentionNode = editor.querySelector('[data-type="mention"]') as HTMLElement
    expect(mentionNode).toBeTruthy()
    expect(mentionNode.dataset.id).toBe('user-2')
    expect(mentionNode.textContent).toContain('David Human')
  })
})

describe('ChatInput paste handling', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('pastes plain text only and strips HTML formatting when styled HTML is in clipboard', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockSendMessage = vi.fn()
    const mockChangeText = vi.fn()

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ChatInput
          projectId="proj-1"
          onSendMessage={mockSendMessage}
          onChangeText={mockChangeText}
        />
      </QueryClientProvider>,
    )

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editor).toBeTruthy()

    // Focus editor and set selection
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    // Simulate pasting HTML with plain text fallback
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (format: string) => {
          if (format === 'text/plain') return 'Clean plain text'
          if (format === 'text/html')
            return '<span style="color: red; font-size: 24px;"><b>Clean plain text</b></span>'
          return ''
        },
      },
    })

    expect(editor.innerHTML).not.toContain('<span')
    expect(editor.innerHTML).not.toContain('style=')
    expect(editor.textContent).toBe('Clean plain text')
    expect(mockChangeText).toHaveBeenCalledWith('Clean plain text')

    // Press Enter to send
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(mockSendMessage).toHaveBeenCalledWith(
      'Clean plain text',
      [],
      [],
      undefined,
      undefined,
      [],
    )
  })

  it('preserves multiple lines when multiline text is pasted', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockSendMessage = vi.fn()

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ChatInput projectId="proj-1" onSendMessage={mockSendMessage} />
      </QueryClientProvider>,
    )

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    expect(editor).toBeTruthy()

    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    const multilineText = 'First line\nSecond line\nThird line'

    fireEvent.paste(editor, {
      clipboardData: {
        getData: (format: string) => {
          if (format === 'text/plain') return multilineText
          return `<p>First line</p><p>Second line</p><p>Third line</p>`
        },
      },
    })

    expect(editor.textContent).toBe(multilineText)

    // Send message and verify multiline content is preserved in onSendMessage
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(mockSendMessage).toHaveBeenCalledWith(multilineText, [], [], undefined, undefined, [])
  })
})
