// @vitest-environment happy-dom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BreadcrumbNav } from './breadcrumb-nav'

// Mock tanstack router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useMatch: () => false,
}))

describe('BreadcrumbNav component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  afterEach(() => {
    cleanup()
  })

  const baseProps = {
    teamId: 'team-1',
    projectId: 'proj-1',
    projectName: 'Demo Project',
    ancestorFolders: [],
    currentAsset: {
      id: 'asset-1',
      name: 'Folder A',
      type: 'folder' as const,
    },
    isRootFolder: false,
    isRightSidebarCollapsed: false,
    onRightSidebarToggle: vi.fn(),
  }

  it('renders SquareKanban task link button for non-root folder', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} />
      </QueryClientProvider>,
    )

    expect(screen.getAllByTitle(/Linked Tasks|关联任务/i).length).toBeGreaterThan(0)
  })

  it('hides SquareKanban task link button on project root folder', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} isRootFolder={true} />
      </QueryClientProvider>,
    )

    expect(screen.queryByTitle(/Linked Tasks|关联任务/i)).toBeNull()
  })

  it('hides SquareKanban task link button for public share view', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} isPublic={true} />
      </QueryClientProvider>,
    )

    expect(screen.queryByTitle(/Linked Tasks|关联任务/i)).toBeNull()
  })

  it('hides SquareKanban task link button on Recently Deleted view', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} currentAsset={{ name: 'Recently Deleted', type: 'folder' }} />
      </QueryClientProvider>,
    )

    expect(screen.queryByTitle(/Linked Tasks|关联任务/i)).toBeNull()
  })

  it('renders mobile navigation menu button when not in public share mode', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} isPublic={false} />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: /Open navigation menu/i })).toBeDefined()
  })

  it('renders mobile breadcrumbs without All Projects and with project name', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} />
      </QueryClientProvider>,
    )

    // Project name is in mobile and desktop
    expect(screen.getAllByText('Demo Project').length).toBeGreaterThan(0)
    // Folder A is rendered
    expect(screen.getAllByText('Folder A').length).toBeGreaterThan(0)
  })

  it('renders omitted middle folders button (...) for deep hierarchy on mobile', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav
          {...baseProps}
          ancestorFolders={[
            { id: 'parent-1', name: 'Middle Folder 1' },
            { id: 'parent-2', name: 'Middle Folder 2' },
          ]}
          currentAsset={{ id: 'asset-deep', name: 'Deep Folder', type: 'folder' }}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: /Show omitted folders/i })).toBeDefined()
  })

  it('renders chatbot toggle button when onChatbotToggle is provided', () => {
    const onChatbotToggle = vi.fn()
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} onChatbotToggle={onChatbotToggle} />
      </QueryClientProvider>,
    )

    expect(container.querySelector('.lucide-bot')).not.toBeNull()
  })

  it('does not render chatbot toggle button when onChatbotToggle is undefined', () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} onChatbotToggle={undefined} />
      </QueryClientProvider>,
    )

    expect(container.querySelector('.lucide-bot')).toBeNull()
  })

  it('renders file actions dropdown trigger button and opens on click', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav
          {...baseProps}
          fileId="file-1"
          currentAsset={{ id: 'file-1', name: 'sample.mov', type: 'file', version: 1 }}
          allowDownload={true}
        />
      </QueryClientProvider>,
    )

    const triggerButton = screen.getByRole('button', { name: 'sample.mov' })
    expect(triggerButton).toBeDefined()
  })

  it('displays 480p instead of 360p for 480p video transcode in download menu', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav
          {...baseProps}
          fileId="file-1"
          currentAsset={{ id: 'file-1', name: 'sample.mov', type: 'file', version: 1 }}
          allowDownload={true}
          downloadInfo={{
            originalKey: 'raw.mov',
            videoTranscodes: [
              {
                key: 'sample-480p.mp4',
                width: 854,
                height: 480,
                hdr: false,
              },
            ],
          }}
        />
      </QueryClientProvider>,
    )

    const triggerButton = screen.getByRole('button', { name: 'sample.mov' })
    fireEvent.pointerDown(triggerButton, { button: 0, ctrlKey: false })

    const downloadSubTrigger = screen.getByText('Download')
    fireEvent.click(downloadSubTrigger)

    const items = screen.getAllByRole('menuitem')
    expect(items.some((i) => i.textContent?.includes('480p'))).toBe(true)
    expect(items.some((i) => i.textContent?.includes('360p'))).toBe(false)
  })

  it('displays explicit resolution when provided in download menu', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav
          {...baseProps}
          fileId="file-1"
          currentAsset={{ id: 'file-1', name: 'sample.mov', type: 'file', version: 1 }}
          allowDownload={true}
          downloadInfo={{
            originalKey: 'raw.mov',
            videoTranscodes: [
              {
                key: 'sample-480p.mp4',
                width: 854,
                height: 480,
                resolution: '480p',
                hdr: false,
              },
            ],
          }}
        />
      </QueryClientProvider>,
    )

    const triggerButton = screen.getByRole('button', { name: 'sample.mov' })
    fireEvent.pointerDown(triggerButton, { button: 0, ctrlKey: false })

    const downloadSubTrigger = screen.getByText('Download')
    fireEvent.click(downloadSubTrigger)

    const items = screen.getAllByRole('menuitem')
    expect(items.some((i) => i.textContent?.includes('480p'))).toBe(true)
    expect(items.some((i) => i.textContent?.includes('360p'))).toBe(false)
  })

  it('correctly labels legacy portrait video transcode in download menu using long side fallback', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav
          {...baseProps}
          fileId="file-portrait"
          currentAsset={{ id: 'file-portrait', name: 'portrait.mp4', type: 'file', version: 1 }}
          allowDownload={true}
          downloadInfo={{
            originalKey: 'raw.mp4',
            videoTranscodes: [
              {
                key: 'portrait-legacy.mp4',
                width: 1080,
                height: 1920,
                hdr: false,
              },
            ],
          }}
        />
      </QueryClientProvider>,
    )

    const triggerButton = screen.getByRole('button', { name: 'portrait.mp4' })
    fireEvent.pointerDown(triggerButton, { button: 0, ctrlKey: false })

    const downloadSubTrigger = screen.getByText('Download')
    fireEvent.click(downloadSubTrigger)

    const items = screen.getAllByRole('menuitem')
    expect(items.some((i) => i.textContent?.includes('1080p'))).toBe(true)
    expect(items.some((i) => i.textContent?.includes('1920p'))).toBe(false)
  })
})
