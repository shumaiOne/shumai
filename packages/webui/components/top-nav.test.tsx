// @vitest-environment happy-dom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TopNav } from './top-nav'
import { useTopNavStore } from '@/ui/stores/top-nav'

let mockPathname = '/projects/proj-1'
let mockIsMobile = false

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: mockPathname } }),
}))

vi.mock('@/ui/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile,
}))

describe('TopNav component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  beforeEach(() => {
    useTopNavStore.getState().clearProjectState()
    mockPathname = '/projects/proj-1'
    mockIsMobile = false
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders TopNavBreadcrumbSkeleton on project routes when projectState is not loaded', () => {
    mockPathname = '/projects/proj-1'
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TopNav />
      </QueryClientProvider>,
    )

    expect(screen.getByTestId('top-nav-breadcrumb-skeleton')).toBeDefined()
    // Ensure center ShumaiLogo is NOT rendered
    expect(container.querySelector('.text-orange-600')).toBeNull()
  })

  it('renders TeamHeader with logo on non-project routes when projectState is not loaded', () => {
    mockPathname = '/teams/team-1'
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TopNav />
      </QueryClientProvider>,
    )

    expect(screen.queryByTestId('top-nav-breadcrumb-skeleton')).toBeNull()
    // TeamHeader contains ShumaiLogo with text-orange-600
    expect(container.querySelector('.text-orange-600')).not.toBeNull()
  })

  it('returns null on mobile when navigating file routes', () => {
    mockPathname = '/projects/proj-1/files/file-1'
    mockIsMobile = true
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TopNav />
      </QueryClientProvider>,
    )

    expect(container.firstChild).toBeNull()
  })
})
