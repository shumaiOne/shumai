import { Menu } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { UserMenu } from './user-menu'

interface DualSidebarItemProps {
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
  onItemClick?: () => void
}

// A declarative component that holds props for a sidebar item. It doesn't render anything itself.
export const DualSidebarItem: React.FC<DualSidebarItemProps> = () => {
  return null
}

interface DualSidebarProps {
  children: React.ReactNode
}

export const DualSidebar: React.FC<DualSidebarProps> = ({ children }) => {
  const [activeItem, setActiveItem] = useState<number | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const sidebarItems = useMemo(
    () =>
      React.Children.toArray(children).filter(
        (child): child is React.ReactElement<DualSidebarItemProps> =>
          React.isValidElement(child) && child.type === DualSidebarItem,
      ),
    [children],
  )

  const activeItemContent = activeItem !== null ? sidebarItems[activeItem]?.props : null

  const handleItemClick = (index: number) => {
    const item = sidebarItems[index]

    if (!item.props.children) {
      setActiveItem(null)
      item.props.onItemClick?.()
      return
    }

    setActiveItem((prev) => {
      if (prev === index) {
        return null
      }
      if (item && item.props.onItemClick) {
        item.props.onItemClick()
      }
      return index
    })
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setActiveItem(null)
  }

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Open navigation menu"
        aria-expanded={isMobileMenuOpen}
      >
        <Menu />
      </button>

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
        <div className="absolute bottom-0 w-full h-[70dvh] bg-linear-to-t from-orange-400/10 to-transparent"></div>
        {/* Level 1: Icon Bar */}
        <nav className="w-16 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center pb-4 pt-0 space-y-2 flex-shrink-0">
          <div className="flex-1 w-full flex flex-col items-center space-y-5">
            {sidebarItems.map((item, index) => (
              <div key={item.props.label} className="relative group">
                <button
                  onClick={() => handleItemClick(index)}
                  aria-label={item.props.label}
                  aria-expanded={activeItem === index}
                  className={`p-3 rounded-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-slate-900 ${
                    activeItem === index
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-500 dark:hover:text-slate-400 dark:text-slate-500 cursor-pointer'
                  }`}
                >
                  {item.props.icon}
                </button>
                <span
                  className="absolute left-full ml-4 px-2 py-1 text-sm bg-slate-800 text-white rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap"
                  role="tooltip"
                >
                  {item.props.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-auto w-full flex flex-col items-center">
            <UserMenu />
          </div>
        </nav>

        {/* Level 2: Content Panel */}
        <div
          className={`transition-all duration-300 ease-in-out bg-white dark:bg-slate-900/95 backdrop-blur-sm shadow-lg overflow-hidden ${
            activeItem !== null
              ? 'w-[calc(100vw-4rem)] md:w-80 border-r border-slate-200 dark:border-slate-800'
              : 'w-0'
          }`}
        >
          <div className="w-[calc(100vw-4rem)] md:w-80 h-full flex flex-col">
            {activeItemContent && (
              <>
                <header className="h-16 flex items-center px-4 font-bold text-lg border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
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
