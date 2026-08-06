import { create } from 'zustand'
import { today } from '@/lib/dates'

export type AgendaView = 'day' | 'week' | 'month' | 'list'

/** Which kinds of thing the calendar draws. All on by default. */
export interface AgendaLayers {
  tasks: boolean
  /** Board cards — the deliverables themselves, not their tasks. */
  cards: boolean
  events: boolean
  habits: boolean
  finance: boolean
}

interface PlannerUiState {
  /** The day the planner is looking at. */
  day: string
  view: AgendaView
  layers: AgendaLayers
  /** Task to open in the detail dialog, set when arriving from elsewhere. */
  focusTaskId?: string

  setDay: (day: string) => void
  stepDay: (delta: number) => void
  goToday: () => void
  setView: (view: AgendaView) => void
  toggleLayer: (layer: keyof AgendaLayers) => void
  openTask: (id?: string) => void
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d + delta)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const usePlannerUi = create<PlannerUiState>((set) => ({
  day: today(),
  view: 'week',
  layers: { tasks: true, cards: true, events: true, habits: true, finance: true },

  setDay: (day) => set({ day }),
  stepDay: (delta) => set((s) => ({ day: shiftDay(s.day, delta) })),
  goToday: () => set({ day: today() }),
  setView: (view) => set({ view }),
  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  openTask: (focusTaskId) => set({ focusTaskId })
}))

export { shiftDay }
