import { create } from 'zustand'
import type { SyncStatus } from '@shared/sync'
import { useToastStore } from './toast-store'

interface SyncStoreState {
  status: SyncStatus
  /** Start listening to the main process. Returns the unsubscribe. */
  init: () => () => void
}

/**
 * The cloud side of shared boards, as the screen sees it.
 *
 * A problem surfaces as a notice each time one happens. The main process
 * numbers them, so the same message twice is still two notices — and the
 * first status only sets the baseline: an error from before this window
 * opened is not news.
 */
export const useSyncStore = create<SyncStoreState>((set) => ({
  status: { state: 'connecting', pending: 0, errorId: 0 },
  init: () => {
    let seen: number | null = null
    const take = (status: SyncStatus): void => {
      if (seen !== null && status.errorId > seen && status.error) {
        useToastStore.getState().push({
          title: 'Quadros compartilhados',
          lines: [status.error],
          variant: 'warning'
        })
      }
      seen = Math.max(seen ?? 0, status.errorId)
      set({ status })
    }
    void window.focusHub.getSyncStatus().then(take)
    return window.focusHub.onSyncStatus(take)
  }
}))
