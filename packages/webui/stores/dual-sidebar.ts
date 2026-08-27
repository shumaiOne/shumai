import { create } from 'zustand'

interface DualSidebarStore {
  isMobileMenuOpen: boolean
  activeItem: number | null
  activeItemId: string | null
  openMobileMenu: (defaultActiveIdOrIndex?: string | number | null) => void
  closeMobileMenu: () => void
  toggleMobileMenu: () => void
  setActiveItem: (item: number | null) => void
  setActiveItemId: (id: string | null) => void
}

export const useDualSidebarStore = create<DualSidebarStore>((set) => ({
  isMobileMenuOpen: false,
  activeItem: null,
  activeItemId: null,
  openMobileMenu: (defaultActiveIdOrIndex = null) =>
    set({
      isMobileMenuOpen: true,
      activeItemId: typeof defaultActiveIdOrIndex === 'string' ? defaultActiveIdOrIndex : null,
      activeItem: typeof defaultActiveIdOrIndex === 'number' ? defaultActiveIdOrIndex : null,
    }),
  closeMobileMenu: () =>
    set({
      isMobileMenuOpen: false,
      activeItem: null,
      activeItemId: null,
    }),
  toggleMobileMenu: () =>
    set((state) => ({
      isMobileMenuOpen: !state.isMobileMenuOpen,
      activeItem: state.isMobileMenuOpen ? null : state.activeItem,
      activeItemId: state.isMobileMenuOpen ? null : state.activeItemId,
    })),
  setActiveItem: (item) => set({ activeItem: item, activeItemId: null }),
  setActiveItemId: (id) => set({ activeItemId: id }),
}))
