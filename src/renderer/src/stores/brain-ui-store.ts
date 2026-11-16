import { create } from 'zustand'

/**
 * Which notes the Brain lists: the inbox, everything, the pinned ones, the
 * ones with no topic yet, or one topic (`topic:<id>`).
 */
export type BrainFilter = 'inbox' | 'all' | 'pinned' | 'loose' | `topic:${string}`

const FILTER_KEY = 'focus-hub:brain-filter'
const VIEW_KEY = 'focus-hub:brain-view'

/** The notes as a list with the open one, or as a map of how they connect. */
export type BrainView = 'notes' | 'map'

function storedView(): BrainView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'notes'
  } catch {
    return 'notes'
  }
}

function storedFilter(): BrainFilter {
  try {
    return (localStorage.getItem(FILTER_KEY) as BrainFilter | null) ?? 'all'
  } catch {
    return 'all'
  }
}

interface BrainUiState {
  selectedId: string | null
  filter: BrainFilter
  search: string
  view: BrainView
  select: (id: string | null) => void
  setFilter: (filter: BrainFilter) => void
  setSearch: (search: string) => void
  setView: (view: BrainView) => void
}

/**
 * Kept outside the page so the search (Ctrl+K) can open a note before the
 * Brain is even on screen.
 */
export const useBrainUiStore = create<BrainUiState>((set) => ({
  selectedId: null,
  filter: storedFilter(),
  search: '',
  view: storedView(),
  select: (selectedId) => set({ selectedId }),
  setFilter: (filter) => {
    try {
      localStorage.setItem(FILTER_KEY, filter)
    } catch {
      /* only a preference */
    }
    set({ filter })
  },
  setSearch: (search) => set({ search }),
  setView: (view) => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      /* only a preference */
    }
    set({ view })
  }
}))
