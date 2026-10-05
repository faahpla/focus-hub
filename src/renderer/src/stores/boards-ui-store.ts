import { create } from 'zustand'

const LAST_BOARD_KEY = 'focus-hub:last-board'

function stored(): string | null {
  try {
    return localStorage.getItem(LAST_BOARD_KEY)
  } catch {
    return null
  }
}

interface BoardsUiState {
  /** The board the Boards page shows. Survives restarts. */
  selectedId: string | null
  select: (id: string | null) => void
}

/**
 * Which board is open, kept outside the page so something that is not the
 * page — a notice saying a card went to another board — can switch to it.
 */
export const useBoardsUiStore = create<BoardsUiState>((set) => ({
  selectedId: stored(),
  select: (id) => {
    try {
      if (id) localStorage.setItem(LAST_BOARD_KEY, id)
      else localStorage.removeItem(LAST_BOARD_KEY)
    } catch {
      /* the choice just won't survive a restart */
    }
    set({ selectedId: id })
  }
}))
