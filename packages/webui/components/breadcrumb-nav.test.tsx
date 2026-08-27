// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
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

    expect(screen.getByTitle(/Linked Tasks|关联任务/i)).toBeDefined()
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

  it('hides mobile navigation menu button in public share mode', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BreadcrumbNav {...baseProps} isPublic={true} />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button', { name: /Open navigation menu/i })).toBeNull()
  })
})
