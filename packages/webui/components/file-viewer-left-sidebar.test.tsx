// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileViewerLeftSidebar } from './file-viewer-left-sidebar'
import type { AssetInfo } from '@shumai/dtos'

// Mock react-intersection-observer
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: vi.fn(),
    inView: false,
  }),
}))

// Mock @tanstack/react-router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
    to,
  }: {
    children: React.ReactNode
    className?: string
    to?: string
  }) => (
    <a href={to} className={className} data-testid="carousel-link">
      {children}
    </a>
  ),
}))

// Mock api client
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      folders: {
        ':folderId': {
          search: {
            $post: vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({ data: [], pageInfo: {} }),
            }),
          },
        },
      },
    },
  },
}))

describe('FileViewerLeftSidebar', () => {
  const scrollIntoViewMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
  })

  afterEach(() => {
    cleanup()
  })

  const mockFiles: AssetInfo[] = [
    {
      id: 'file-1',
      name: 'Image 1.png',
      proxyType: 'image',
    } as AssetInfo,
    {
      id: 'file-2',
      name: 'Image 2.png',
      proxyType: 'image',
    } as AssetInfo,
    {
      id: 'file-3',
      name: 'Image 3.png',
      proxyType: 'image',
    } as AssetInfo,
  ]

  it('renders files list and highlights active asset', () => {
    const { container } = render(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-2"
        parentFolderId="folder-1"
        initialFiles={mockFiles}
        initialNextCursor={undefined}
      />,
    )

    const links = container.querySelectorAll('[data-testid="carousel-link"]')
    expect(links.length).toBe(3)
    // Active item (file-2) has w-[62px] h-[62px] opacity-100 class
    expect(links[1].className).toContain('w-[62px]')
    expect(links[1].className).toContain('opacity-100')
    // Inactive items have w-[52px] h-[52px] opacity-60 class
    expect(links[0].className).toContain('w-[52px]')
    expect(links[0].className).toContain('opacity-60')
  })

  it('uses behavior auto and block center on initial mount', () => {
    render(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-2"
        parentFolderId="folder-1"
        initialFiles={mockFiles}
        initialNextCursor={undefined}
      />,
    )

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'auto',
    })
  })

  it('uses behavior smooth and block nearest on subsequent active item change', () => {
    const { rerender } = render(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-1"
        parentFolderId="folder-1"
        initialFiles={mockFiles}
        initialNextCursor={undefined}
      />,
    )

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'auto',
    })

    scrollIntoViewMock.mockClear()

    // Switch to file-3 while staying mounted
    rerender(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-3"
        parentFolderId="folder-1"
        initialFiles={mockFiles}
        initialNextCursor={undefined}
      />,
    )

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })
  })

  it('resets initial mount centering when parent folder / initial files change', () => {
    const { rerender } = render(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-1"
        parentFolderId="folder-1"
        initialFiles={mockFiles}
        initialNextCursor={undefined}
      />,
    )

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'auto',
    })

    scrollIntoViewMock.mockClear()

    const newFiles: AssetInfo[] = [
      {
        id: 'file-10',
        name: 'Other 10.png',
        proxyType: 'image',
      } as AssetInfo,
    ]

    rerender(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-10"
        parentFolderId="folder-2"
        initialFiles={newFiles}
        initialNextCursor={undefined}
      />,
    )

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'auto',
    })
  })

  it('renders Bot badge on carousel thumbnail when asset has agent', () => {
    const filesWithAgent: AssetInfo[] = [
      {
        id: 'file-agent',
        name: 'Agent File.png',
        proxyType: 'image',
        agentId: 'agent-1',
        agent: { id: 'agent-1', name: 'DrawBot' },
      } as AssetInfo,
    ]

    const { container } = render(
      <FileViewerLeftSidebar
        projectId="proj-1"
        currentAssetId="file-agent"
        parentFolderId="folder-1"
        initialFiles={filesWithAgent}
        initialNextCursor={undefined}
      />,
    )

    const agentBadge = container.querySelector('[data-testid="carousel-agent-badge"]')
    expect(agentBadge).toBeTruthy()
    expect(agentBadge?.getAttribute('title')).toBe('DrawBot')
  })
})
