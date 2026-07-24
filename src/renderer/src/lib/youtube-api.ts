/**
 * Thin loader + typings for the official YouTube IFrame Player API. Loading it
 * lets us drive volume / play / pause / skip from the app's own UI instead of
 * the cramped native controls.
 */

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  nextVideo(): void
  previousVideo(): void
  setVolume(volume: number): void
  getVolume(): number
  mute(): void
  unMute(): void
  loadVideoById(id: string): void
  loadPlaylist(opts: { list: string; listType: string; index?: number }): void
  getPlayerState(): number
  destroy(): void
}

interface YTPlayerOptions {
  height?: string | number
  width?: string | number
  videoId?: string
  playerVars?: Record<string, unknown>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: number; target: YTPlayer }) => void
    onError?: (e: { data: number }) => void
  }
}

interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer
  PlayerState: { UNSTARTED: number; ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = (): void => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}
