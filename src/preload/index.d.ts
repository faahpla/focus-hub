import type { FocusHubApi } from '../shared/ipc'

declare global {
  interface Window {
    focusHub: FocusHubApi
  }
}

export {}
