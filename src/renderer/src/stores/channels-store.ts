import { create } from 'zustand'
import type { ChannelsState } from '@shared/channels'

interface ChannelsStoreState {
  /** Null until the main process answers. */
  state: ChannelsState | null
  /** Start listening to the main process. Returns the unsubscribe. */
  init: () => () => void
}

/** The user's platform accounts and their numbers, as the main process keeps them. */
export const useChannelsStore = create<ChannelsStoreState>((set) => ({
  state: null,
  init: () => {
    void window.focusHub.getChannels().then((state) => set({ state }))
    return window.focusHub.onChannels((state) => set({ state }))
  }
}))
