import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Transient playback state for the YouTube mini-player. The list of saved
 * sources lives in persisted settings (app-store); this store tracks what is
 * loaded plus volume/mute/position, applied to the player through the official
 * IFrame API. Volume, mute, collapsed state and the dragged position are
 * persisted to localStorage so they survive restarts — but NOT the active
 * source, so music never autostarts on launch.
 */
interface MusicState {
  activeId: string | null
  expanded: boolean
  volume: number // 0..1
  muted: boolean
  position: { x: number; y: number }
  setActive: (id: string) => void
  stop: () => void
  toggleExpand: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setPosition: (pos: { x: number; y: number }) => void
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set) => ({
      activeId: null,
      expanded: false,
      volume: 0.7,
      muted: false,
      position: { x: 0, y: 0 },
      setActive: (id) => set({ activeId: id }),
      stop: () => set({ activeId: null }),
      toggleExpand: () => set((s) => ({ expanded: !s.expanded })),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)), muted: v === 0 }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setPosition: (position) => set({ position })
    }),
    {
      name: 'focus-hub-music',
      partialize: (s) => ({
        volume: s.volume,
        muted: s.muted,
        expanded: s.expanded,
        position: s.position
      })
    }
  )
)
