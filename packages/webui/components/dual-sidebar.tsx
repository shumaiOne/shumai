import { Menu } from 'lucide-react'
import React, { useEffect, useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useDualSidebarStore } from '@/ui/stores/dual-sidebar'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { UserMenu } from './user-menu'

export interface DualSidebarItemProps {
  id?: string
  icon: React.ReactNode
  label: string
  badge?: React.ReactNode
  children?: React.ReactNode
  onItemClick?: () => void
  active?: boolean
}

// A declarative component that holds props for a sidebar item. It doesn't render anything itself.
export const DualSidebarItem: React.FC<DualSidebarItemProps> = () => {
  return null
}

interface DualSidebarProps {
  children: React.ReactNode
  hideMobileButton?: boolean
}

export const DualSidebar: React.FC<DualSidebarProps> = ({ children, hideMobileButton = false }) => {
  const {
    isMobileMenuOpen,
    activeItem,
    activeItemId,
    setActiveItem,
    toggleMobileMenu,
    closeMobileMenu,
  } = useDualSidebarStore()

  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const sidebarItems = useMemo(
    () =>
      React.Children.toArray(children).filter(
        (child): child is React.ReactElement<DualSidebarItemProps> =>
          React.isValidElement(child) && child.type === DualSidebarItem,
      ),
    [children],
  )

  // Automatically resolve activeItemId to activeItem index if specified
  useEffect(() => {
    if (activeItemId) {
      const foundIndex = sidebarItems.findIndex((item) => item.props.id === activeItemId)
      if (foundIndex !== -1) {
        setActiveItem(foundIndex)
      }
    }
  }, [activeItemId, sidebarItems, setActiveItem])

  // Automatically close mobile menu when navigating to another route
  useEffect(() => {
    closeMobileMenu()
  }, [pathname, closeMobileMenu])

  const activeItemContent = activeItem !== null ? sidebarItems[activeItem]?.props : null

  const handleItemClick = (index: number) => {
    const item = sidebarItems[index]

    if (!item.props.children) {
      setActiveItem(null)
      item.props.onItemClick?.()
      return
    }

    if (activeItem === index) {
      setActiveItem(null)
    } else {
      if (item && item.props.onItemClick) {
        item.props.onItemClick()
      }
      setActiveItem(index)
    }
  }

  return (
    <>
      {/* Mobile Hamburger Button (Optional if header provides its own menu button) */}
      {!hideMobileButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMobileMenu}
          className="md:hidden fixed top-4 left-4 z-50 rounded-md bg-sidebar/50 backdrop-blur-sm text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Open navigation menu"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu />
        </Button>
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={closeMobileMenu}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Desktop Overlay for Child Sidebar */}
      {activeItem !== null && (
        <div
          onClick={() => setActiveItem(null)}
          className="hidden md:block fixed inset-0 bg-black/20 z-30"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="absolute bottom-0 w-full h-[70dvh] bg-linear-to-t from-sidebar-primary/10 to-transparent"></div>
        {/* Level 1: Icon Bar */}
        <nav className="w-16 bg-card border-r border-sidebar-border flex flex-col items-center pb-4 pt-0 space-y-2 flex-shrink-0">
          <div className="flex-1 w-full flex flex-col items-center gap-5 pt-1">
            <TooltipProvider>
              {sidebarItems.map((item, index) => {
                const isItemActive = Boolean(item.props.active || activeItem === index)
                return (
                  <Tooltip key={item.props.label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        onClick={() => handleItemClick(index)}
                        aria-label={item.props.label}
                        aria-expanded={activeItem === index}
                        className={`relative w-12 h-12 [&_svg:not([class*='size-'])]:size-6 transition-colors duration-200 ${
                          isItemActive
                            ? 'text-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-primary'
                            : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                        }`}
                      >
                        {item.props.icon}
                        {item.props.badge}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.props.label}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>
          <div className="mt-auto w-full flex flex-col items-center pb-2">
            <UserMenu />
          </div>
        </nav>

        {/* Level 2: Content Panel */}
        <div
          className={`transition-all duration-300 ease-in-out bg-sidebar/95 backdrop-blur-sm shadow-lg overflow-hidden ${
            activeItem !== null
              ? 'w-[calc(100vw-4rem)] md:w-100 border-r border-sidebar-border'
              : 'w-0'
          }`}
        >
          <div className="w-[calc(100vw-4rem)] md:w-100 h-full flex flex-col">
            {activeItemContent && (
              <>
                <header className="h-16 flex items-center px-4 font-bold text-lg border-b border-sidebar-border flex-shrink-0">
                  <h2>{activeItemContent.label}</h2>
                </header>
                <div className="flex-1 overflow-y-auto p-2">{activeItemContent.children}</div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
