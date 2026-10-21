import { create } from 'zustand'

interface NavigatorState {
  /** The search (Ctrl+K) is open. */
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  /** A card open from anywhere — the search, the home screen — over any page. */
  openCardId: string | null
  openCard: (id: string | null) => void
}

/**
 * Ways to reach work from any screen. Pages used to open cards each on their
 * own, so a card could only be opened from where it was listed; with one place
 * that holds "the open card", the search and the home screen open the same
 * dialog the board does, on whatever page is showing.
 */
export const useNavigatorStore = create<NavigatorState>((set) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  openCardId: null,
  openCard: (openCardId) => set({ openCardId })
}))
