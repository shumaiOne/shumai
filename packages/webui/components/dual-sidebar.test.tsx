// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DualSidebar, DualSidebarItem } from './dual-sidebar'
import { useDualSidebarStore } from '@/ui/stores/dual-sidebar'

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => '/projects/proj-1',
}))

vi.mock('./user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">User</div>,
}))

describe('DualSidebar component', () => {
  beforeEach(() => {
    useDualSidebarStore.setState({
      isMobileMenuOpen: false,
      activeItem: null,
      activeItemId: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders Level 1 icons and UserMenu', () => {
    render(
      <DualSidebar>
        <DualSidebarItem icon={<span>HomeIcon</span>} label="Home" />
        <DualSidebarItem icon={<span>NotifIcon</span>} label="Notifications">
          <div>Notification List</div>
        </DualSidebarItem>
      </DualSidebar>,
    )

    expect(screen.getByLabelText('Home')).toBeDefined()
    expect(screen.getByLabelText('Notifications')).toBeDefined()
    expect(screen.getByTestId('user-menu')).toBeDefined()
  })

  it('displays defaultMobileContent when mobile menu is open and no active item is selected', () => {
    useDualSidebarStore.setState({ isMobileMenuOpen: true })

    render(
      <DualSidebar
        defaultMobileContent={{
          label: 'Project Folders',
          children: <div>Folder Tree Content</div>,
        }}
      >
        <DualSidebarItem icon={<span>HomeIcon</span>} label="Home" />
        <DualSidebarItem icon={<span>NotifIcon</span>} label="Notifications">
          <div>Notification List</div>
        </DualSidebarItem>
      </DualSidebar>,
    )

    expect(screen.getByText('Project Folders')).toBeDefined()
    expect(screen.getByText('Folder Tree Content')).toBeDefined()
  })

  it('switches to child item content when a Level 1 icon is clicked', () => {
    useDualSidebarStore.setState({ isMobileMenuOpen: true })

    render(
      <DualSidebar
        defaultMobileContent={{
          label: 'Project Folders',
          children: <div>Folder Tree Content</div>,
        }}
      >
        <DualSidebarItem icon={<span>HomeIcon</span>} label="Home" />
        <DualSidebarItem icon={<span>NotifIcon</span>} label="Notifications">
          <div>Notification List</div>
        </DualSidebarItem>
      </DualSidebar>,
    )

    const notifBtn = screen.getByLabelText('Notifications')
    act(() => {
      fireEvent.click(notifBtn)
    })

    expect(screen.getByText('Notification List')).toBeDefined()
  })

  it('closes mobile menu when close (X) button is clicked', () => {
    useDualSidebarStore.setState({ isMobileMenuOpen: true })

    render(
      <DualSidebar
        defaultMobileContent={{
          label: 'Project Folders',
          children: <div>Folder Tree Content</div>,
        }}
      >
        <DualSidebarItem icon={<span>HomeIcon</span>} label="Home" />
      </DualSidebar>,
    )

    const closeButton = screen.getByRole('button', { name: /Close navigation menu/i })
    act(() => {
      fireEvent.click(closeButton)
    })

    expect(useDualSidebarStore.getState().isMobileMenuOpen).toBe(false)
  })
})
