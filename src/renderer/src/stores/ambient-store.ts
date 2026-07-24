import { create } from 'zustand'
import type { AmbientSound } from '@shared/types'
import { ambientEngine } from '@/features/ambient/ambient-engine'

interface AmbientState {
  sound: AmbientSound
  volume: number
  setSound: (sound: AmbientSound) => void
  setVolume: (v: number) => void
  toggle: (sound: AmbientSound) => void
}

export const useAmbientStore = create<AmbientState>((set, get) => ({
  sound: 'none',
  volume: 0.6,
  setSound: (sound) => {
    void ambientEngine.play(sound)
    set({ sound })
  },
  setVolume: (v) => {
    ambientEngine.setVolume(v)
    set({ volume: v })
  },
  toggle: (sound) => {
    const next = get().sound === sound ? 'none' : sound
    void ambientEngine.play(next)
    set({ sound: next })
  }
}))
